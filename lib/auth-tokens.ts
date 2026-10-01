import { db } from "./db";
import { generateToken, hashToken } from "./crypto";

export type AuthTokenType = "VERIFY_EMAIL" | "RESET_PASSWORD";

const TTL_MS: Record<AuthTokenType, number> = {
  VERIFY_EMAIL: 24 * 60 * 60 * 1000,
  RESET_PASSWORD: 60 * 60 * 1000,
};

/** Cria um token de uso único e invalida os anteriores do mesmo tipo. */
export async function issueAuthToken(userId: string, type: AuthTokenType) {
  const { token, tokenHash } = generateToken();
  await db.$transaction([
    db.authToken.deleteMany({ where: { userId, type } }),
    db.authToken.create({ data: { userId, type, tokenHash, expiresAt: new Date(Date.now() + TTL_MS[type]) } }),
  ]);
  return token;
}

/** Consome o token (uma única vez). Retorna o userId ou null se inválido/expirado. */
export async function consumeAuthToken(token: string, type: AuthTokenType): Promise<string | null> {
  const tokenHash = hashToken(token);
  const record = await db.authToken.findUnique({ where: { tokenHash } });
  if (!record || record.type !== type || record.usedAt || record.expiresAt < new Date()) return null;

  const used = await db.authToken.updateMany({ where: { id: record.id, usedAt: null }, data: { usedAt: new Date() } });
  return used.count === 1 ? record.userId : null;
}
