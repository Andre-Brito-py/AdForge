import { brandColorDirection } from "@/lib/brand-assets";
import { videoModelCaps } from "@/lib/video-models";

/**
 * Geração de vídeo (image-to-video) via fila assíncrona da fal.ai.
 * O vídeo leva minutos, então não esperamos na mesma requisição:
 *  1. submitVideo() envia o pedido e guarda request_id/status_url no GenerationJob;
 *  2. checkVideo() é chamado depois (polling da tela + cron) até concluir.
 */

export interface FalRequest {
  requestId: string;
  statusUrl: string;
  responseUrl: string;
}

export type VideoStatus =
  | { state: "pending" }
  | { state: "completed"; videoUrl: string }
  | { state: "failed"; error: string };

export class VideoGenerationError extends Error {}

const FAL_QUEUE = process.env.FAL_QUEUE_URL || "https://queue.fal.run";

function falAspect(aspectRatio: string) {
  return ["16:9", "9:16", "1:1"].includes(aspectRatio) ? aspectRatio : "auto";
}

/** O que nunca queremos no vídeo (vale para os modelos que aceitam prompt negativo). */
const NEGATIVE_PROMPT =
  "distorted or resized product, product changing shape or label, oversized or tiny product, pasted or collage look, flat sticker-like product, frozen or static reflections, product lighting not matching the scene, extra fingers, deformed hands, face changing identity, on-screen text, watermark, logo artifacts, jump cuts";

export async function submitVideo(opts: {
  falKey: string;
  model: string;
  imageUrl: string;
  prompt: string;
  aspectRatio: string;
  premium: boolean;
  /** Duração deste pedido (s); só usada pelos modelos que aceitam escolher. */
  seconds?: number;
  /** Locução deste trecho (URL ou data URI) para o modelo sincronizar os lábios. */
  audioUrl?: string | null;
}): Promise<FalRequest> {
  const caps = videoModelCaps(opts.model);
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
    headers: { Authorization: `Key ${opts.falKey}`, "Content-Type": "application/json" },
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
  return { requestId: data.request_id, statusUrl: data.status_url, responseUrl: data.response_url };
}

export async function checkVideo(falKey: string, req: FalRequest): Promise<VideoStatus> {
  const headers = { Authorization: `Key ${falKey}` };
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
export async function cancelVideo(falKey: string, req: FalRequest): Promise<void> {
  const url = req.statusUrl.replace(/\/status(\?.*)?$/, "/cancel");
  await fetch(url, { method: "PUT", headers: { Authorization: `Key ${falKey}` }, signal: AbortSignal.timeout(15_000) }).catch(() => {});
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
