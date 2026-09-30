import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { generatePromotionalImage } from "@/services/ai/image";

import { consumeCredits, InsufficientCreditsError } from "@/services/credits";
import { AI_COSTS } from "@/config/costs";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const campaign = await db.campaign.findUnique({
      where: { id },
      include: { product: true }
    });

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    const cost = AI_COSTS.image.standard;
    const config = await db.systemConfig.findUnique({ where: { id: "global" } });
    let dynamicCost = cost.credits;
    if (config?.aiCostsJson) {
      try {
        const parsed = JSON.parse(config.aiCostsJson);
        if (parsed.image) dynamicCost = parsed.image;
      } catch (e) {}
    }

    try {
      await consumeCredits(
        campaign.workspaceId,
        session.user.id,
        dynamicCost,
        "Geração de Imagem Promocional",
        "mock-image-gen",
        "standard",
        cost.estimatedUsd
      );
    } catch (e) {
      if (e instanceof InsufficientCreditsError) {
        return NextResponse.json({ error: "Saldo insuficiente" }, { status: 402 });
      }
      throw e;
    }

    // Gerar Imagem via IA
    const generatedUrl = await generatePromotionalImage(
      campaign.product.id,
      campaign.product.originalImageUrl,
      campaign.tone,
      campaign.objective
    );

    // Salvar no Banco
    const creative = await db.creative.create({
      data: {
        campaignId: campaign.id,
        type: "IMAGE",
        provider: "mock-image-gen",
        model: "standard",
        prompt: `Cenário ${campaign.tone} para ${campaign.objective}`,
        outputUrl: generatedUrl,
        status: "COMPLETED",
        creditsUsed: 3,
      }
    });

    return NextResponse.json({ success: true, creative });
  } catch (error) {
    console.error("Generate image error:", error);
    return NextResponse.json({ error: "Failed to generate image" }, { status: 500 });
  }
}
