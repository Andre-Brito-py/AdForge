import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ enabled: false }, { status: 401 });
  }

  const user = await db.user.findUnique({ where: { id: session.user.id } });
  
  return NextResponse.json({
    enabled: user?.twoFactorEnabled || false
  });
}
