import { waitUntil } from "@vercel/functions";
import { randomUUID } from "crypto";
import { db } from "./db";
import { getAppConfig } from "./config";
import { PLATFORMS, STYLES, VIDEO_SEGMENT_SECONDS, costPerVariation, isSpeakingOnCamera, videoSegments, type PlatformKey, type QualityKey, type StyleKey } from "./catalog";
import { deletePrefix, fetchMedia, IMAGE_TYPES, isOwnStorageUrl, readOwnMedia, saveFile, type ImageMime } from "./storage";
import { HttpError } from "./api";
import { defaultAdLanguage } from "./locale";
import { isClaimed, parseReferences, parseVideoProgress, parseVideoSpec, serializeVideoSpec, type VideoProgress, type VideoSpec } from "./video-plan";
import { assembleVideo, lastFrame, sliceAudio } from "./video-assembly";
import { planVideo, segmentPrompt, videoModelCaps, voiceoverSlice } from "./video-models";
import { submitLipSync } from "@/services/ai/lipsync";
import { falReachableUrl } from "@/services/ai/fal-storage";
import { createKeyframe } from "@/services/ai/keyframe";
import { directMotion } from "@/services/ai/motion";
import { applyLogoToImage, loadLogoPng } from "./brand-assets";
import { hasImageProvider, hasVideoProvider, imageEngine, videoKeys } from "./ai-engine";
import { buildImageRightsRecord } from "./image-rights";
import { consumeCredits, getWorkspaceBalance, grantCredits, InsufficientCreditsError } from "@/services/credits";
import { generateCampaignStrategy, checkInstructionsScope, AiUnavailableError, OutOfScopeError, PolicyViolationError } from "@/services/ai/text";
import { generateAdImage } from "@/services/ai/image";
import { buildVideoPrompt, cancelVideo, checkVideo, submitVideo, type VideoKeys } from "@/services/ai/video";
import { generateNarration } from "@/services/ai/audio";
import { sendCampaignReadyEmail } from "@/services/email";
import { txDescription } from "./generation-text";
import type { SessionUser } from "./auth";
import type { z } from "zod";
import type { campaignSchema } from "./validation";

const MAX_ATTEMPTS = 2;
const STALE_PENDING_MS = 90_000;
const STALE_PROCESSING_MS = 5 * 60_000;
// Por trecho de 5 s. A fila da fal.ai já levou ~35 min num dia carregado; acima disso o trecho é cancelado.
const VIDEO_TIMEOUT_MS = 40 * 60_000;
const POLL_THROTTLE_MS = 4_000;
const CONCURRENCY = 2;

// ---------------------------------------------------------------------------
// Pré-requisitos
// ---------------------------------------------------------------------------

export async function assertProviderAvailable(platform: PlatformKey) {
  const config = await getAppConfig();
  const { secrets } = config;
  if (!secrets.geminiKey && !secrets.openAiKey) {
    throw new HttpError(503, "errors.aiUnavailable", "AI_NOT_CONFIGURED");
  }
  if (PLATFORMS[platform].media === "IMAGE" && !hasImageProvider({ secrets })) {
    throw new HttpError(503, "errors.imageUnavailable", "IMAGE_NOT_CONFIGURED");
  }
  if (PLATFORMS[platform].media === "VIDEO" && !hasVideoProvider(config, config.models.video)) {
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
  if (references.length > 0 && !hasImageProvider(await getAppConfig())) {
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
            provider: media === "VIDEO" ? (videoModelCaps(config.models.video).provider === "veo" ? "google-veo" : "fal.ai") : imageEngine(config, input.quality === "premium").provider,
            model: media === "VIDEO" ? config.models.video : imageEngine(config, input.quality === "premium").label,
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
            provider: media === "VIDEO" ? (videoModelCaps(config.models.video).provider === "veo" ? "google-veo" : "fal.ai") : imageEngine(config, input.quality === "premium").provider,
            model: media === "VIDEO" ? (input.quality === "premium" ? config.models.videoPremium : config.models.video) : imageEngine(config, input.quality === "premium").label,
            prompt: media === "VIDEO"
              ? serializeVideoSpec({
                  scenes: variant.scenes, voiceover: variant.voiceover, keyframe: variant.keyframe || variant.visualConcept,
                  productSize: strategy.productSize, presenter: variant.presenter ?? null,
                })
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
  if (!hasImageProvider(config)) throw new Error("Nenhum provedor de imagem configurado");

  const product = await readOwnMedia(campaign.product.originalImageUrl);
  const brand = await db.brandKit.findUnique({ where: { workspaceId: campaign.workspaceId } });
  const { concept, extra } = splitPrompt(creative.prompt);
  const quality = (campaign.quality === "premium" ? "premium" : "standard") as QualityKey;

  // Provedor (Gemini ou OpenAI) conforme Admin › IA e custos no momento da geração.
  const engine = imageEngine(config, quality === "premium");
  const out = await generateAdImage({
    apiKey: engine.apiKey,
    model: engine.model,
    fallbackModel: engine.fallbackModel,
    openai: engine.openai,
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

/** Falta a chave do provedor do modelo de vídeo (fal.ai ou Gemini/Veo)? Erro claro em vez de falha genérica. */
function assertVideoKey(config: Awaited<ReturnType<typeof getAppConfig>>, model: string) {
  if (!hasVideoProvider(config, model)) {
    throw new Error(videoModelCaps(model).provider === "veo" ? "Gemini não configurado (necessário para o Veo)" : "fal.ai não configurado");
  }
}

/** Durações dos pedidos (vídeos antigos: um trecho de 5 s por cena). */
function segmentsOf(progress: VideoProgress) {
  return progress.segments ?? Array(progress.total).fill(VIDEO_SEGMENT_SECONDS);
}

/** `frameUrl` é o quadro inicial no NOSSO armazenamento (o diretor de movimento precisa vê-lo). */
async function submitSegment(
  job: LoadedJob,
  spec: VideoSpec,
  progress: Pick<VideoProgress, "segments" | "total" | "audioInSegments" | "speaking" | "extend">,
  index: number,
  frameUrl: string,
  /** Modo extensão (Veo): URI do vídeo anterior (gerado pelo Veo), que o modelo vai continuar. */
  previousVideoUri?: string | null
) {
  const config = await getAppConfig();
  const caps = videoModelCaps(job.creative.model);
  assertVideoKey(config, job.creative.model);
  const campaign = job.creative.campaign;
  const brand = await db.brandKit.findUnique({ where: { workspaceId: campaign.workspaceId }, select: { primaryColor: true } });
  const segments = segmentsOf(progress as VideoProgress);
  const start = segments.slice(0, index).reduce((a, b) => a + b, 0);
  const seconds = segments[index];

  // Modelos com lip-sync recebem a parte da locução que cai neste pedido.
  let audioUrl: string | null = null;
  if (progress.audioInSegments) {
    const fresh = await db.creative.findUnique({ where: { id: job.creativeId }, select: { audioUrl: true } });
    const narration = fresh?.audioUrl ? await readOwnMedia(fresh.audioUrl).then((m) => m.buffer).catch(() => null) : null;
    const slice = narration ? await sliceAudio(narration, start, seconds) : null;
    if (slice) audioUrl = await falReachableUrl(config.secrets.wanKey!, await saveFile(slice, `${workDir(job)}voice-${index}.mp3`, "audio/mpeg"));
  }

  const basePrompt = buildVideoPrompt(
    segmentPrompt(spec.scenes, start, seconds),
    STYLES[campaign.style as StyleKey] || campaign.style || "Cinematic",
    spec.extra,
    { index, total: segments.length },
    brand?.primaryColor
  );
  const frame = await readOwnMedia(frameUrl);
  // Diretor de movimento: olha este quadro e escreve um prompt com luz e movimento físicos (evita "PNG colado").
  const total = segments.reduce((a, b) => a + b, 0);
  const prompt = await directMotion({
    frame,
    direction: basePrompt,
    seconds,
    speaking: !!progress.speaking,
    // O que a pessoa fala neste pedido: ajuda o modelo a mexer a boca desde o primeiro quadro.
    transcript: progress.speaking ? voiceoverSlice(spec.voiceover, start, seconds, total) : null,
    productSize: spec.productSize,
    fallback: basePrompt,
  });

  // Veo: a partir do segundo pedido, o modelo estende o próprio vídeo em vez de recomeçar de um quadro parado
  // (é o que mantém o produto igual na emenda). Obs.: o Veo recusa "primeiro quadro + imagens de referência"
  // no mesmo pedido; o quadro de abertura revisado já carrega o produto fiel.
  const extending = caps.provider === "veo" && !!progress.extend && index > 0 && !!previousVideoUri;
  const referenceImages = undefined;

  return submitVideo({
    keys: videoKeys(config),
    model: job.creative.model,
    // fal.ai baixa a imagem por URL; o Veo recebe os bytes direto.
    ...(caps.provider === "fal"
      ? { imageUrl: await falReachableUrl(config.secrets.wanKey!, frameUrl) }
      : extending ? { extendVideoUri: previousVideoUri! } : { image: frame, referenceImages }),
    prompt,
    aspectRatio: job.creative.aspectRatio || "9:16",
    premium: campaign.quality === "premium",
    seconds,
    audioUrl,
  });
}

async function submitVideoJob(job: LoadedJob) {
  const { creative } = job;
  const campaign = creative.campaign;
  const config = await getAppConfig();
  assertVideoKey(config, creative.model);
  const spec = await videoSpecFor(job);

  // Locução no idioma do anúncio, com a voz de quem apresenta. É um extra: se falhar, o vídeo sai sem áudio.
  let hasNarration = !!creative.audioUrl;
  if (!creative.audioUrl) {
    try {
      const audioUrl = await generateNarration(spec.voiceover, config.secrets, campaign.workspaceId, spec.presenter);
      if (audioUrl) {
        await db.creative.update({ where: { id: creative.id }, data: { audioUrl } });
        hasNarration = true;
      }
    } catch (error) {
      console.warn("[generation] locução falhou (seguindo sem áudio)", error);
    }
  }

  // Com alguém apresentando, a pessoa FALA a locução (lábios sincronizados); só com o produto, é narração em off.
  const speaking = hasNarration && isSpeakingOnCamera(spec.presenter);

  // O vídeo sempre começa num quadro de abertura gerado como UMA foto realista (produto + referências, na escala
  // certa e no formato do vídeo) e aprovado por uma revisão de IA. Animar a foto crua do produto deixava o
  // resultado artificial. Sem Gemini configurado, cai na foto do produto.
  let startImage = campaign.product.originalImageUrl;
  if (hasImageProvider(config)) {
    const brand = await db.brandKit.findUnique({ where: { workspaceId: campaign.workspaceId }, select: { primaryColor: true } });
    // Composição é a parte mais difícil: sempre o modelo de imagem mais forte do provedor escolhido.
    const engine = imageEngine(config, true);
    const frame = await createKeyframe(
      {
        apiKey: engine.apiKey,
        model: engine.model,
        fallbackModel: engine.fallbackModel,
        openai: engine.openai,
        product: await readOwnMedia(campaign.product.originalImageUrl),
        references: await loadReferences(campaign.referencesJson),
        concept: spec.keyframe || spec.scenes[0],
        productSize: spec.productSize,
        styleLabel: STYLES[campaign.style as StyleKey] || campaign.style || "Cinematic",
        aspectRatio: creative.aspectRatio || "9:16",
        quality: "premium",
        brandColor: brand?.primaryColor,
        extraInstructions: spec.extra,
        speaking,
      }
    );
    startImage = await saveFile(frame.buffer, `${workDir(job)}keyframe.${IMAGE_TYPES[frame.mimeType as ImageMime] || "png"}`, frame.mimeType);
  }

  const caps = videoModelCaps(creative.model);
  const layout = planVideo(campaign.videoDuration || VIDEO_SEGMENT_SECONDS, caps);
  const plan = {
    total: 0,
    segments: layout.segments,
    extend: layout.extend,
    // Narração em off não vai para o modelo de vídeo (senão ele faz alguém mexer a boca sem motivo).
    audioInSegments: caps.lipSyncAudio && speaking,
    speaking,
  };
  plan.total = plan.segments.length;
  const request = await submitSegment(job, spec, plan, 0, startImage);
  const progress: VideoProgress = { v: 2, ...plan, done: [], current: request, segmentStartedAt: Date.now() };
  await db.generationJob.update({ where: { id: job.id }, data: { externalData: JSON.stringify(progress) } });
}

async function pollVideoJob(job: LoadedJob) {
  const config = await getAppConfig();
  const keys = videoKeys(config);
  const raw = job.externalData!;
  const progress = parseVideoProgress(raw, job.startedAt?.getTime() ?? Date.now());
  if (!progress) return failJob(job.id, "Estado do vídeo inválido");
  if (isClaimed(progress)) return; // outro worker está unindo/enviando o próximo trecho

  // Etapa final: lip-sync dedicado sobre o vídeo já montado.
  if (progress.lipsync) return pollLipSync(job, raw, progress, keys);

  let finished: { videoUrl?: string; buffer?: Buffer; sourceUri?: string } | null = null;
  if (progress.current) {
    // Primeiro pergunta ao provedor: um trecho que ficou pronto depois do prazo ainda é aproveitado.
    const status = await checkVideo(keys, progress.current);
    if (status.state === "pending") {
      if (Date.now() - progress.segmentStartedAt > VIDEO_TIMEOUT_MS) {
        await cancelVideo(keys, progress.current); // não paga por um trecho que seria descartado
        return failJob(job.id, "Tempo limite de geração excedido");
      }
      await db.generationJob.update({ where: { id: job.id }, data: { status: "PROCESSING" } }); // atualiza updatedAt
      return;
    }
    if (status.state === "failed") return failJob(job.id, status.error);
    finished = status;
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
  if (finished) {
    lastBuffer = finished.buffer ?? (await fetchMedia(finished.videoUrl!)).buffer;
    done.push(await saveFile(lastBuffer, `${dir}seg-${done.length}.mp4`, "video/mp4"));
  }

  // Ainda faltam cenas: o próximo trecho começa exatamente onde este terminou.
  if (done.length < progress.total) {
    const previous = lastBuffer ?? (await readOwnMedia(done[done.length - 1])).buffer;
    // O último quadro sempre vai para o diretor de movimento; no modo extensão o modelo recebe o vídeo inteiro.
    const frameUrl = await saveFile(await lastFrame(previous), `${dir}frame-${done.length}.png`, "image/png");
    // Modo extensão: o Veo continua o próprio vídeo a partir da URI que ele devolveu.
    const sourceUri = finished?.sourceUri ?? progress.lastSourceUri ?? null;
    const request = await submitSegment(job, spec, progress, done.length, frameUrl, progress.extend ? sourceUri : null);
    const next: VideoProgress = {
      v: 2, total: progress.total, segments: progress.segments, audioInSegments: progress.audioInSegments, speaking: progress.speaking,
      extend: progress.extend, lastSourceUri: sourceUri, done, current: request, segmentStartedAt: Date.now(),
    };
    await db.generationJob.update({ where: { id: job.id }, data: { externalData: JSON.stringify(next) } });
    return;
  }

  // Todas as cenas prontas: une os trechos e coloca a locução num único MP4.
  // No modo extensão, o último resultado JÁ É o vídeo inteiro (o Veo devolve original + extensão).
  const segments = progress.extend
    ? [lastBuffer ?? (await readOwnMedia(done[done.length - 1])).buffer]
    : await Promise.all(done.map(async (url, i) => (i === done.length - 1 && lastBuffer ? lastBuffer : (await readOwnMedia(url)).buffer)));
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
  // Com lip-sync, a locução já veio dentro de cada trecho; senão, entra agora por cima do vídeo.
  const final = progress.audioInSegments
    ? await assembleVideo(segments, null, logo, { segmentAudio: true, maxSeconds: campaign.videoDuration })
    : await assembleVideo(segments, narration, logo, { maxSeconds: campaign.videoDuration });

  // Quando a pessoa fala: passe de lip-sync dedicado no vídeo inteiro, com a própria locução como referência.
  // É o que garante a boca sincronizada desde o primeiro quadro, em qualquer vídeo da plataforma.
  if (progress.speaking && fresh?.audioUrl && config.models.lipsyncEnabled && config.secrets.wanKey) {
    try {
      const assembledUrl = await saveFile(final.buffer, `${dir}assembled.mp4`, "video/mp4");
      const request = await submitLipSync({
        falKey: config.secrets.wanKey,
        model: config.models.lipsync,
        videoUrl: await falReachableUrl(config.secrets.wanKey, assembledUrl),
        audioUrl: await falReachableUrl(config.secrets.wanKey, fresh.audioUrl),
        premium: campaign.quality === "premium",
      });
      const next: VideoProgress = { ...progress, done, current: null, claimedAt: undefined, lipsync: { request, startedAt: Date.now(), assembledUrl, duration: final.duration } };
      await db.generationJob.update({ where: { id: job.id }, data: { externalData: JSON.stringify(next) } });
      return;
    } catch (error) {
      // Lip-sync indisponível: entrega o vídeo montado (nunca perde o resultado por causa desta etapa).
      console.warn("[generation] lip-sync final indisponível, entregando sem ele", error);
    }
  }

  await completeVideo(job, { ...progress, done, current: null }, final.buffer, final.duration);
}

const LIPSYNC_TIMEOUT_MS = 20 * 60_000;

/** Salva o vídeo final, conclui o job e limpa os arquivos intermediários. */
async function completeVideo(job: LoadedJob, progress: VideoProgress, buffer: Buffer, duration: number) {
  const campaign = job.creative.campaign;
  const url = await saveFile(buffer, `creatives/${campaign.workspaceId}/${campaign.id}/${job.creativeId}.mp4`, "video/mp4");
  const completed = await db.generationJob.updateMany({
    where: { id: job.id, status: "PROCESSING" },
    data: { status: "COMPLETED", completedAt: new Date(), externalData: JSON.stringify({ ...progress, claimedAt: undefined }) },
  });
  if (completed.count === 1) {
    await db.creative.update({ where: { id: job.creativeId }, data: { status: "COMPLETED", outputUrl: url, duration } });
    await deletePrefix(workDir(job)).catch((e) => console.warn("[generation] limpeza dos trechos falhou", e));
  }
  await maybeFinalizeCampaign(campaign.id);
}

/** Acompanha o lip-sync final; se falhar ou demorar demais, entrega o vídeo montado sem ele. */
async function pollLipSync(job: LoadedJob, raw: string, progress: VideoProgress, keys: VideoKeys) {
  const ls = progress.lipsync!;
  const status = await checkVideo(keys, ls.request);
  if (status.state === "pending" && Date.now() - ls.startedAt < LIPSYNC_TIMEOUT_MS) {
    await db.generationJob.update({ where: { id: job.id }, data: { status: "PROCESSING" } }); // atualiza updatedAt
    return;
  }

  const claimed = await db.generationJob.updateMany({
    where: { id: job.id, status: "PROCESSING", externalData: raw },
    data: { externalData: JSON.stringify({ ...progress, claimedAt: Date.now() }) },
  });
  if (claimed.count === 0) return;

  let buffer: Buffer;
  if (status.state === "completed") {
    buffer = status.buffer ?? (await fetchMedia(status.videoUrl!)).buffer;
  } else {
    if (status.state === "pending") await cancelVideo(keys, ls.request);
    console.warn(`[generation] lip-sync final ${status.state === "failed" ? `falhou (${status.error})` : "excedeu o tempo"}; entregando o vídeo montado`);
    buffer = (await readOwnMedia(ls.assembledUrl)).buffer;
  }
  const duration = ls.duration ?? Math.round(progress.segments?.reduce((a, b) => a + b, 0) ?? progress.total * VIDEO_SEGMENT_SECONDS);
  await completeVideo(job, { ...progress, lipsync: null }, buffer, duration);
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
