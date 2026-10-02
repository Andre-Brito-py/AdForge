import { NextResponse } from "next/server";
import speakeasy from "speakeasy";
import qrcode from "qrcode";
import { db } from "@/lib/db";
import { handler, HttpError } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";

export const POST = handler(async () => {
  const user = await requireApiUser();
  // Não sobrescreve o segredo de um 2FA já ativo (isso trancaria o usuário fora da conta).
  if (user.twoFactorEnabled) throw new HttpError(409, "errors.twoFactorAlreadyOn");

  const secret = speakeasy.generateSecret({ name: `Vysify (${user.email})` });
  await db.user.update({ where: { id: user.id }, data: { twoFactorSecret: secret.base32 } });
  const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url!);
  return NextResponse.json({ qrCodeUrl, secret: secret.base32 });
});
