import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../auth/[...nextauth]/route";
import { db } from "@/lib/db";

import { consumeCredits, InsufficientCreditsError } from "@/services/credits";
import { AI_COSTS } from "@/config/costs";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const campaign = await db.campaign.findUnique({
      where: { id: params.id },
      include: { product: true }
    });

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    const cost = AI_COSTS.video.ovi5s;
    const config = await db.systemConfig.findUnique({ where: { id: "global" } });
    let dynamicCost = cost.credits;
    if (config?.aiCostsJson) {
      try {
        const parsed = JSON.parse(config.aiCostsJson);
        if (parsed.video) dynamicCost = parsed.video;
      } catch (e) {}
    }

    try {
      await consumeCredits(
        campaign.workspaceId,
        session.user.id,
        dynamicCost,
        "Geração de Vídeo 5s (OVI)",
        "ovi-mock",
        "ovi5s",
        cost.estimatedUsd
      );
    } catch (e) {
      if (e instanceof InsufficientCreditsError) {
        return NextResponse.json({ error: "Saldo insuficiente" }, { status: 402 });
      }
      throw e;
    }

    // Criar o Creative como PROCESSING para o frontend mostrar "Processando..."
    // Em produção, isso envia o frame para a fila de processamento da OVI
    const creative = await db.creative.create({
      data: {
        campaignId: campaign.id,
        type: "VIDEO",
        provider: "ovi-mock",
        model: "ovi5s",
        prompt: `Movimento cinemático para ${campaign.tone} e ${campaign.objective}`,
        status: "PROCESSING",
        creditsUsed: 10,
        duration: 5,
      }
    });

    // Mock: Mudar para COMPLETED após 10 segundos
    setTimeout(async () => {
      await db.creative.update({
        where: { id: creative.id },
        data: {
          status: "COMPLETED",
          // Exemplo de vídeo royalty-free (Cachoeira)
          outputUrl: "https://www.w3schools.com/html/mov_bbb.mp4" 
        }
      });
    }, 10000);

    return NextResponse.json({ success: true, creative });
  } catch (error) {
    console.error("Generate video error:", error);
    return NextResponse.json({ error: "Failed to generate video" }, { status: 500 });
  }
}
