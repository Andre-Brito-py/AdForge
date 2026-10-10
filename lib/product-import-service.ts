import { randomUUID } from "crypto";
import { HttpError } from "./api";
import { detectImageType, IMAGE_TYPES, saveFile } from "./storage";
import { liveConnection, storeAdapter } from "./stores";
import { getAppConfig } from "./config";
import { importProduct, ProductImportError, type ImportedProduct } from "./product-import";
import { safeFetch } from "./safe-fetch";
import { reviewImage } from "@/services/ai/moderation";
import type { SessionUser } from "./auth";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export interface ImportResult extends Omit<ImportedProduct, "images"> {
  /** Foto principal já no nosso armazenamento (mesmas regras do upload). */
  imageUrl: string;
}

const ML_API = (process.env.ML_API_BASE_URL || "https://api.mercadolibre.com").replace(/\/$/, "");
let appToken: { token: string; expiresAt: number } | null = null;

/** Token do próprio app Vysify no Mercado Livre (client_credentials), para ler anúncios públicos. */
async function mercadoLivreAppToken(): Promise<string | null> {
  if (appToken && appToken.expiresAt > Date.now() + 60_000) return appToken.token;
  const { secrets } = await getAppConfig();
  if (!secrets.mercadoLivreAppId || !secrets.mercadoLivreSecret) return null;
  const res = await fetch(`${ML_API}/oauth/token`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "client_credentials", client_id: secrets.mercadoLivreAppId, client_secret: secrets.mercadoLivreSecret }).toString(),
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);
  if (!res?.ok) return null;
  const data = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number };
  if (!data.access_token) return null;
  appToken = { token: data.access_token, expiresAt: Date.now() + (data.expires_in || 3600) * 1000 };
  return appToken.token;
}

/** Token para a API do Mercado Livre: a conta conectada no workspace ou, sem ela, o app Vysify. */
async function mercadoLivreToken(workspaceId: string) {
  const adapter = storeAdapter("mercadolivre");
  if (adapter) {
    try {
      return (await liveConnection(adapter, workspaceId)).token;
    } catch {
      /* sem conta conectada */
    }
  }
  return mercadoLivreAppToken();
}

/**
 * Baixa a primeira foto válida do produto: tipo real (PNG, JPEG ou WEBP), até 8 MB e moderação antes de gravar,
 * como no upload feito pelo cliente.
 */
async function storeProductImage(user: SessionUser, images: string[]): Promise<string> {
  for (const src of images.slice(0, 4)) {
    try {
      const res = await safeFetch(src, { accept: "image/webp,image/jpeg,image/png;q=0.9", maxBytes: MAX_IMAGE_BYTES, timeoutMs: 15_000 });
      const mime = detectImageType(res.body);
      if (!mime) continue;
      const review = await reviewImage({ buffer: res.body, mimeType: mime }, user.locale === "en" ? "en" : "pt").catch(() => null);
      if (review && !review.allowed) throw new HttpError(422, "errors.imageBlocked", "IMAGE_BLOCKED", { reason: review.reason });
      return saveFile(res.body, `uploads/${user.workspaceId}/${randomUUID()}.${IMAGE_TYPES[mime]}`, mime);
    } catch (error) {
      if (error instanceof HttpError) throw error;
      // Foto indisponível ou formato não aceito: tenta a próxima.
    }
  }
  throw new HttpError(422, "errors.importNoImage", "IMPORT_NO_IMAGE");
}

export async function importProductForWorkspace(user: SessionUser, url: string): Promise<ImportResult> {
  let product: ImportedProduct;
  try {
    product = await importProduct(url, { mlToken: () => mercadoLivreToken(user.workspaceId) });
  } catch (error) {
    if (error instanceof ProductImportError) {
      const key = {
        INVALID_URL: "errors.importInvalidUrl", BLOCKED: "errors.importInvalidUrl", UNREADABLE: "errors.importUnreadable",
        NOT_FOUND: "errors.importNotFound", ML_AUTH: "errors.importMercadoLivreAuth",
      }[error.code];
      throw new HttpError(422, key, `IMPORT_${error.code}`);
    }
    console.error("[import] falha ao ler o produto", error);
    throw new HttpError(422, "errors.importUnreadable", "IMPORT_UNREADABLE");
  }
  const { images, ...rest } = product;
  const imageUrl = await storeProductImage(user, images);
  return { ...rest, imageUrl };
}
