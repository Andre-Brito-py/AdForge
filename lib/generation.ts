import { waitUntil } from "@vercel/functions";
import { randomUUID } from "crypto";
import { db } from "./db";
import { getAppConfig } from "./config";
import { PLATFORMS, STYLES, VIDEO_SEGMENT_SECONDS, costPerVariation, videoSegments, type PlatformKey, type QualityKey, type StyleKey } from "./catalog";
import { deletePrefix, externallyReachableUrl, fetchMedia, IMAGE_TYPES, isOwnStorageUrl, readOwnMedia, saveFile, type ImageMime } from "./storage";
import { HttpError } from "./api";
import { defaultAdLanguage } from "./locale";
import { isClaimed, parseReferences, parseVideoProgress, parseVideoSpec, serializeVideoSpec, type VideoProgress, type VideoSpec } from "./video-plan";
import { assembleVideo, lastFrame } from "./video-assembly";
import { applyLogoToImage, loadLogoPng } from "./brand-assets";
import { buildImageRightsRecord } from "./image-rights";
import { consumeCredits, getWorkspaceBalance, grantCredits, InsufficientCreditsError } from "@/services/credits";
import { generateCampaignStrategy, checkInstructionsScope, AiUnavailableError, OutOfScopeError, PolicyViolationError } from "@/services/ai/text";
import { generateAdImage } from "@/services/ai/image";
import { buildVideoPrompt, checkVideo, submitVideo } from "@/services/ai/video";
import { generateNarration } from "@/services/ai/audio";
import { sendCampaignReadyEmail } from "@/services/email";
import { txDescription } from "./generation-text";
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
    throw new HttpError(503, "errors.aiUnavailable", "AI_NOT_CONFIGURED");
  }
  if (PLATFORMS[platform].media === "IMAGE" && !secrets.geminiKey) {
    throw new HttpError(503, "errors.imageUnavailable", "IMAGE_NOT_CONFIGURED");
  }
  if (PLATFORMS[platform].media === "VIDEO" && !secrets.wanKey) {
    throw new HttpError(503, "errors.videoUnavailable", "VIDEO_NOT_CONFIGURED");
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

export async function createCampaign(
  user: SessionUser,
  input: z.infer<typeof campaignSchema>,
  fingerprint: { ipAddress: string | null; userAgent: string | null } = { ipAddress: null, userAgent: null }
) {
  const product = await db.product.findFirst({ where: { id: input.productId, workspaceId: user.workspaceId } });
  if (!product) throw new HttpError(404, "errors.productNotFound");

  await assertProviderAvailable(input.platform);

  // Foto removida do armazenamento: mensagem clara em vez de "erro interno".
  await readOwnMedia(product.originalImageUrl).catch(() => {
    throw new HttpError(422, "errors.productImageMissing", "PRODUCT_IMAGE_MISSING");
  });

  // Imagens de referência: só do nosso armazenamento (vieram do upload, que já passou pela moderação).
  const references = [...new Set(input.references)];
  const referenceFiles: { url: string; buffer: Buffer }[] = [];
  for (const url of references) {
    if (!isOwnStorageUrl(url)) throw new HttpError(400, "errors.referenceMissing", "REFERENCE_INVALID");
    const media = await readOwnMedia(url).catch(() => {
      throw new HttpError(422, "errors.referenceMissing", "REFERENCE_MISSING");
    });
    referenceFiles.push({ url, buffer: media.buffer });
  }
  // Juntar produto + referências num quadro exige o modelo de imagem (também nos vídeos).
  if (references.length > 0 && !(await getAppConfig()).secrets.geminiKey) {
    throw new HttpError(503, "errors.referencesNeedImageAi", "REFERENCES_NEED_IMAGE_AI");
  }

  const config = await getAppConfig();
  const media = PLATFORMS[input.platform].media;
  const videoDuration = media === "VIDEO" ? input.videoDuration : VIDEO_SEGMENT_SECONDS;
  const unitCost = costPerVariation(config.costs, input.platform, input.quality, videoDuration);
  const totalCost = unitCost * input.variations;

  // Checagem rápida antes de gastar uma chamada de IA (a cobrança real é atômica mais abaixo).
  if ((await getWorkspaceBalance(user.workspaceId)) < totalCost) {
    throw new HttpError(402, "errors.insufficientCredits", "INSUFFICIENT_CREDITS");
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
      language: input.language,
      fallbackLanguage: defaultAdLanguage(user.locale === "en" ? "en" : "pt", user.country),
      briefing: input.briefing,
      referenceUrls: references,
      videoDuration,
      uiLocale: user.locale === "en" ? "en" : "pt",
      brand,
    });
  } catch (error) {
    throw toHttpAiError(error);
  }

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
          description: txDescription(user.locale, "campaign", { n: input.variations, media, quality: input.quality }),
          referenceId: campaignId,
          usage: {
            operation: `CAMPAIGN_${media}_${input.quality.toUpperCase()}`,
            provider: media === "VIDEO" ? "fal.ai" : "gemini",
            model: media === "VIDEO" ? config.models.video : config.models.image,
            estimatedCostUsd: input.variations * (media === "VIDEO" ? 0.25 * videoSegments(videoDuration) : 0.04),
          },
        },
        tx
      );

      const campaignName = input.name || `${product.name} · ${PLATFORMS[input.platform].label}`;
      await tx.campaign.create({
        data: {
          id: campaignId,
          workspaceId: user.workspaceId,
          productId: product.id,
          userId: user.id,
          name: campaignName,
          objective: input.objective,
          tone: input.style,
          style: input.style,
          targetAudience: input.targetAudience,
          offer: input.offer,
          platform: input.platform,
          format: aspectRatio,
          quality: input.quality,
          language: strategy.language,
          briefing: input.briefing,
          videoDuration,
          // Só vale se o Brand Kit tiver logo (o cliente pode ter apagado depois de abrir o assistente).
          applyLogo: input.applyLogo && !!brand?.logoUrl,
          referencesJson: references.length ? JSON.stringify(references) : null,
          imageRightsConfirmedAt: references.length ? new Date() : null,
          variations: input.variations,
          strategyJson: JSON.stringify(strategy),
          creditsCharged: totalCost,
          status: "GENERATING",
        },
      });

      // Prova da declaração de autorização de imagem (na mesma transação: não existe campanha sem ela).
      if (referenceFiles.length > 0) {
        await tx.imageRightsRecord.create({
          data: buildImageRightsRecord({ user, campaign: { id: campaignId, name: campaignName }, images: referenceFiles, fingerprint }),
        });
      }

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
            prompt: media === "VIDEO"
              ? serializeVideoSpec({ scenes: variant.scenes, voiceover: variant.voiceover, keyframe: references.length ? variant.keyframe || variant.visualConcept : null })
              : variant.visualConcept,
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
    if (error instanceof InsufficientCreditsError) throw new HttpError(402, "errors.insufficientCredits", "INSUFFICIENT_CREDITS");
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
  if (!campaign) throw new HttpError(404, "errors.campaignNotFound");

  const platform = (campaign.platform && campaign.platform in PLATFORMS ? campaign.platform : null) as PlatformKey | null;
  if (!platform) throw new HttpError(400, "errors.legacyCampaign");
  await assertProviderAvailable(platform);

  const config = await getAppConfig();
  const quality = (campaign.quality === "premium" ? "premium" : "standard") as QualityKey;
  const media = PLATFORMS[platform].media;
  const cost = costPerVariation(config.costs, platform, quality, campaign.videoDuration);

  // Instruções livres passam pela mesma moderação de escopo/conteúdo, antes de cobrar.
  if (instructions) {
    try {
      await checkInstructionsScope(instructions, user.locale === "en" ? "en" : "pt");
    } catch (error) {
      throw toHttpAiError(error);
    }
  }

  const visuals = campaign.creatives.filter((c) => c.type === media);
  const base = (baseCreativeId && visuals.find((c) => c.id === baseCreativeId)) || visuals[0];
  if (!base) throw new HttpError(400, "errors.noBaseCreative");

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
          description: txDescription(user.locale, "variation", { media }),
          referenceId: campaign.id,
          usage: { operation: `REGENERATE_${media}`, provider: base.provider, model: base.model, estimatedCostUsd: media === "VIDEO" ? 0.25 * videoSegments(campaign.videoDuration) : 0.04 },
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
          prompt: media === "VIDEO"
            ? serializeVideoSpec({ ...parseVideoSpec(base.prompt, baseCopy?.text || ""), ...(instructions ? { extra: instructions } : {}) })
            : instructions ? `${splitPrompt(base.prompt).concept}\n[INSTRUCTIONS] ${instructions}` : base.prompt,
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
    if (error instanceof InsufficientCreditsError) throw new HttpError(402, "errors.insufficientCredits", "INSUFFICIENT_CREDITS");
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
    references: await loadReferences(campaign.referencesJson),
  });

  let final: { buffer: Buffer; mimeType: string } = out;
  if (campaign.applyLogo && brand?.logoUrl) {
    // Logo é um acabamento: se falhar (arquivo apagado, formato estranho), entrega sem ele.
    try {
      const logo = await loadLogoPng(brand.logoUrl);
      if (logo) final = await applyLogoToImage(out, logo);
    } catch (error) {
      console.warn("[generation] não foi possível aplicar o logo na imagem", error);
    }
  }

  const ext = IMAGE_TYPES[final.mimeType as ImageMime] || "png";
  const url = await saveFile(final.buffer, `creatives/${campaign.workspaceId}/${campaign.id}/${creative.id}.${ext}`, final.mimeType);

  await db.$transaction([
    db.creative.update({ where: { id: creative.id }, data: { status: "COMPLETED", outputUrl: url, model: out.model } }),
    db.generationJob.update({ where: { id: job.id }, data: { status: "COMPLETED", completedAt: new Date() } }),
  ]);
  await maybeFinalizeCampaign(campaign.id);
}

/** Imagens de referência da campanha, lidas do armazenamento (as que sumiram são ignoradas). */
async function loadReferences(json: string | null): Promise<{ buffer: Buffer; mimeType: string }[]> {
  const urls = parseReferences(json);
  const loaded = await Promise.all(urls.map((u) => readOwnMedia(u).catch(() => null)));
  return loaded.filter((m): m is { buffer: Buffer; mimeType: string } => !!m);
}

// --- Vídeo: um trecho de 5 s por cena; cada trecho parte do último quadro do anterior. ---

async function videoSpecFor(job: LoadedJob) {
  const copy = await db.creative.findFirst({ where: { campaignId: job.creative.campaignId, type: "COPY", variantIndex: job.creative.variantIndex } });
  return parseVideoSpec(job.creative.prompt, copy?.text || "");
}

/** Pasta dos arquivos intermediários (trechos e quadros), apagada quando o vídeo final fica pronto. */
function workDir(job: LoadedJob) {
  const c = job.creative.campaign;
  return `creatives/${c.workspaceId}/${c.id}/${job.creativeId}-parts/`;
}

async function submitSegment(job: LoadedJob, spec: VideoSpec, index: number, imageUrl: string) {
  const config = await getAppConfig();
  if (!config.secrets.wanKey) throw new Error("fal.ai não configurado");
  const campaign = job.creative.campaign;
  const brand = await db.brandKit.findUnique({ where: { workspaceId: campaign.workspaceId }, select: { primaryColor: true } });
  return submitVideo({
    falKey: config.secrets.wanKey,
    model: job.creative.model,
    imageUrl,
    prompt: buildVideoPrompt(spec.scenes[index], STYLES[campaign.style as StyleKey] || campaign.style || "Cinematic", spec.extra, { index, total: spec.scenes.length }, brand?.primaryColor),
    aspectRatio: job.creative.aspectRatio || "9:16",
    premium: campaign.quality === "premium",
  });
}

async function submitVideoJob(job: LoadedJob) {
  const { creative } = job;
  const campaign = creative.campaign;
  const config = await getAppConfig();
  if (!config.secrets.wanKey) throw new Error("fal.ai não configurado");
  const spec = await videoSpecFor(job);

  // Locução no idioma do anúncio. É um extra: se falhar, o vídeo sai sem áudio.
  if (!creative.audioUrl) {
    try {
      const audioUrl = await generateNarration(spec.voiceover, config.secrets, campaign.workspaceId);
      if (audioUrl) await db.creative.update({ where: { id: creative.id }, data: { audioUrl } });
    } catch (error) {
      console.warn("[generation] locução falhou (seguindo sem áudio)", error);
    }
  }

  // Com imagens de referência, o vídeo começa num quadro composto (ex.: a modelo da imagem 2 com a garrafa da
  // imagem 1), gerado pelo modelo de imagem; sem elas, a foto do produto é animada diretamente.
  let startImage = campaign.product.originalImageUrl;
  const references = await loadReferences(campaign.referencesJson);
  if (references.length > 0) {
    if (!config.secrets.geminiKey) throw new Error("Gemini não configurado (necessário para juntar as imagens de referência)");
    const brand = await db.brandKit.findUnique({ where: { workspaceId: campaign.workspaceId }, select: { primaryColor: true } });
    const frame = await generateAdImage({
      apiKey: config.secrets.geminiKey,
      model: campaign.quality === "premium" ? config.models.imagePremium : config.models.image,
      fallbackModel: config.models.image,
      product: await readOwnMedia(campaign.product.originalImageUrl),
      references,
      concept: spec.keyframe || spec.scenes[0],
      styleLabel: STYLES[campaign.style as StyleKey] || campaign.style || "Cinematic",
      aspectRatio: creative.aspectRatio || "9:16",
      quality: campaign.quality === "premium" ? "premium" : "standard",
      brandColor: brand?.primaryColor,
      extraInstructions: spec.extra,
    });
    startImage = await saveFile(frame.buffer, `${workDir(job)}keyframe.${IMAGE_TYPES[frame.mimeType as ImageMime] || "png"}`, frame.mimeType);
  }

  const request = await submitSegment(job, spec, 0, await externallyReachableUrl(startImage));
  const progress: VideoProgress = { v: 2, total: spec.scenes.length, done: [], current: request, segmentStartedAt: Date.now() };
  await db.generationJob.update({ where: { id: job.id }, data: { externalData: JSON.stringify(progress) } });
}

async function pollVideoJob(job: LoadedJob) {
  const config = await getAppConfig();
  if (!config.secrets.wanKey) return;
  const raw = job.externalData!;
  const progress = parseVideoProgress(raw, job.startedAt?.getTime() ?? Date.now());
  if (!progress) return failJob(job.id, "Estado do vídeo inválido");
  if (isClaimed(progress)) return; // outro worker está unindo/enviando o próximo trecho

  if (Date.now() - progress.segmentStartedAt > VIDEO_TIMEOUT_MS) return failJob(job.id, "Tempo limite de geração excedido");

  let finishedUrl: string | null = null;
  if (progress.current) {
    const status = await checkVideo(config.secrets.wanKey, progress.current);
    if (status.state === "pending") {
      await db.generationJob.update({ where: { id: job.id }, data: { status: "PROCESSING" } }); // atualiza updatedAt
      return;
    }
    if (status.state === "failed") return failJob(job.id, status.error);
    finishedUrl = status.videoUrl;
  }

  // Trava otimista: só quem conseguir trocar o estado exato que leu segue adiante.
  const claimed = await db.generationJob.updateMany({
    where: { id: job.id, status: "PROCESSING", externalData: raw },
    data: { externalData: JSON.stringify({ ...progress, claimedAt: Date.now() }) },
  });
  if (claimed.count === 0) return;

  const spec = await videoSpecFor(job);
  const dir = workDir(job);
  const done = [...progress.done];
  let lastBuffer: Buffer | null = null;
  if (finishedUrl) {
    lastBuffer = (await fetchMedia(finishedUrl)).buffer;
    done.push(await saveFile(lastBuffer, `${dir}seg-${done.length}.mp4`, "video/mp4"));
  }

  // Ainda faltam cenas: o próximo trecho começa exatamente onde este terminou.
  if (done.length < progress.total) {
    const previous = lastBuffer ?? (await readOwnMedia(done[done.length - 1])).buffer;
    const frameUrl = await saveFile(await lastFrame(previous), `${dir}frame-${done.length}.png`, "image/png");
    const request = await submitSegment(job, spec, done.length, await externallyReachableUrl(frameUrl));
    const next: VideoProgress = { v: 2, total: progress.total, done, current: request, segmentStartedAt: Date.now() };
    await db.generationJob.update({ where: { id: job.id }, data: { externalData: JSON.stringify(next) } });
    return;
  }

  // Todas as cenas prontas: une os trechos e coloca a locução num único MP4.
  const segments = await Promise.all(done.map(async (url, i) => (i === done.length - 1 && lastBuffer ? lastBuffer : (await readOwnMedia(url)).buffer)));
  const fresh = await db.creative.findUnique({ where: { id: job.creativeId }, select: { audioUrl: true } });
  const narration = fresh?.audioUrl ? await readOwnMedia(fresh.audioUrl).then((m) => m.buffer).catch(() => null) : null;
  const campaign = job.creative.campaign;
  let logo: Buffer | null = null;
  if (campaign.applyLogo) {
    const brand = await db.brandKit.findUnique({ where: { workspaceId: campaign.workspaceId }, select: { logoUrl: true } });
    logo = await loadLogoPng(brand?.logoUrl).catch((e) => {
      console.warn("[generation] não foi possível carregar o logo para o vídeo", e);
      return null;
    });
  }
  const final = await assembleVideo(segments, narration, logo);

  const url = await saveFile(final.buffer, `creatives/${campaign.workspaceId}/${campaign.id}/${job.creativeId}.mp4`, "video/mp4");
  const completed = await db.generationJob.updateMany({
    where: { id: job.id, status: "PROCESSING" },
    data: { status: "COMPLETED", completedAt: new Date(), externalData: JSON.stringify({ ...progress, done, current: null, claimedAt: undefined }) },
  });
  if (completed.count === 1) {
    await db.creative.update({ where: { id: job.creativeId }, data: { status: "COMPLETED", outputUrl: url, duration: final.duration } });
    await deletePrefix(dir).catch((e) => console.warn("[generation] limpeza dos trechos falhou", e));
  }
  await maybeFinalizeCampaign(campaign.id);
}

/** Converte erros da IA de texto em respostas HTTP (Vy mostra a recusa de escopo/conteúdo). */
function toHttpAiError(error: unknown) {
  if (error instanceof OutOfScopeError) return new HttpError(422, "errors.outOfScope", "OUT_OF_SCOPE", { reason: error.message });
  if (error instanceof PolicyViolationError) return new HttpError(422, "errors.policyViolation", "POLICY_VIOLATION", { reason: error.message });
  if (error instanceof AiUnavailableError) return new HttpError(503, "errors.aiUnavailable", "AI_UNAVAILABLE");
  return error;
}

/** Marca o job como falho e devolve os créditos daquele criativo (idempotente). */
async function failJob(jobId: string, error: string) {
  const job = await loadJob(jobId);
  if (!job) return;
  const campaign = job.creative.campaign;
  const userId = campaign.userId || (await workspaceOwnerId(campaign.workspaceId));

  const owner = userId ? await db.user.findUnique({ where: { id: userId }, select: { locale: true } }) : null;
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
          description: txDescription(owner?.locale, "refund"),
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
    await sendCampaignReadyEmail(user.email, campaign.name, campaign.id, failed, user.locale).catch(console.error);
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
        // O tempo limite agora é por trecho (vídeos longos têm vários), checado dentro do poll.
        if (idle > POLL_THROTTLE_MS) await pollVideoJob(job);
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
