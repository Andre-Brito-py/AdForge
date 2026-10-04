import { readOwnMedia } from "@/lib/storage";

/**
 * Envio de arquivos para o armazenamento da própria fal.ai (fal CDN), quando a mídia não tem URL pública
 * (ex.: desenvolvimento local, sem S3). Mandar o arquivo embutido no pedido (data URI) estoura o limite de
 * tamanho em vídeos e áudios longos. Fluxo: pede uma URL de upload, envia os bytes e usa o link devolvido.
 */
const FAL_REST = (process.env.FAL_REST_URL || "https://rest.fal.ai").replace(/\/$/, "");

export async function falUpload(falKey: string, buffer: Buffer, contentType: string, fileName: string): Promise<string> {
  const init = await fetch(`${FAL_REST}/storage/upload/initiate?storage_type=fal-cdn-v3`, {
    method: "POST",
    headers: { Authorization: `Key ${falKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ content_type: contentType, file_name: fileName }),
    signal: AbortSignal.timeout(30_000),
  });
  const data = await init.json().catch(() => ({}));
  if (!init.ok || !data.upload_url || !data.file_url) {
    // O motivo da fal (ex.: "Exhausted balance") vai junto: sem ele, um 403 não diz se é saldo ou permissão.
    throw new Error(`fal.ai recusou o upload (${init.status}): ${JSON.stringify(data?.detail ?? data).slice(0, 300)}`);
  }
  const put = await fetch(data.upload_url, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: new Uint8Array(buffer),
    signal: AbortSignal.timeout(120_000),
  });
  if (!put.ok) throw new Error(`Falha ao enviar o arquivo para a fal.ai (${put.status})`);
  return data.file_url as string;
}

const CONTENT_TYPES: Record<string, string> = { mp4: "video/mp4", mp3: "audio/mpeg", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp" };

/** URL que a fal.ai consegue baixar: a nossa, se já for pública (https); senão, o arquivo vai para o CDN da fal. */
export async function falReachableUrl(falKey: string, ownUrl: string): Promise<string> {
  if (/^https:\/\//i.test(ownUrl)) return ownUrl;
  const { buffer, mimeType } = await readOwnMedia(ownUrl);
  const ext = (ownUrl.split("?")[0].split(".").pop() || "").toLowerCase();
  const type = CONTENT_TYPES[ext] || (mimeType !== "application/octet-stream" ? mimeType : "application/octet-stream");
  return falUpload(falKey, buffer, type, ownUrl.split("/").pop() || `file.${ext || "bin"}`);
}
