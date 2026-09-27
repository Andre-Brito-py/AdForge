import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { db } from "@/lib/db";

const ADMIN_EMAILS = ["admin@vysify.com", "andre@vysify.com"]; // Ajuste conforme necessário

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email || !ADMIN_EMAILS.includes(session.user.email)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    let config = await db.systemConfig.findUnique({ where: { id: "global" } });
    if (!config) {
      config = await db.systemConfig.create({ data: { id: "global" } });
    }

    return NextResponse.json({ config });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch config" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email || !ADMIN_EMAILS.includes(session.user.email)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { geminiKey, oviKey, aiCostsJson, plansJson } = await request.json();

    const config = await db.systemConfig.upsert({
      where: { id: "global" },
      update: { geminiKey, oviKey, aiCostsJson, plansJson },
      create: { id: "global", geminiKey, oviKey, aiCostsJson, plansJson },
    });

    return NextResponse.json({ success: true, config });
  } catch (error) {
    return NextResponse.json({ error: "Failed to update config" }, { status: 500 });
  }
}
