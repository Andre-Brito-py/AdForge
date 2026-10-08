/**
 * Integração (nota fiscal): precisa de TEST_DATABASE_URL. A API da NFE.io é simulada.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const url = process.env.TEST_DATABASE_URL;
vi.mock("@/services/email", () => ({
  sendPurchaseReceipt: vi.fn(async () => {}),
  sendWelcomeEmail: vi.fn(async () => {}),
  sendAdminAlertEmail: vi.fn(async () => {}),
  appUrl: () => "http://localhost:3000",
}));

describe.skipIf(!url)("nota fiscal (NFE.io)", async () => {
  const { db } = await import("@/lib/db");
  const { createUserWithWorkspace } = await import("@/lib/users");
  const { recordPurchase, recordRefund } = await import("@/lib/payments");
  const { processInvoices, monthlyReport } = await import("@/lib/fiscal");
  const { invalidateConfigCache } = await import("@/lib/config");
  const { encryptSecret } = await import("@/lib/crypto");

  const email = `fiscal-${Date.now()}@exemplo.com`;
  let userId = "", workspaceId = "";
  const sent: { method: string; path: string; body: Record<string, unknown> | null }[] = [];
  let original: { settingsJson: string | null; nfeioApiKey: string | null } | null = null;

  beforeAll(async () => {
    const created = await createUserWithWorkspace({ email, name: "Fiscal" });
    userId = created.user.id;
    workspaceId = created.workspaceId;
    original = await db.systemConfig.findUnique({ where: { id: "global" }, select: { settingsJson: true, nfeioApiKey: true } });
    await db.systemConfig.upsert({
      where: { id: "global" },
      update: { settingsJson: JSON.stringify({ fiscalEnabled: true, nfeioCompanyId: "emp1", fiscalCityServiceCode: "2690" }), nfeioApiKey: encryptSecret("chave") },
      create: { id: "global", settingsJson: JSON.stringify({ fiscalEnabled: true, nfeioCompanyId: "emp1", fiscalCityServiceCode: "2690" }), nfeioApiKey: encryptSecret("chave") },
    });
    invalidateConfigCache();
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL, init?: RequestInit) => {
      const path = new URL(String(input)).pathname;
      sent.push({ method: init?.method || "GET", path, body: init?.body ? JSON.parse(String(init.body)) : null });
      const json = init?.method === "POST" ? { id: "nf1", flowStatus: "WaitingSend" } : { flowStatus: "Issued", number: 42 };
      return new Response(JSON.stringify(json), { status: init?.method === "POST" ? 202 : 200, headers: { "Content-Type": "application/json" } });
    }));
  });

  afterAll(async () => {
    vi.unstubAllGlobals();
    const payments = await db.payment.findMany({ where: { workspaceId }, select: { id: true } });
    await db.fiscalInvoice.deleteMany({ where: { paymentId: { in: payments.map((p) => p.id) } } });
    await db.payment.deleteMany({ where: { workspaceId } });
    await db.systemConfig.update({ where: { id: "global" }, data: { settingsJson: original?.settingsJson ?? null, nfeioApiKey: original?.nfeioApiKey ?? null } });
    invalidateConfigCache();
    await db.workspace.deleteMany({ where: { id: workspaceId } });
    await db.user.deleteMany({ where: { id: userId } });
    await db.$disconnect();
  });

  it("venda em reais entra na fila, é emitida e acompanhada; em dólar não gera nota", async () => {
    await recordPurchase({ provider: "STRIPE", externalId: `cs_brl_${Date.now()}`, userId, workspaceId, planId: "starter", planName: "Starter", credits: 200, amount: 49, currency: "brl", customer: { name: "Maria", taxId: "123.456.789-09", country: "BR" } });
    await recordPurchase({ provider: "STRIPE", externalId: `cs_usd_${Date.now()}`, userId, workspaceId, planId: "starter", planName: "Starter", credits: 200, amount: 10, currency: "usd" });
    const queued = await db.fiscalInvoice.findMany({ where: { paymentId: { in: (await db.payment.findMany({ where: { workspaceId } })).map((p) => p.id) } } });
    expect(queued).toHaveLength(1);

    await processInvoices();
    expect(sent[0]).toMatchObject({ method: "POST", path: "/v1/companies/emp1/serviceinvoices" });
    expect(sent[0].body).toMatchObject({ cityServiceCode: "2690", servicesAmount: 49, borrower: { name: "Maria", federalTaxNumber: 12345678909 } });

    await processInvoices();
    const issued = await db.fiscalInvoice.findUniqueOrThrow({ where: { id: queued[0].id } });
    expect(issued).toMatchObject({ status: "ISSUED", number: "42", externalId: "nf1" });
  });

  it("estorno total cancela a nota emitida", async () => {
    const payment = await db.payment.findFirstOrThrow({ where: { workspaceId, currency: "BRL" } });
    await recordRefund({ provider: "STRIPE", externalId: payment.externalId, refundedTotal: 49 });
    expect(sent.some((s) => s.method === "DELETE" && s.path === "/v1/companies/emp1/serviceinvoices/nf1")).toBe(true);
    expect((await db.fiscalInvoice.findFirstOrThrow({ where: { paymentId: payment.id } })).status).toBe("CANCELED");
  });

  it("relatório mensal soma por moeda", async () => {
    const report = await monthlyReport(new Date().getUTCFullYear());
    const brl = report.rows.find((r) => r.currency === "BRL");
    expect(brl?.gross).toBeGreaterThanOrEqual(49);
  });
});
