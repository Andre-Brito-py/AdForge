import type { FalRequest } from "./video";

/**
 * Passe final de sincronização labial (fal.ai, ex.: Sync Lipsync v2): recebe o vídeo pronto e a locução
 * e refaz só a região da boca de quem fala, no vídeo inteiro. Corrige o caso em que o modelo de vídeo
 * deixa a pessoa calada nos primeiros segundos enquanto a voz já está tocando.
 */

const FAL_QUEUE = process.env.FAL_QUEUE_URL || "https://queue.fal.run";

export async function submitLipSync(opts: { falKey: string; model: string; videoUrl: string; audioUrl: string; premium: boolean }): Promise<FalRequest> {
  const res = await fetch(`${FAL_QUEUE}/${opts.model}`, {
    method: "POST",
    headers: { Authorization: `Key ${opts.falKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      video_url: opts.videoUrl,
      audio_url: opts.audioUrl,
      // Premium usa a versão Pro (mais fiel em close-ups); o resto, a padrão.
      model: opts.premium ? "lipsync-2-pro" : "lipsync-2",
      // A locução foi feita para caber no vídeo; se for menor, completa com silêncio (nunca corta o vídeo).
      sync_mode: "silence",
    }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`fal.ai recusou o lip-sync (${res.status}): ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  if (!data.request_id || !data.status_url || !data.response_url) throw new Error("Resposta inesperada da fal.ai (lip-sync)");
  return { requestId: data.request_id, statusUrl: data.status_url, responseUrl: data.response_url };
}
