import { brandColorDirection } from "@/lib/brand-assets";
import { videoModelCaps } from "@/lib/video-models";
import { checkVeo, submitVeo } from "./veo";

/**
 * Geração de vídeo (image-to-video) via fila assíncrona da fal.ai (Wan...) ou do Google Veo.
 * O vídeo leva minutos, então não esperamos na mesma requisição:
 *  1. submitVideo() envia o pedido e guarda request_id/status_url no GenerationJob;
 *  2. checkVideo() é chamado depois (polling da tela + cron) até concluir.
 */

export interface FalRequest {
  requestId: string;
  statusUrl: string;
  responseUrl: string;
}

/** Pedido em andamento: na fila da fal.ai (antigos não têm "provider") ou uma operação do Google Veo. */
export type VideoRequest = (FalRequest & { provider?: "fal" }) | { provider: "veo"; operation: string };

export type VideoStatus =
  | { state: "pending" }
  | { state: "completed"; videoUrl?: string; buffer?: Buffer; sourceUri?: string }
  | { state: "failed"; error: string };

/** Chaves que os provedores de vídeo usam. */
export interface VideoKeys {
  fal: string | null;
  gemini: string | null;
}

export class VideoGenerationError extends Error {}

/**
 * O provedor recusou de vez (créditos esgotados, chave inválida, pedido rejeitado): tentar de novo
 * só repete o erro. Sobrecarga, limite momentâneo (408/429) e 5xx continuam sendo tentados.
 */
export function isPermanentVideoError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  if (/depleted|billing|prepay|quota|limit: 0|free_tier|insufficient|exhausted balance/i.test(message)) return true;
  const status = Number(/recusou (?:o pedido|o lip-sync|o upload) \((\d{3})\)/.exec(message)?.[1]);
  if (status >= 400 && status < 500) return status !== 408 && status !== 429;
  // Erros nossos de configuração (chave ausente, imagem inicial ausente) também não melhoram sozinhos.
  return error instanceof VideoGenerationError && !/^fal\.ai recusou|Resposta inesperada/.test(message);
}

/** Mensagem curta para o painel quando o provedor de vídeo fica sem créditos. */
export function describeVideoError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/Veo/.test(message) && /depleted|prepay|billing|\(402\)/i.test(message)) {
    return "Créditos do Google (Gemini/Veo) esgotados: recarregue em AI Studio › Billing. " + message;
  }
  if (/fal\.ai/.test(message) && /\(402\)|\(403\)|balance|insufficient/i.test(message)) {
    return "Créditos da fal.ai esgotados ou chave sem permissão: confira em fal.ai › Billing. " + message;
  }
  return message;
}

const FAL_QUEUE = process.env.FAL_QUEUE_URL || "https://queue.fal.run";

function falAspect(aspectRatio: string) {
  return ["16:9", "9:16", "1:1"].includes(aspectRatio) ? aspectRatio : "auto";
}

/** O que nunca queremos no vídeo (vale para os modelos que aceitam prompt negativo). */
const NEGATIVE_PROMPT =
  "distorted or resized product, product changing shape or label, oversized or tiny product, pasted or collage look, flat sticker-like product, frozen or static reflections, product lighting not matching the scene, extra fingers, deformed hands, face changing identity, on-screen text, watermark, logo artifacts, jump cuts";

export async function submitVideo(opts: {
  keys: VideoKeys;
  model: string;
  /** Imagem inicial: URL pública (fal.ai) ou os bytes (Veo). */
  imageUrl?: string;
  image?: { buffer: Buffer; mimeType: string };
  /** Veo: vídeo anterior a ser estendido (+7 s), em vez de recomeçar de um quadro. */
  extendVideoUri?: string;
  /** Veo: fotos do produto que devem continuar fiéis (só na primeira geração). */
  referenceImages?: { buffer: Buffer; mimeType: string }[];
  prompt: string;
  aspectRatio: string;
  premium: boolean;
  /** Duração deste pedido (s); só usada pelos modelos que aceitam escolher. */
  seconds?: number;
  /** Locução deste trecho (URL ou data URI) para o modelo sincronizar os lábios. */
  audioUrl?: string | null;
}): Promise<VideoRequest> {
  const caps = videoModelCaps(opts.model);
  if (caps.provider === "veo") {
    if (!opts.keys.gemini) throw new VideoGenerationError("Chave do Gemini não configurada (necessária para o Veo)");
    if (!opts.image && !opts.extendVideoUri) throw new VideoGenerationError("Imagem inicial ausente");
    return submitVeo({
      apiKey: opts.keys.gemini, model: opts.model, image: opts.image, extendVideoUri: opts.extendVideoUri, referenceImages: opts.referenceImages, prompt: opts.prompt,
      aspectRatio: opts.aspectRatio, seconds: opts.seconds || 8, premium: opts.premium, negativePrompt: NEGATIVE_PROMPT,
    });
  }
  if (!opts.keys.fal) throw new VideoGenerationError("Chave da fal.ai não configurada");
  if (!opts.imageUrl) throw new VideoGenerationError("Imagem inicial ausente");
  const body = caps.lipSyncAudio
    ? {
        prompt: opts.prompt.slice(0, 1500),
        image_url: opts.imageUrl,
        duration: String(opts.seconds && caps.durations.includes(opts.seconds) ? opts.seconds : caps.durations[0]),
        resolution: opts.premium ? caps.resolution.premium : caps.resolution.standard,
        ...(opts.audioUrl ? { audio_url: opts.audioUrl } : {}),
        negative_prompt: NEGATIVE_PROMPT,
        // O prompt já vem detalhado pela Vysify; a expansão automática poderia mudar o produto ou a cena.
        enable_prompt_expansion: false,
        multi_shots: false,
        enable_safety_checker: true,
      }
    : {
        prompt: opts.prompt,
        image_url: opts.imageUrl,
        aspect_ratio: falAspect(opts.aspectRatio),
        resolution: opts.premium ? caps.resolution.premium : caps.resolution.standard,
        enable_safety_checker: true,
      };
  const res = await fetch(`${FAL_QUEUE}/${opts.model}`, {
    method: "POST",
    headers: { Authorization: `Key ${opts.keys.fal}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) {
    throw new VideoGenerationError(`fal.ai recusou o pedido (${res.status}): ${(await res.text()).slice(0, 300)}`);
  }
  const data = await res.json();
  if (!data.request_id || !data.status_url || !data.response_url) {
    throw new VideoGenerationError("Resposta inesperada da fal.ai");
  }
  return { provider: "fal", requestId: data.request_id, statusUrl: data.status_url, responseUrl: data.response_url };
}

export async function checkVideo(keys: VideoKeys, req: VideoRequest): Promise<VideoStatus> {
  if (req.provider === "veo") {
    if (!keys.gemini) return { state: "failed", error: "Chave do Gemini removida durante a geração" };
    return checkVeo(keys.gemini, req.operation);
  }
  if (!keys.fal) return { state: "failed", error: "Chave da fal.ai removida durante a geração" };
  const headers = { Authorization: `Key ${keys.fal}` };
  const statusRes = await fetch(req.statusUrl, { headers, signal: AbortSignal.timeout(15_000) });
  if (!statusRes.ok) {
    if (statusRes.status >= 500) return { state: "pending" };
    return { state: "failed", error: `Status ${statusRes.status}` };
  }
  const status = await statusRes.json();
  if (status.status !== "COMPLETED") return { state: "pending" };

  const out = await fetch(req.responseUrl, { headers, signal: AbortSignal.timeout(15_000) });
  const body = await out.json().catch(() => ({}));
  const url = body?.video?.url;
  if (!out.ok || !url) {
    const detail = typeof body?.detail === "string" ? body.detail : JSON.stringify(body?.detail || body).slice(0, 300);
    return { state: "failed", error: `Geração falhou: ${detail}` };
  }
  return { state: "completed", videoUrl: url };
}

/** Cancela um pedido na fila da fal.ai (melhor esforço: se já estiver rodando, pode não ser cancelável). */
export async function cancelVideo(keys: VideoKeys, req: VideoRequest): Promise<void> {
  // Operações do Veo não são canceladas (a API não oferece cancelamento por operação).
  if (req.provider === "veo" || !keys.fal) return;
  const url = req.statusUrl.replace(/\/status(\?.*)?$/, "/cancel");
  await fetch(url, { method: "PUT", headers: { Authorization: `Key ${keys.fal}` }, signal: AbortSignal.timeout(15_000) }).catch(() => {});
}

export function buildVideoPrompt(concept: string, styleLabel: string, extra?: string | null, segment?: { index: number; total: number }, brandColor?: string | null) {
  const continuation = segment && segment.index > 0
    ? `This shot continues seamlessly from the input frame (part ${segment.index + 1} of ${segment.total}): keep the same product, setting, lighting and color grading; no cut, no scene change.`
    : "";
  return [
    concept,
    continuation,
    `Style: ${styleLabel}. Smooth cinematic camera motion, the product stays identical to the input image, no on-screen text.`,
    brandColorDirection(brandColor),
    extra ? `Client direction: ${extra}` : "",
  ]
    .filter(Boolean)
    .join(" ");
}
