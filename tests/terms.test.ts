import { afterAll, describe, expect, it, vi } from "vitest";

// Antes de qualquer import do app: o cliente do banco lê DATABASE_URL ao ser carregado.
// Sem banco de teste, aponta para um endereço inválido (nunca para o .env, que pode ser produção).
const url = vi.hoisted(() => {
  const u = process.env.TEST_DATABASE_URL;
  process.env.DATABASE_URL = u || "postgresql://invalid:invalid@127.0.0.1:1/none";
  process.env.DIRECT_URL = process.env.DATABASE_URL;
  return u;
});

const { hasCurrentTerms, isValidPreAccept, preAcceptValue, TERMS_VERSION } = await import("@/lib/terms");

vi.mock("@/services/email", () => ({
  sendWelcomeEmail: vi.fn(async () => {}),
  appUrl: () => "http://localhost:3000",
}));

describe("aceite dos Termos", () => {
  it("o aceite antes do Google vale 30 minutos e não pode ser forjado", () => {
    const now = Date.now();
    const value = preAcceptValue(now);
    expect(isValidPreAccept(value, now + 60_000)).toBe(true);
    expect(isValidPreAccept(value, now + 31 * 60_000)).toBe(false);
    expect(isValidPreAccept(value.replace(/.$/, (c) => (c === "A" ? "B" : "A")), now)).toBe(false);
    expect(isValidPreAccept(`2020-01-01.${now}.assinatura`, now)).toBe(false);
    expect(isValidPreAccept(undefined)).toBe(false);
  });

  it("só a versão atual libera o uso", () => {
    expect(hasCurrentTerms({ termsVersion: TERMS_VERSION })).toBe(true);
    expect(hasCurrentTerms({ termsVersion: "2020-01-01" })).toBe(false);
    expect(hasCurrentTerms({ termsVersion: null })).toBe(false);
  });
});

describe.skipIf(!url)("aceite dos Termos no banco", async () => {
  const { db } = await import("@/lib/db");
  const { recordTermsAcceptance } = await import("@/lib/terms");
  const { createUserWithWorkspace } = await import("@/lib/users");
  const email = `termos-${Date.now()}@exemplo.com`;
  let userId = "";

  afterAll(async () => {
    await db.consentRecord.deleteMany({ where: { userEmail: email } });
    await db.workspace.deleteMany({ where: { members: { some: { userId } } } });
    await db.user.deleteMany({ where: { id: userId } });
    await db.$disconnect();
  });

  it("registra a versão no usuário e guarda a prova, que sobrevive à exclusão da conta", async () => {
    const { user } = await createUserWithWorkspace({ email, name: "Teste" });
    userId = user.id;
    await recordTermsAcceptance(user, "signup_email");
    const fresh = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(fresh.termsVersion).toBe(TERMS_VERSION);
    expect(fresh.termsAcceptedAt).not.toBeNull();
    const records = await db.consentRecord.findMany({ where: { userId: user.id } });
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ version: TERMS_VERSION, method: "signup_email", userEmail: email });

    await db.workspace.deleteMany({ where: { members: { some: { userId } } } });
    await db.user.delete({ where: { id: userId } });
    expect(await db.consentRecord.count({ where: { userEmail: email } })).toBe(1);
  });
});
