/**
 * Integração (cupons e estornos): precisa de um Postgres de TESTE em TEST_DATABASE_URL, com as migrations aplicadas.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const url = process.env.TEST_DATABASE_URL;
if (url) {
  process.env.DATABASE_URL = url;
  process.env.DIRECT_URL = url;
}

const adminEmails: string[] = [];
vi.mock("@/services/email", () => ({
  sendPurchaseReceipt: vi.fn(async () => {}),
  sendWelcomeEmail: vi.fn(async () => {}),
  sendCampaignReadyEmail: vi.fn(async () => {}),
  sendAdminAlertEmail: vi.fn(async (_to: string, subject: string) => { adminEmails.push(subject); }),
  appUrl: () => "http://localhost:3000",
}));

describe.skipIf(!url)("cupons e estornos", async () => {
  const { db } = await import("@/lib/db");
  const { getWorkspaceBalance, consumeCredits } = await import("@/services/credits");
  const { recordPurchase, recordRefund } = await import("@/lib/payments");
  const { applyCoupon, createCoupon, CouponError, deleteCoupon } = await import("@/lib/coupons");
  const { createUserWithWorkspace } = await import("@/lib/users");
  const { pausedProviders, reportProviderProblem, resolveAlert } = await import("@/lib/admin-alerts");
  const { DEFAULT_PLANS } = await import("@/lib/config");

  const starter = DEFAULT_PLANS.find((p) => p.id === "starter")!;
  let userId = "";
  let workspaceId = "";
  const suffix = Date.now().toString(36).toUpperCase();
  const email = `cupom-${Date.now()}@exemplo.com`;

  beforeAll(async () => {
    const created = await createUserWithWorkspace({ email, name: "Teste" });
    userId = created.user.id;
    workspaceId = created.workspaceId;
    // Recebe os avisos de admin (estorno com créditos já gastos, provedor sem saldo).
    await db.user.update({ where: { id: userId }, data: { role: "SUPERADMIN" } });
  });

  afterAll(async () => {
    await db.payment.deleteMany({ where: { workspaceId } });
    await db.coupon.deleteMany({ where: { code: { endsWith: suffix } } });
    await db.providerAlert.deleteMany({ where: { provider: "fal" } });
    await db.workspace.deleteMany({ where: { id: workspaceId } });
    await db.user.deleteMany({ where: { id: userId } });
    await db.$disconnect();
  });

  it("cupom de porcentagem dá o desconto e respeita o limite de usos", async () => {
    await createCoupon({ code: `DEZ${suffix}`, kind: "percent", percentOff: 10, planIds: [], maxRedemptions: 1 }, DEFAULT_PLANS, null);
    const applied = await applyCoupon(`dez${suffix.toLowerCase()}`, starter, "BRL", 49, null);
    expect(applied.discount).toBe(4.9);
    expect(applied.finalPrice).toBe(44.1);

    await recordPurchase({
      provider: "MERCADOPAGO", externalId: `mp-${suffix}`, userId, workspaceId, planId: starter.id, planName: starter.name,
      credits: starter.credits, amount: 44.1, currency: "BRL", couponCode: applied.code, discount: applied.discount,
    });
    await expect(applyCoupon(`DEZ${suffix}`, starter, "BRL", 49, null)).rejects.toMatchObject({ key: "exhausted" });
    // Já usado: apagar só desativa.
    const coupon = await db.coupon.findUniqueOrThrow({ where: { code: `DEZ${suffix}` } });
    expect(await deleteCoupon(coupon.id, null)).toBe("deactivated");
  });

  it("valor fixo vale só na moeda dele e só nos pacotes escolhidos", async () => {
    await createCoupon({ code: `FIXO${suffix}`, kind: "amount", amountOff: 5, currency: "USD", planIds: ["pro"] }, DEFAULT_PLANS, null);
    const pro = DEFAULT_PLANS.find((p) => p.id === "pro")!;
    expect((await applyCoupon(`FIXO${suffix}`, pro, "USD", 20, null)).finalPrice).toBe(15);
    await expect(applyCoupon(`FIXO${suffix}`, pro, "BRL", 99, null)).rejects.toBeInstanceOf(CouponError);
    await expect(applyCoupon(`FIXO${suffix}`, starter, "USD", 10, null)).rejects.toMatchObject({ key: "plan" });
    await expect(applyCoupon("NAOEXISTE", starter, "USD", 10, null)).rejects.toMatchObject({ key: "notFound" });
  });

  it("estorno parcial e depois total retiram os créditos certos, uma vez só", async () => {
    const before = await getWorkspaceBalance(workspaceId); // 200 da compra acima
    await recordPurchase({
      provider: "STRIPE", externalId: `cs-${suffix}`, userId, workspaceId, planId: starter.id, planName: starter.name,
      credits: 200, amount: 10, currency: "USD",
    });
    expect(await getWorkspaceBalance(workspaceId)).toBe(before + 200);

    expect(await recordRefund({ provider: "STRIPE", externalId: `cs-${suffix}`, refundedTotal: 5 })).toEqual({ removed: 100, shortfall: 0 });
    // Reenvio do mesmo aviso: nada muda.
    expect(await recordRefund({ provider: "STRIPE", externalId: `cs-${suffix}`, refundedTotal: 5 })).toBe("unchanged");
    expect(await recordRefund({ provider: "STRIPE", externalId: `cs-${suffix}`, refundedTotal: 10 })).toEqual({ removed: 100, shortfall: 0 });
    expect(await getWorkspaceBalance(workspaceId)).toBe(before);
    const payment = await db.payment.findFirstOrThrow({ where: { externalId: `cs-${suffix}` } });
    expect(payment.status).toBe("REFUNDED");
    expect(payment.refundedCredits).toBe(200);
  });

  it("créditos já gastos não deixam o saldo negativo e o admin é avisado", async () => {
    const balance = await getWorkspaceBalance(workspaceId);
    await consumeCredits({ workspaceId, userId, amount: balance, description: "gasto" });
    const result = await recordRefund({ provider: "MERCADOPAGO", externalId: `mp-${suffix}`, refundedTotal: 44.1 });
    expect(result).toEqual({ removed: 0, shortfall: starter.credits });
    expect(await getWorkspaceBalance(workspaceId)).toBe(0);
    expect(adminEmails.some((s) => s.includes("Estorno"))).toBe(true);
  });

  it("falta de saldo no provedor pausa e o 'já recarreguei' libera", async () => {
    await reportProviderProblem("fal", "fal.ai recusou o pedido (403): User is locked. Reason: Exhausted balance");
    expect((await pausedProviders()).has("fal")).toBe(true);
    expect(adminEmails.some((s) => s.includes("fal.ai"))).toBe(true);
    await resolveAlert("fal");
    expect((await pausedProviders()).has("fal")).toBe(false);
  });
});
