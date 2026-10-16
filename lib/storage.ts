import { DeleteObjectsCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { mkdir, readFile, rm, writeFile } from "fs/promises";
import { resolve, sep } from "path";

const useS3 = !!process.env.S3_BUCKET && !!process.env.S3_ACCESS_KEY_ID;

const s3 = useS3
  ? new S3Client({
      region: process.env.S3_REGION || "us-east-1",
      endpoint: process.env.S3_ENDPOINT,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID!,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
      },
      forcePathStyle: !!process.env.S3_ENDPOINT,
      // Cloudflare R2 (e outros S3 compatíveis): o SDK novo manda checksums que nem todos aceitam; só quando exigido.
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    })
  : null;

const LOCAL_ROOT = resolve(process.cwd(), "public", "uploads");
const MAX_READ_BYTES = 25 * 1024 * 1024;

function publicBaseUrl(): string | null {
  if (!useS3) return null;
  return (process.env.S3_PUBLIC_URL || `${process.env.S3_ENDPOINT}/${process.env.S3_BUCKET}`).replace(/\/$/, "");
}

export const IMAGE_TYPES = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
} as const;
export type ImageMime = keyof typeof IMAGE_TYPES;

/** Identifica o tipo real pelo conteúdo (magic bytes), não pela extensão enviada. */
export function detectImageType(buf: Buffer): ImageMime | null {
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length >= 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return null;
}

/** Salva um arquivo e devolve a URL pública. Em produção exige S3. */
export async function saveFile(buffer: Buffer, key: string, contentType: string): Promise<string> {
  const safeKey = key.replace(/[^a-zA-Z0-9/_.-]/g, "_").replace(/\.\.+/g, ".");
  if (s3) {
    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET!,
        Key: safeKey,
        Body: buffer,
        ContentType: contentType,
        CacheControl: "public, max-age=31536000, immutable",
      })
    );
    return `${publicBaseUrl()}/${safeKey}`;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("Armazenamento S3 não configurado (S3_BUCKET / S3_ACCESS_KEY_ID).");
  }
  const target = resolve(LOCAL_ROOT, safeKey);
  if (!target.startsWith(LOCAL_ROOT + sep)) throw new Error("Caminho inválido");
  await mkdir(resolve(target, ".."), { recursive: true });
  await writeFile(target, buffer);
  return `/uploads/${safeKey}`;
}

/** URL pertence ao nosso armazenamento? (usado para validar imageUrl vindo do cliente) */
export function isOwnStorageUrl(url: string): boolean {
  const base = publicBaseUrl();
  if (base && url.startsWith(base + "/")) return !url.includes("..");
  if (!useS3 && url.startsWith("/uploads/")) return !url.includes("..");
  return false;
}

/**
 * Lê uma mídia salva por nós (S3 ou disco local). Recusa qualquer outra origem,
 * evitando path traversal e SSRF a partir de URLs controladas pelo usuário.
 */
export async function readOwnMedia(url: string): Promise<{ buffer: Buffer; mimeType: string }> {
  if (!isOwnStorageUrl(url)) throw new Error("Origem de mídia não permitida");

  if (url.startsWith("/uploads/")) {
    const target = resolve(LOCAL_ROOT, url.slice("/uploads/".length));
    if (!target.startsWith(LOCAL_ROOT + sep)) throw new Error("Caminho inválido");
    const buffer = await readFile(target);
    return { buffer, mimeType: detectImageType(buffer) || "application/octet-stream" };
  }

  return fetchMedia(url);
}

/** Baixa mídia de uma URL confiável (nosso bucket ou resposta de um provedor de IA). */
export async function fetchMedia(url: string): Promise<{ buffer: Buffer; mimeType: string }> {
  const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`Falha ao baixar mídia (${res.status})`);
  const length = Number(res.headers.get("content-length") || 0);
  if (length > MAX_READ_BYTES * 4) throw new Error("Arquivo grande demais");
  const buffer = Buffer.from(await res.arrayBuffer());
  const mimeType = detectImageType(buffer) || res.headers.get("content-type") || "application/octet-stream";
  return { buffer, mimeType };
}

export function toDataUri(buffer: Buffer, mimeType: string) {
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

/** Apaga todos os arquivos sob um prefixo (usado na exclusão de conta, LGPD). */
export async function deletePrefix(prefix: string) {
  if (!prefix.endsWith("/") || prefix.includes("..")) throw new Error("Prefixo inválido");
  if (s3) {
    let token: string | undefined;
    do {
      const list = await s3.send(new ListObjectsV2Command({ Bucket: process.env.S3_BUCKET!, Prefix: prefix, ContinuationToken: token }));
      const keys = (list.Contents || []).map((o) => ({ Key: o.Key! }));
      if (keys.length) await s3.send(new DeleteObjectsCommand({ Bucket: process.env.S3_BUCKET!, Delete: { Objects: keys } }));
      token = list.IsTruncated ? list.NextContinuationToken : undefined;
    } while (token);
    return;
  }
  const target = resolve(LOCAL_ROOT, prefix);
  if (target.startsWith(LOCAL_ROOT + sep)) await rm(target, { recursive: true, force: true });
}

/** URL acessível por provedores externos (fal.ai). Em dev local, envia como data URI. */
export async function externallyReachableUrl(url: string): Promise<string> {
  if (/^https:\/\//i.test(url)) return url;
  const { buffer, mimeType } = await readOwnMedia(url);
  return toDataUri(buffer, mimeType);
}
