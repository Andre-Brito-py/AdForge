import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import speakeasy from "speakeasy";
import qrcode from "qrcode";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Gerar secret
  const secret = speakeasy.generateSecret({
    name: `Vysify (${user.email})`
  });

  // Salvar secret no banco (mas ainda NÃO habilitar o 2FA, aguardar verificação)
  await db.user.update({
    where: { id: user.id },
    data: { twoFactorSecret: secret.base32 }
  });

  // Gerar QR Code
  const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url!);

  return NextResponse.json({
    qrCodeUrl,
    secret: secret.base32
  });
}
