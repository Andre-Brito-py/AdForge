import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";
import { db } from "@/lib/db";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const campaign = await db.campaign.findUnique({
      where: { id: params.id },
      include: { creatives: true }
    });

    if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Segurança: garantir que pertence ao workspace do usuário
    const member = await db.workspaceMember.findFirst({
      where: { userId: session.user.id, workspaceId: campaign.workspaceId }
    });

    if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    return NextResponse.json(campaign);
  } catch (error) {
    console.error("Error fetching campaign:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
