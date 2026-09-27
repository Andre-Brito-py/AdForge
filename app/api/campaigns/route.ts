import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/route";
import { db } from "@/lib/db";
import { consumeCredits } from "@/services/credits";
import { generateCampaignStrategy } from "@/services/ai/text";

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

    // 1. Calcular Custo Dinâmico
    const config = await db.systemConfig.findUnique({ where: { id: "global" } });
    let costs = { image: 3, video: 10, text: 1 };
    if (config?.aiCostsJson) {
      try { costs = { ...costs, ...JSON.parse(config.aiCostsJson) }; } catch(e){}
    }

    // O custo total da campanha será o custo da variação multiplicada
    const baseCost = platform.includes("Video") || platform.includes("Reels") ? costs.video : costs.image;
    const costPerVariation = quality === "premium" ? baseCost * 2 : baseCost;
    const totalCost = variations * costPerVariation;

    // 2. Deduzir Créditos (Isso já joga erro se não tiver saldo)
    try {
      await consumeCredits({
        userId: session.user.id,
        workspaceId: workspaceMember.workspaceId,
        operation: `CAMPAIGN_GENERATION_${variations}X`,
        provider: "Internal",
        model: "Multi",
        creditsToConsume: totalCost,
        estimatedCost: totalCost * 0.01
      });
    } catch (e: any) {
      return NextResponse.json({ error: e.message || "Saldo Insuficiente" }, { status: 402 });
    }

    // 3. Criar Campanha no banco (Status = GENERATING)
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

    // 4. Vamos iniciar o processamento de forma Assíncrona "falsa"
    // (Em Next.js serverless, promises flutuantes podem morrer, mas localmente vai funcionar. 
    // Em PROD usaríamos um webhook ou fila. Vamos manter simples para o MVP.)
    
    // Dispara e esquece
    generateCreativesAsync(campaign.id, product, { objective, tone: style, targetAudience, variations, format, platform, quality, costPerVariation }).catch(console.error);

    return NextResponse.json({ success: true, id: campaign.id });
  } catch (error) {
    console.error("Create campaign error:", error);
    return NextResponse.json({ error: "Failed to create campaign" }, { status: 500 });
  }
}

async function generateCreativesAsync(campaignId: string, product: any, config: any) {
  try {
    // A. Chamar Gemini para Textos
    const strategy = await generateCampaignStrategy(
      product.originalImageUrl,
      product.name,
      config.objective,
      config.tone,
      config.targetAudience || "Público Geral"
    );

    const copies = strategy.copies.slice(0, config.variations).map((copy: string) => ({
      campaignId,
      type: "COPY",
      provider: "gemini-2.5-flash",
      model: "text",
      prompt: "Estratégia",
      outputUrl: copy,
      status: "COMPLETED",
      creditsUsed: 1,
    }));
    await db.creative.createMany({ data: copies });

    // B. Criar stubs (placeholders) para Imagens/Videos
    // Se o OVI falhar (ou se configurado assim), usaremos DALL-E da OpenAI
    const visualProvider = config.openAiKey ? "OpenAI / DALL-E 3 (Fallback)" : "OVI / SDXL";

    const visuals = Array.from({ length: config.variations }).map((_, i) => ({
      campaignId,
      type: config.platform.includes("Video") || config.platform.includes("Reels") ? "VIDEO" : "IMAGE",
      provider: visualProvider,
      model: config.quality === "premium" ? "flux-pro-4k" : "sdxl-fast",
      prompt: `Conceito Visual ${i+1}: ${config.tone}`,
      outputUrl: product.originalImageUrl, // Para o MVP, mockamos com a própria foto do produto
      status: "COMPLETED",
      creditsUsed: config.costPerVariation,
      aspectRatio: config.format
    }));
    await db.creative.createMany({ data: visuals });

    // C. Concluir Campanha
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
