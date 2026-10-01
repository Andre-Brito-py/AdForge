/**
 * Testes de integração: precisam de um Postgres de TESTE em TEST_DATABASE_URL
 * (com as migrations aplicadas). Nunca aponte para o banco de produção.
 *   TEST_DATABASE_URL=postgresql://... npm test
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const url = process.env.TEST_DATABASE_URL;
if (url) {
  process.env.DATABASE_URL = url;
  process.env.DIRECT_URL = url;
}

vi.mock("@/services/email", () => ({
  sendPurchaseReceipt: vi.fn(async () => {}),
  sendWelcomeEmail: vi.fn(async () => {}),
  sendCampaignReadyEmail: vi.fn(async () => {}),
  appUrl: () => "http://localhost:3000",
}));

describe.skipIf(!url)("banco de dados", async () => {
  const { db } = await import("@/lib/db");
  const { consumeCredits, getWorkspaceBalance, InsufficientCreditsError } = await import("@/services/credits");
  const { recordPurchase } = await import("@/lib/payments");
  const { rateLimit } = await import("@/lib/rate-limit");
  const { createUserWithWorkspace } = await import("@/lib/users");

  let userId = "";
  let workspaceId = "";
  const email = `teste-${Date.now()}@exemplo.com`;

  beforeAll(async () => {
    const created = await createUserWithWorkspace({ email, name: "Teste" });
    userId = created.user.id;
    workspaceId = created.workspaceId;
    await db.creditBalance.update({ where: { workspaceId }, data: { balance: 10 } });
  });

  afterAll(async () => {
    await db.workspace.deleteMany({ where: { id: workspaceId } });
    await db.payment.deleteMany({ where: { workspaceId } });
    await db.user.deleteMany({ where: { email } });
    await db.$disconnect();
  });

  it("débitos simultâneos nunca deixam o saldo negativo", async () => {
    // 10 créditos, 8 pedidos simultâneos de 3: só 3 podem passar.
    const results = await Promise.allSettled(
      Array.from({ length: 8 }, () => consumeCredits({ workspaceId, userId, amount: 3, description: "teste" }))
    );
    const ok = results.filter((r) => r.status === "fulfilled").length;
    expect(ok).toBe(3);
    expect(results.filter((r) => r.status === "rejected").every((r) => (r as PromiseRejectedResult).reason instanceof InsufficientCreditsError)).toBe(true);
    expect(await getWorkspaceBalance(workspaceId)).toBe(1);
  });

  it("recusa quantidades negativas", async () => {
    await expect(consumeCredits({ workspaceId, userId, amount: -1000, description: "ataque" })).rejects.toThrow();
    expect(await getWorkspaceBalance(workspaceId)).toBe(1);
  });

  it("webhook repetido credita uma única vez", async () => {
    const input = {
      provider: "STRIPE" as const, externalId: `cs_test_${Date.now()}`, userId, workspaceId,
      planId: "pro", planName: "Pro", credits: 500, amount: 99, currency: "BRL",
    };
    const results = await Promise.all([recordPurchase(input), recordPurchase(input), recordPurchase(input)]);
    expect(results.filter((r) => r === "credited")).toHaveLength(1);
    expect(await getWorkspaceBalance(workspaceId)).toBe(501);
  });

  it("créditos grátis no cadastro só existem se o admin ativar", async () => {
    const { invalidateConfigCache } = await import("@/lib/config");
    const emails = [`off-${Date.now()}@exemplo.com`, `on-${Date.now()}@exemplo.com`];
    const created: string[] = [];
    try {
      await db.systemConfig.upsert({ where: { id: "global" }, update: { freeTrialEnabled: false, signupCredits: 25 }, create: { id: "global", freeTrialEnabled: false, signupCredits: 25 } });
      invalidateConfigCache();
      const off = await createUserWithWorkspace({ email: emails[0], name: "Off" });
      created.push(off.workspaceId);
      expect(await getWorkspaceBalance(off.workspaceId)).toBe(0);

      await db.systemConfig.update({ where: { id: "global" }, data: { freeTrialEnabled: true } });
      invalidateConfigCache();
      const on = await createUserWithWorkspace({ email: emails[1], name: "On" });
      created.push(on.workspaceId);
      expect(await getWorkspaceBalance(on.workspaceId)).toBe(25);
    } finally {
      await db.systemConfig.update({ where: { id: "global" }, data: { freeTrialEnabled: false } });
      invalidateConfigCache();
      await db.workspace.deleteMany({ where: { id: { in: created } } });
      await db.user.deleteMany({ where: { email: { in: emails } } });
    }
  });

  it("rate limit bloqueia após o limite", async () => {
    const key = `test:${Date.now()}`;
    const outcomes = [];
    for (let i = 0; i < 4; i++) outcomes.push((await rateLimit(key, 3, 60)).ok);
    expect(outcomes).toEqual([true, true, true, false]);
    await db.rateLimit.delete({ where: { key } });
  });
});
