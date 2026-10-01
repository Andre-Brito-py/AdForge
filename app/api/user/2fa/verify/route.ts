import { NextResponse } from "next/server";
import speakeasy from "speakeasy";
import { db } from "@/lib/db";
import { enforceRateLimit, handler, HttpError, parseBody } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { twoFactorTokenSchema } from "@/lib/validation";

async function checkToken(userId: string, token: string) {
  const record = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { twoFactorSecret: true } });
  if (!record.twoFactorSecret) throw new HttpError(400, "Configure o autenticador primeiro");
  const ok = speakeasy.totp.verify({ secret: record.twoFactorSecret, encoding: "base32", token, window: 1 });
  if (!ok) throw new HttpError(400, "Código inválido. Confira o horário do celular e tente de novo.", "INVALID_2FA");
}

// Ativa o 2FA após confirmar o primeiro código.
export const POST = handler(async (request: Request) => {
  const user = await requireApiUser();
  await enforceRateLimit(request, "2fa", 10, 15 * 60, user.id);
  const { token } = await parseBody(request, twoFactorTokenSchema);
  await checkToken(user.id, token);
  await db.user.update({ where: { id: user.id }, data: { twoFactorEnabled: true } });
  return NextResponse.json({ success: true });
});

// Desativar exige um código válido: quem roubou só a sessão não consegue tirar o 2FA.
export const DELETE = handler(async (request: Request) => {
  const user = await requireApiUser();
  await enforceRateLimit(request, "2fa", 10, 15 * 60, user.id);
  const { token } = await parseBody(request, twoFactorTokenSchema);
  await checkToken(user.id, token);
  await db.user.update({ where: { id: user.id }, data: { twoFactorEnabled: false, twoFactorSecret: null } });
  return NextResponse.json({ success: true });
});
