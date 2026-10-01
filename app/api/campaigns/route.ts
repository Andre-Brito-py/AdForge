import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { consumeCredits } from "@/services/credits";
import { generateCampaignStrategy } from "@/services/ai/text";
import { waitUntil } from "@vercel/functions";
import { generateAudio } from "@/services/ai/audio";
import { generateVideo } from "@/services/ai/video";

export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspaceMember = await db.workspaceMember.findFirst({
      where: { userId: session.user.id }
    });

    if (!workspaceMember) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    const { productId, objective, targetAudience, offer, platform, format, style, quality, variations, name } = await request.json();

    const product = await db.product.findUnique({ where: { id: productId } });
    if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

    const config = await db.systemConfig.findUnique({ where: { id: "global" } });
    let costs = { image: 3, video: 10, text: 1 };
    if (config?.aiCostsJson) {
      try { costs = { ...costs, ...JSON.parse(config.aiCostsJson) }; } catch(e){}
    }

    const baseCost = platform.includes("Video") || platform.includes("Reels") ? costs.video : costs.image;
    const costPerVariation = quality === "premium" ? baseCost * 2 : baseCost;
    const totalCost = variations * costPerVariation;

    // MODERAÇÃO DE CONTEÚDO E GERAÇÃO DE ESTRATÉGIA (Síncrono para garantir que não cobra de algo ilegal)
    let strategy;
    try {
      strategy = await generateCampaignStrategy(
        product.originalImageUrl,
        product.name,
        objective,
        style,
        targetAudience || "Público Geral"
      );
    } catch (e: any) {
      if (e.message?.includes("POLICY_VIOLATION")) {
        return NextResponse.json({ 
          error: "Sua requisição viola nossas Políticas de Uso. A plataforma é exclusiva para anúncios comerciais de produtos legítimos." 
        }, { status: 403 });
      }
      return NextResponse.json({ error: "Falha na Inteligência Artificial ao analisar o produto." }, { status: 500 });
    }

    try {
      await consumeCredits(
        workspaceMember.workspaceId,
        session.user.id,
        totalCost,
        `CAMPAIGN_GENERATION_${variations}X`,
        "Internal",
        "Multi",
        totalCost * 0.01
      );
    } catch (e: any) {
      return NextResponse.json({ error: e.message || "Saldo Insuficiente" }, { status: 402 });
    }

    const campaign = await db.campaign.create({
      data: {
        workspaceId: workspaceMember.workspaceId,
        productId,
        name: name || `Campanha - ${objective}`,
        objective: objective || "Vendas",
        tone: style || "Cinematic",
        targetAudience,
        offer,
        platform,
        format,
        style,
        variations,
        status: "GENERATING",
      }
    });

    // Inicia o processamento e permite que a Vercel aguarde até terminar (se dentro do maxDuration)
    const aiPromise = generateCreativesAsync(campaign.id, product, strategy, { objective, tone: style, targetAudience, variations, format, platform, quality, costPerVariation });
    
    waitUntil(aiPromise);

    return NextResponse.json({ success: true, id: campaign.id });
  } catch (error) {
    console.error("Create campaign error:", error);
    return NextResponse.json({ error: "Failed to create campaign" }, { status: 500 });
  }
}

async function generateCreativesAsync(campaignId: string, product: any, strategy: any, config: any) {
  try {

    const copies = strategy.copies.slice(0, config.variations);
    const copyCreatives = copies.map((copy: string) => ({
      campaignId,
      type: "COPY",
      provider: "gemini-2.5-flash",
      model: "text",
      prompt: "Estratégia",
      outputUrl: copy,
      status: "COMPLETED",
      creditsUsed: 1,
    }));
    await db.creative.createMany({ data: copyCreatives });

    const isVideo = config.platform.includes("Video") || config.platform.includes("Reels") || config.platform.includes("Stories");
    const visualCreatives = [];

    for (let i = 0; i < config.variations; i++) {
      let finalMediaUrl = product.originalImageUrl;
      let audioUrl = undefined;
      const copyText = copies[i] || copies[0];

      if (isVideo) {
        try {
          audioUrl = await generateAudio(copyText);
        } catch (audioErr: any) {
          console.warn(`[Audio Gen Warn] Falha ao gerar TTS para variação ${i}:`, audioErr.message);
        }

        try {
          finalMediaUrl = await generateVideo({
            imageUrl: product.originalImageUrl,
            audioUrl: audioUrl,
            prompt: `Estilo visual ${config.tone}. Objetivo: ${config.objective}. Audiência: ${config.targetAudience}`,
            aspectRatio: config.format,
            quality: config.quality
          });
        } catch (vidErr: any) {
          console.error(`[Video Gen Error] Falha no Wan 2.1 para variação ${i}:`, vidErr.message);
        }
      }

      visualCreatives.push({
        campaignId,
        type: isVideo ? "VIDEO" : "IMAGE",
        provider: isVideo ? "Wan 2.1 / S2V" : "OpenAI / DALL-E 3 (Fallback)",
        model: config.quality === "premium" ? "wan-pro-4k" : "wan-fast",
        prompt: `Conceito Visual ${i+1}: ${config.tone}`,
        outputUrl: finalMediaUrl,
        status: "COMPLETED",
        creditsUsed: config.costPerVariation,
        aspectRatio: config.format
      });
    }

    await db.creative.createMany({ data: visualCreatives });

    await db.campaign.update({
      where: { id: campaignId },
      data: { status: "COMPLETED" }
    });

  } catch (e) {
    console.error("Async Gen Error", e);
    await db.campaign.update({
      where: { id: campaignId },
      data: { status: "FAILED" }
    });
  }
}
