/**
 * Google Veo 3.1 (image-to-video) pela API do Gemini, com a mesma chave do Gemini.
 * Assíncrono: predictLongRunning devolve uma operação que é consultada até terminar.
 * Docs: https://ai.google.dev/gemini-api/docs/veo
 *
 * Vídeos longos usam a EXTENSÃO do Veo (3.1 e 3.1 Fast): o modelo continua o próprio vídeo anterior
 * (+7 s por vez) vendo todo o movimento, e devolve o vídeo já unido. Recomeçar de um quadro parado fazia o
 * produto "mudar" na emenda.
 */
const GEMINI_API = (process.env.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com").replace(/\/$/, "");

export const VEO_DURATIONS = [4, 6, 8];
export const VEO_EXTENSION_SECONDS = 7;

/** Veo 3.1 e 3.1 Fast aceitam extensão e imagens de referência; o Lite não. */
export function veoSupportsExtension(model: string) {
  return /^veo-3\.1-(fast-)?generate/i.test(model);
}

type Img = { buffer: Buffer; mimeType: string };

export async function submitVeo(opts: {
  apiKey: string;
  model: string;
  /** Primeiro quadro (geração nova). */
  image?: Img;
  /** URI (devolvida pelo próprio Veo) do vídeo a ser estendido (+7 s). */
  extendVideoUri?: string;
  /** Fotos do produto que o modelo deve manter fiéis (até 3; só em geração nova). */
  referenceImages?: Img[];
  prompt: string;
  aspectRatio: string;
  seconds: number;
  premium: boolean;
  negativePrompt?: string;
}): Promise<{ provider: "veo"; operation: string }> {
  const extending = !!opts.extendVideoUri;
  const refs = !extending && veoSupportsExtension(opts.model) ? (opts.referenceImages || []).slice(0, 3) : [];
  // Extensão e imagens de referência exigem 8 s; 1080p só com 8 s e nunca na extensão.
  const seconds = extending || refs.length ? 8 : VEO_DURATIONS.includes(opts.seconds) ? opts.seconds : 8;
  const resolution = !extending && opts.premium && seconds === 8 ? "1080p" : "720p";
  const instance: Record<string, unknown> = { prompt: opts.prompt.slice(0, 2000) };
  // A extensão só aceita a URI do vídeo gerado pelo Veo (bytes são recusados: "Video URI not found").
  // A imagem inicial vai em "bytesBase64Encoded" (inlineData é recusado neste endpoint).
  if (extending) instance.video = { uri: opts.extendVideoUri };
  else if (opts.image) instance.image = { bytesBase64Encoded: opts.image.buffer.toString("base64"), mimeType: opts.image.mimeType };
  if (refs.length) {
    instance.referenceImages = refs.map((r) => ({ image: { bytesBase64Encoded: r.buffer.toString("base64"), mimeType: r.mimeType }, referenceType: "asset" }));
  }

  const res = await fetch(`${GEMINI_API}/v1beta/models/${opts.model}:predictLongRunning`, {
    method: "POST",
    headers: { "x-goog-api-key": opts.apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      instances: [instance],
      parameters: {
        aspectRatio: opts.aspectRatio === "16:9" ? "16:9" : "9:16",
        resolution,
        durationSeconds: seconds, // número (a API recusa texto)
        // Em image-to-video o Veo só aceita "allow_adult" (a moderação da Vysify já barrou menores);
        // na extensão o parâmetro não é aceito (a pessoa já está no vídeo de entrada).
        ...(extending ? {} : { personGeneration: "allow_adult" }),
        ...(opts.negativePrompt ? { negativePrompt: opts.negativePrompt } : {}),
      },
    }),
    signal: AbortSignal.timeout(120_000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.name) throw new Error(`Veo recusou o pedido (${res.status}): ${JSON.stringify(data?.error || data).slice(0, 300)}`);
  return { provider: "veo", operation: data.name };
}

export type VeoStatus = { state: "pending" } | { state: "completed"; buffer: Buffer; sourceUri: string } | { state: "failed"; error: string };

export async function checkVeo(apiKey: string, operation: string): Promise<VeoStatus> {
  const res = await fetch(`${GEMINI_API}/v1beta/${operation}`, { headers: { "x-goog-api-key": apiKey }, signal: AbortSignal.timeout(30_000) });
  if (!res.ok) {
    if (res.status >= 500 || res.status === 429) return { state: "pending" };
    return { state: "failed", error: `Veo status ${res.status}` };
  }
  const op = await res.json();
  if (!op.done) return { state: "pending" };
  if (op.error) return { state: "failed", error: `Veo: ${op.error.message || JSON.stringify(op.error).slice(0, 300)}` };
  const sample = op.response?.generateVideoResponse?.generatedSamples?.[0];
  const uri = sample?.video?.uri;
  if (!uri) {
    // Bloqueio de segurança do Google (ex.: filtro de conteúdo) vem sem vídeo.
    const reason = op.response?.generateVideoResponse?.raiMediaFilteredReasons?.join("; ");
    return { state: "failed", error: `Veo não retornou vídeo${reason ? `: ${reason}` : ""}` };
  }
  const video = await fetch(uri, { headers: { "x-goog-api-key": apiKey }, redirect: "follow", signal: AbortSignal.timeout(120_000) });
  if (!video.ok) return { state: "failed", error: `Falha ao baixar o vídeo do Veo (${video.status})` };
  return { state: "completed", buffer: Buffer.from(await video.arrayBuffer()), sourceUri: uri };
}
