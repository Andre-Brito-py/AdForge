import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { role, goal } = await request.json();

    // Aqui poderíamos salvar role/goal em uma tabela de Profile ou Metadata
    // Para MVP, apenas marcaremos onboardingCompleted = true no User

    await db.user.update({
      where: { email: session.user.email },
      data: { onboardingCompleted: true }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro no onboarding:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
