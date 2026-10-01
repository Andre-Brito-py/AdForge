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

export async function submitVideo(opts: {
  falKey: string;
  model: string;
  imageUrl: string;
  prompt: string;
  aspectRatio: string;
  premium: boolean;
}): Promise<FalRequest> {
  const res = await fetch(`${FAL_QUEUE}/${opts.model}`, {
    method: "POST",
    headers: { Authorization: `Key ${opts.falKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: opts.prompt,
      image_url: opts.imageUrl,
      aspect_ratio: falAspect(opts.aspectRatio),
      resolution: opts.premium ? "720p" : "480p",
      enable_safety_checker: true,
    }),
    signal: AbortSignal.timeout(30_000),
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

export function buildVideoPrompt(concept: string, styleLabel: string, extra?: string | null) {
  return [
    concept,
    `Style: ${styleLabel}. Smooth cinematic camera motion, the product stays identical to the input image, no on-screen text.`,
    extra ? `Client direction: ${extra}` : "",
  ]
    .filter(Boolean)
    .join(" ");
}
