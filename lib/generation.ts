import { waitUntil } from "@vercel/functions";
import { randomUUID } from "crypto";
import { db } from "./db";
import { getAppConfig } from "./config";
import { PLATFORMS, STYLES, costPerVariation, type PlatformKey, type QualityKey, type StyleKey } from "./catalog";
import { externallyReachableUrl, fetchMedia, IMAGE_TYPES, readOwnMedia, saveFile, type ImageMime } from "./storage";
import { HttpError } from "./api";
import { consumeCredits, getWorkspaceBalance, grantCredits, InsufficientCreditsError } from "@/services/credits";
import { generateCampaignStrategy, AiUnavailableError, PolicyViolationError } from "@/services/ai/text";
import { generateAdImage } from "@/services/ai/image";
import { buildVideoPrompt, checkVideo, submitVideo, type FalRequest } from "@/services/ai/video";
import { generateNarration } from "@/services/ai/audio";
import { sendCampaignReadyEmail } from "@/services/email";
import type { SessionUser } from "./auth";
import type { z } from "zod";
import type { campaignSchema } from "./validation";

const MAX_ATTEMPTS = 2;
const STALE_PENDING_MS = 90_000;
const STALE_PROCESSING_MS = 5 * 60_000;
const VIDEO_TIMEOUT_MS = 25 * 60_000;
const POLL_THROTTLE_MS = 4_000;
const CONCURRENCY = 2;

// ---------------------------------------------------------------------------
// Pré-requisitos
// ---------------------------------------------------------------------------

export async function assertProviderAvailable(platform: PlatformKey) {
  const { secrets } = await getAppConfig();
  if (!secrets.geminiKey && !secrets.openAiKey) {
    throw new HttpError(503, "A geração está temporariamente indisponível. Tente novamente mais tarde.", "AI_NOT_CONFIGURED");
  }
  if (PLATFORMS[platform].media === "IMAGE" && !secrets.geminiKey) {
    throw new HttpError(503, "A geração de imagens está temporariamente indisponível.", "IMAGE_NOT_CONFIGURED");
  }
  if (PLATFORMS[platform].media === "VIDEO" && !secrets.wanKey) {
    throw new HttpError(503, "A geração de vídeos está temporariamente indisponível.", "VIDEO_NOT_CONFIGURED");
  }
}

async function workspaceOwnerId(workspaceId: string): Promise<string | null> {
  const owner = await db.workspaceMember.findFirst({
    where: { workspaceId },
    orderBy: [{ role: "desc" }, { createdAt: "asc" }],
    select: { userId: true },
  });
  return owner?.userId ?? null;
}

// ---------------------------------------------------------------------------
// Criação de campanha
// ---------------------------------------------------------------------------

export async function createCampaign(user: SessionUser, input: z.infer<typeof campaignSchema>) {
  const product = await db.product.findFirst({ where: { id: input.productId, workspaceId: user.workspaceId } });
  if (!product) throw new HttpError(404, "Produto não encontrado");

  await assertProviderAvailable(input.platform);

  // Foto removida do armazenamento: mensagem clara em vez de "erro interno".
  await readOwnMedia(product.originalImageUrl).catch(() => {
    throw new HttpError(422, "Não conseguimos abrir a foto deste produto. Cadastre o produto novamente com a foto.", "PRODUCT_IMAGE_MISSING");
  });

  const config = await getAppConfig();
  const unitCost = costPerVariation(config.costs, input.platform, input.quality);
  const totalCost = unitCost * input.variations;

  // Checagem rápida antes de gastar uma chamada de IA (a cobrança real é atômica mais abaixo).
  if ((await getWorkspaceBalance(user.workspaceId)) < totalCost) {
    throw new HttpError(402, "Saldo de créditos insuficiente", "INSUFFICIENT_CREDITS");
  }

  const brand = await db.brandKit.findUnique({ where: { workspaceId: user.workspaceId } });

  let strategy;
  try {
    strategy = await generateCampaignStrategy({
      imageUrl: product.originalImageUrl,
      productName: product.name,
      productDescription: product.description,
      objective: input.objective,
      platform: input.platform,
      style: input.style,
      targetAudience: input.targetAudience || product.targetAudience,
      offer: input.offer,
      variations: input.variations,
      brand,
    });
  } catch (error) {
    if (error instanceof PolicyViolationError) {
      throw new HttpError(422, `Não podemos gerar esta campanha: ${error.message} A plataforma é exclusiva para anúncios de produtos e serviços legítimos.`, "POLICY_VIOLATION");
    }
    if (error instanceof AiUnavailableError) throw new HttpError(503, error.message, "AI_UNAVAILABLE");
    throw error;
  }

  const media = PLATFORMS[input.platform].media;
  const aspectRatio = PLATFORMS[input.platform].aspectRatio;
  const campaignId = randomUUID();
  const jobIds: string[] = [];

  try {
    await db.$transaction(async (tx) => {
      await consumeCredits(
        {
          workspaceId: user.workspaceId,
          userId: user.id,
          amount: totalCost,
          description: `Campanha: ${input.variations}x ${media === "VIDEO" ? "vídeo" : "imagem"} (${input.quality})`,
          referenceId: campaignId,
          usage: {
            operation: `CAMPAIGN_${media}_${input.quality.toUpperCase()}`,
            provider: media === "VIDEO" ? "fal.ai" : "gemini",
            model: media === "VIDEO" ? config.models.video : config.models.image,
            estimatedCostUsd: input.variations * (media === "VIDEO" ? 0.25 : 0.04),
          },
        },
        tx
      );

      await tx.campaign.create({
        data: {
          id: campaignId,
          workspaceId: user.workspaceId,
          productId: product.id,
          userId: user.id,
          name: input.name || `${product.name} · ${PLATFORMS[input.platform].label}`,
          objective: input.objective,
          tone: input.style,
          style: input.style,
          targetAudience: input.targetAudience,
          offer: input.offer,
          platform: input.platform,
          format: aspectRatio,
          quality: input.quality,
          variations: input.variations,
          strategyJson: JSON.stringify(strategy),
          creditsCharged: totalCost,
          status: "GENERATING",
        },
      });

      for (let i = 0; i < input.variations; i++) {
        const variant = strategy.variants[i];
        await tx.creative.create({
          data: {
            campaignId,
            type: "COPY",
            variantIndex: i,
            provider: "llm",
            model: config.models.text,
            headline: variant.headline,
            text: variant.copy,
            cta: variant.cta,
            status: "COMPLETED",
          },
        });
        const visual = await tx.creative.create({
          data: {
            campaignId,
            type: media,
            variantIndex: i,
            provider: media === "VIDEO" ? "fal.ai" : "gemini",
            model: media === "VIDEO" ? (input.quality === "premium" ? config.models.videoPremium : config.models.video) : (input.quality === "premium" ? config.models.imagePremium : config.models.image),
            prompt: variant.visualConcept,
            aspectRatio,
            creditsUsed: unitCost,
            status: "QUEUED",
            job: { create: { status: "PENDING" } },
          },
          include: { job: true },
        });
        jobIds.push(visual.job!.id);
      }
    });
  } catch (error) {
    if (error instanceof InsufficientCreditsError) throw new HttpError(402, "Saldo de créditos insuficiente", "INSUFFICIENT_CREDITS");
    throw error;
  }

  startJobs(jobIds);
  return { id: campaignId, cost: totalCost };
}

/** Gera mais uma variação visual para uma campanha existente. */
export async function regenerateCreative(user: SessionUser, campaignId: string, baseCreativeId: string | null, instructions: string | null) {
  const campaign = await db.campaign.findFirst({
    where: { id: campaignId, workspaceId: user.workspaceId },
    include: { creatives: true },
  });
  if (!campaign) throw new HttpError(404, "Campanha não encontrada");

  const platform = (campaign.platform && campaign.platform in PLATFORMS ? campaign.platform : null) as PlatformKey | null;
  if (!platform) throw new HttpError(400, "Esta campanha foi criada numa versão antiga e não pode gerar novas variações.");
  await assertProviderAvailable(platform);

  const config = await getAppConfig();
  const quality = (campaign.quality === "premium" ? "premium" : "standard") as QualityKey;
  const cost = costPerVariation(config.costs, platform, quality);
  const media = PLATFORMS[platform].media;

  const visuals = campaign.creatives.filter((c) => c.type === media);
  const base = (baseCreativeId && visuals.find((c) => c.id === baseCreativeId)) || visuals[0];
  if (!base) throw new HttpError(400, "Nenhum criativo base encontrado");

  const nextIndex = Math.max(...campaign.creatives.map((c) => c.variantIndex), 0) + 1;
  const baseCopy = campaign.creatives.find((c) => c.type === "COPY" && c.variantIndex === base.variantIndex);

  let jobId = "";
  try {
    await db.$transaction(async (tx) => {
      await consumeCredits(
        {
          workspaceId: user.workspaceId,
          userId: user.id,
          amount: cost,
          description: `Nova variação de ${media === "VIDEO" ? "vídeo" : "imagem"}`,
          referenceId: campaign.id,
          usage: { operation: `REGENERATE_${media}`, provider: base.provider, model: base.model, estimatedCostUsd: media === "VIDEO" ? 0.25 : 0.04 },
        },
        tx
      );
      if (baseCopy) {
        await tx.creative.create({
          data: {
            campaignId, type: "COPY", variantIndex: nextIndex, provider: baseCopy.provider, model: baseCopy.model,
            headline: baseCopy.headline, text: baseCopy.text, cta: baseCopy.cta, status: "COMPLETED",
          },
        });
      }
      const created = await tx.creative.create({
        data: {
          campaignId,
          type: media,
          variantIndex: nextIndex,
          provider: base.provider,
          model: base.model,
          prompt: instructions ? `${base.prompt}\n[INSTRUCTIONS] ${instructions}` : base.prompt,
          aspectRatio: base.aspectRatio,
          creditsUsed: cost,
          status: "QUEUED",
          job: { create: { status: "PENDING" } },
        },
        include: { job: true },
      });
      jobId = created.job!.id;
      await tx.campaign.update({ where: { id: campaignId }, data: { status: "GENERATING", creditsCharged: { increment: cost } } });
    });
  } catch (error) {
    if (error instanceof InsufficientCreditsError) throw new HttpError(402, "Saldo de créditos insuficiente", "INSUFFICIENT_CREDITS");
    throw error;
  }

  startJobs([jobId]);
  return { cost };
}

// ---------------------------------------------------------------------------
// Execução dos jobs
// ---------------------------------------------------------------------------

/** Executa jobs em segundo plano sem bloquear a resposta HTTP (Vercel waitUntil). */
export function startJobs(jobIds: string[]) {
  if (jobIds.length === 0) return;
  waitUntil(runJobs(jobIds).catch((e) => console.error("[generation] runJobs", e)));
}

async function runJobs(jobIds: string[]) {
  const queue = [...jobIds];
  const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
    while (queue.length) {
      const id = queue.shift()!;
      await runJob(id);
    }
  });
  await Promise.all(workers);
}

async function loadJob(jobId: string) {
  return db.generationJob.findUnique({
    where: { id: jobId },
    include: { creative: { include: { campaign: { include: { product: true } } } } },
  });
}
type LoadedJob = NonNullable<Awaited<ReturnType<typeof loadJob>>>;

function splitPrompt(prompt: string | null) {
  const [concept, extra] = (prompt || "").split("\n[INSTRUCTIONS] ");
  return { concept: concept || "Clean studio product shot", extra: extra || null };
}

export async function runJob(jobId: string): Promise<void> {
  const claimed = await db.generationJob.updateMany({
    where: { id: jobId, status: "PENDING" },
    data: { status: "PROCESSING", attempts: { increment: 1 }, startedAt: new Date(), error: null },
  });
  if (claimed.count === 0) return; // outro worker já pegou

  const job = await loadJob(jobId);
  if (!job) return;
  await db.creative.update({ where: { id: job.creativeId }, data: { status: "PROCESSING" } });

  try {
    if (job.creative.type === "IMAGE") await runImageJob(job);
    else await submitVideoJob(job);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[generation] job ${jobId} tentativa ${job.attempts} falhou:`, message);
    if (job.attempts < MAX_ATTEMPTS) {
      await db.generationJob.update({ where: { id: jobId }, data: { status: "PENDING", error: message.slice(0, 500) } });
      return runJob(jobId);
    }
    await failJob(jobId, message);
  }
}

async function runImageJob(job: LoadedJob) {
  const { creative } = job;
  const campaign = creative.campaign;
  const config = await getAppConfig();
  if (!config.secrets.geminiKey) throw new Error("Gemini não configurado");

  const product = await readOwnMedia(campaign.product.originalImageUrl);
  const brand = await db.brandKit.findUnique({ where: { workspaceId: campaign.workspaceId } });
  const { concept, extra } = splitPrompt(creative.prompt);
  const quality = (campaign.quality === "premium" ? "premium" : "standard") as QualityKey;

  const out = await generateAdImage({
    apiKey: config.secrets.geminiKey,
    model: creative.model,
    fallbackModel: config.models.image,
    product,
    concept,
    styleLabel: STYLES[(campaign.style as StyleKey) || "STUDIO"] || campaign.style || "Studio",
    aspectRatio: creative.aspectRatio || "1:1",
    quality,
    brandColor: brand?.primaryColor,
    extraInstructions: extra,
  });

  const ext = IMAGE_TYPES[out.mimeType as ImageMime] || "png";
  const url = await saveFile(out.buffer, `creatives/${campaign.workspaceId}/${campaign.id}/${creative.id}.${ext}`, out.mimeType);

  await db.$transaction([
    db.creative.update({ where: { id: creative.id }, data: { status: "COMPLETED", outputUrl: url, model: out.model } }),
    db.generationJob.update({ where: { id: job.id }, data: { status: "COMPLETED", completedAt: new Date() } }),
  ]);
  await maybeFinalizeCampaign(campaign.id);
}

async function submitVideoJob(job: LoadedJob) {
  const { creative } = job;
  const campaign = creative.campaign;
  const config = await getAppConfig();
  if (!config.secrets.wanKey) throw new Error("fal.ai não configurado");

  // Locução é um extra: se falhar, o vídeo continua.
  if (!creative.audioUrl) {
    const copy = await db.creative.findFirst({ where: { campaignId: campaign.id, type: "COPY", variantIndex: creative.variantIndex } });
    try {
      const audioUrl = await generateNarration(copy?.text || "", config.secrets, campaign.workspaceId);
      if (audioUrl) await db.creative.update({ where: { id: creative.id }, data: { audioUrl } });
    } catch (error) {
      console.warn("[generation] locução falhou (seguindo sem áudio)", error);
    }
  }

  const { concept, extra } = splitPrompt(creative.prompt);
  const request = await submitVideo({
    falKey: config.secrets.wanKey,
    model: creative.model,
    imageUrl: await externallyReachableUrl(campaign.product.originalImageUrl),
    prompt: buildVideoPrompt(concept, STYLES[campaign.style as StyleKey] || campaign.style || "Cinematic", extra),
    aspectRatio: creative.aspectRatio || "9:16",
    premium: campaign.quality === "premium",
  });
  await db.generationJob.update({ where: { id: job.id }, data: { externalData: JSON.stringify(request) } });
}

async function pollVideoJob(job: LoadedJob) {
  const config = await getAppConfig();
  if (!config.secrets.wanKey) return;
  const request = JSON.parse(job.externalData!) as FalRequest;
  const status = await checkVideo(config.secrets.wanKey, request);

  if (status.state === "pending") {
    await db.generationJob.update({ where: { id: job.id }, data: { status: "PROCESSING" } }); // atualiza updatedAt
    return;
  }
  if (status.state === "failed") return failJob(job.id, status.error);

  const media = await fetchMedia(status.videoUrl);
  const campaign = job.creative.campaign;
  const url = await saveFile(media.buffer, `creatives/${campaign.workspaceId}/${campaign.id}/${job.creativeId}.mp4`, "video/mp4");
  const done = await db.generationJob.updateMany({
    where: { id: job.id, status: "PROCESSING" },
    data: { status: "COMPLETED", completedAt: new Date() },
  });
  if (done.count === 1) {
    await db.creative.update({ where: { id: job.creativeId }, data: { status: "COMPLETED", outputUrl: url, duration: 5 } });
  }
  await maybeFinalizeCampaign(campaign.id);
}

/** Marca o job como falho e devolve os créditos daquele criativo (idempotente). */
async function failJob(jobId: string, error: string) {
  const job = await loadJob(jobId);
  if (!job) return;
  const campaign = job.creative.campaign;
  const userId = campaign.userId || (await workspaceOwnerId(campaign.workspaceId));

  await db.$transaction(async (tx) => {
    const res = await tx.generationJob.updateMany({
      where: { id: jobId, refunded: false },
      data: { status: "FAILED", error: error.slice(0, 500), refunded: true, completedAt: new Date() },
    });
    await tx.creative.update({ where: { id: job.creativeId }, data: { status: "FAILED" } });
    if (res.count === 1 && job.creative.creditsUsed > 0 && userId) {
      await grantCredits(
        {
          workspaceId: campaign.workspaceId,
          userId,
          amount: job.creative.creditsUsed,
          type: "REFUND",
          description: "Estorno automático: falha na geração",
          referenceId: job.creativeId,
        },
        tx
      );
    }
  });
  await maybeFinalizeCampaign(campaign.id);
}

async function maybeFinalizeCampaign(campaignId: string) {
  const visuals = await db.creative.findMany({
    where: { campaignId, type: { in: ["IMAGE", "VIDEO"] } },
    select: { status: true },
  });
  if (visuals.length === 0 || visuals.some((v) => v.status !== "COMPLETED" && v.status !== "FAILED")) return;

  const failed = visuals.filter((v) => v.status === "FAILED").length;
  const status = failed === 0 ? "COMPLETED" : failed === visuals.length ? "FAILED" : "PARTIAL";
  const updated = await db.campaign.updateMany({ where: { id: campaignId, status: "GENERATING" }, data: { status } });
  if (updated.count === 0) return;

  // Notifica só na primeira conclusão (não a cada nova variação).
  const notify = await db.campaign.updateMany({ where: { id: campaignId, notifiedAt: null }, data: { notifiedAt: new Date() } });
  if (notify.count === 0) return;
  const campaign = await db.campaign.findUnique({ where: { id: campaignId } });
  const user = campaign?.userId ? await db.user.findUnique({ where: { id: campaign.userId } }) : null;
  if (campaign && user?.notifyOnComplete) {
    await sendCampaignReadyEmail(user.email, campaign.name, campaign.id, failed).catch(console.error);
  }
}

/**
 * Avança o estado de uma campanha: consulta vídeos na fal.ai e reinicia jobs
 * que ficaram parados (ex.: a função serverless foi encerrada no meio).
 * Chamado pelo polling da tela de progresso e pelo cron.
 */
export async function advanceCampaign(campaignId: string) {
  const jobs = await db.generationJob.findMany({
    where: { creative: { campaignId }, status: { in: ["PENDING", "PROCESSING"] } },
    include: { creative: { include: { campaign: { include: { product: true } } } } },
  });
  const now = Date.now();
  const restart: string[] = [];

  for (const job of jobs) {
    const idle = now - job.updatedAt.getTime();
    try {
      if (job.status === "PROCESSING" && job.externalData) {
        if (job.startedAt && now - job.startedAt.getTime() > VIDEO_TIMEOUT_MS) {
          await failJob(job.id, "Tempo limite de geração excedido");
        } else if (idle > POLL_THROTTLE_MS) {
          await pollVideoJob(job);
        }
      } else if (job.status === "PROCESSING" && idle > STALE_PROCESSING_MS) {
        if (job.attempts < MAX_ATTEMPTS) {
          await db.generationJob.update({ where: { id: job.id }, data: { status: "PENDING" } });
          restart.push(job.id);
        } else {
          await failJob(job.id, "A geração foi interrompida");
        }
      } else if (job.status === "PENDING" && idle > STALE_PENDING_MS) {
        restart.push(job.id);
      }
    } catch (error) {
      console.error(`[generation] advance job ${job.id}`, error);
    }
  }

  startJobs(restart);
  await maybeFinalizeCampaign(campaignId);
}

/** Usado pelo cron: avança campanhas que ainda estão gerando. */
export async function advanceAllPending(limit = 25) {
  const campaigns = await db.campaign.findMany({
    where: { status: "GENERATING" },
    orderBy: { updatedAt: "asc" },
    take: limit,
    select: { id: true },
  });
  for (const c of campaigns) await advanceCampaign(c.id);
  return campaigns.length;
}
