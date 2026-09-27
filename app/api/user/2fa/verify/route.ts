import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";
import speakeasy from "speakeasy";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { token, disable } = await req.json();

  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user || !user.twoFactorSecret) {
    return NextResponse.json({ error: "2FA not initiated" }, { status: 400 });
  }

  if (disable) {
     await db.user.update({
       where: { id: user.id },
       data: { twoFactorEnabled: false, twoFactorSecret: null }
     });
     return NextResponse.json({ success: true, message: "2FA desabilitado" });
  }

  const verified = speakeasy.totp.verify({
    secret: user.twoFactorSecret,
    encoding: "base32",
    token: token,
    window: 1
  });

  if (verified) {
    await db.user.update({
      where: { id: user.id },
      data: { twoFactorEnabled: true }
    });
    return NextResponse.json({ success: true });
  } else {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 });
  }
}
