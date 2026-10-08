import { createHash, randomBytes } from "crypto";
import { db } from "@/lib/db";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { HttpError } from "@/lib/api";
import { readOwnMedia } from "@/lib/storage";
import { appUrl } from "@/services/email";
import { mercadoLivre } from "./mercadolivre";
import { nuvemshop } from "./nuvemshop";
import { shopify } from "./shopify";
import { StoreApiError, STORE_SLUGS, type LiveConnection, type StoreAccount, type StoreAdapter, type StoreSlug } from "./types";
import type { SessionUser } from "@/lib/auth";

export { STORE_SLUGS, type StoreSlug };

const ADAPTERS: Record<StoreSlug, StoreAdapter> = { mercadolivre: mercadoLivre, nuvemshop, shopify };

export function storeAdapter(slug: string): StoreAdapter | null {
  return (STORE_SLUGS as string[]).includes(slug) ? ADAPTERS[slug as StoreSlug] : null;
}

export function storeRedirectUri(slug: StoreSlug) {
  return `${appUrl()}/api/integrations/stores/${slug}/callback`;
}

/** PKCE (Mercado Livre): o verificador fica num cookie httpOnly, o desafio vai na URL. */
export function pkcePair() {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export async function saveStoreConnection(adapter: StoreAdapter, workspaceId: string, userId: string, account: StoreAccount) {
  const data = {
    externalUserId: account.externalUserId,
    displayName: account.displayName,
    accessToken: encryptSecret(account.accessToken),
    refreshToken: account.refreshToken ? encryptSecret(account.refreshToken) : null,
    tokenExpiresAt: account.expiresAt,
    scopes: account.scopes.join(","),
    status: "ACTIVE",
    createdById: userId,
  };
  return db.connection.upsert({
    where: { workspaceId_provider: { workspaceId, provider: adapter.provider } },
    update: data,
    create: { workspaceId, provider: adapter.provider, ...data },
  });
}

/** Lojas conectadas do workspace (sem tokens), para a tela de integrações e o diálogo de publicar. */
export async function listStoreConnections(workspaceId: string) {
  const rows = await db.connection.findMany({
    where: { workspaceId, provider: { in: STORE_SLUGS.map((s) => ADAPTERS[s].provider) } },
    select: { id: true, provider: true, displayName: true, status: true, externalUserId: true, updatedAt: true },
  });
  return rows.map((r) => {
    const adapter = STORE_SLUGS.map((s) => ADAPTERS[s]).find((a) => a.provider === r.provider)!;
    return { ...r, slug: adapter.slug, label: adapter.label };
  });
}

/** Token pronto para uso (renova o do Mercado Livre se estiver para vencer). */
export async function liveConnection(adapter: StoreAdapter, workspaceId: string): Promise<LiveConnection & { connectionId: string }> {
  const conn = await db.connection.findUnique({ where: { workspaceId_provider: { workspaceId, provider: adapter.provider } } });
  if (!conn || conn.status !== "ACTIVE") throw new HttpError(409, "errors.storeNotConnected", "STORE_NOT_CONNECTED");
  let token = decryptSecret(conn.accessToken);
  if (!token) throw new HttpError(409, "errors.storeNotConnected", "STORE_NOT_CONNECTED");

  const expiring = conn.tokenExpiresAt && conn.tokenExpiresAt.getTime() < Date.now() + 5 * 60_000;
  if (expiring && adapter.refreshable && adapter.refresh) {
    const app = await adapter.getApp();
    const refreshToken = decryptSecret(conn.refreshToken);
    if (!app || !refreshToken) throw new HttpError(409, "errors.storeExpired", "STORE_EXPIRED");
    try {
      const fresh = await adapter.refresh({ appId: app.appId, secret: app.secret, refreshToken });
      // O refresh_token do Mercado Livre é de uso único: o novo substitui o antigo na hora.
      await db.connection.update({
        where: { id: conn.id },
        data: { accessToken: encryptSecret(fresh.accessToken), refreshToken: fresh.refreshToken ? encryptSecret(fresh.refreshToken) : null, tokenExpiresAt: fresh.expiresAt },
      });
      token = fresh.accessToken;
    } catch (error) {
      await db.connection.update({ where: { id: conn.id }, data: { status: "EXPIRED" } });
      throw new HttpError(409, "errors.storeExpired", "STORE_EXPIRED", { detail: (error as Error).message });
    }
  }
  return { id: conn.id, connectionId: conn.id, externalUserId: conn.externalUserId, token };
}

/** Busca anúncios/produtos da loja conectada. */
export async function searchStoreItems(user: SessionUser, slug: string, q: string) {
  const adapter = storeAdapter(slug);
  if (!adapter) throw new HttpError(404, "errors.storeUnknown");
  const conn = await liveConnection(adapter, user.workspaceId);
  try {
    return await adapter.searchItems(conn, q);
  } catch (error) {
    throw await storeError(error, conn.connectionId);
  }
}

async function storeError(error: unknown, connectionId: string) {
  if (error instanceof StoreApiError) {
    if (error.authError) await db.connection.update({ where: { id: connectionId }, data: { status: "EXPIRED" } }).catch(() => undefined);
    return new HttpError(error.authError ? 409 : 400, error.authError ? "errors.storeExpired" : error.message, error.authError ? "STORE_EXPIRED" : "STORE_ERROR");
  }
  return error;
}

/**
 * Coloca a imagem do criativo no anúncio/produto escolhido (como capa ou no fim da galeria).
 * Síncrono: a loja responde em segundos. Fica registrado em Publication, como as postagens na Meta.
 */
export async function publishToStore(user: SessionUser, input: { creativeId: string; slug: string; itemId: string; asCover: boolean }) {
  const adapter = storeAdapter(input.slug);
  if (!adapter) throw new HttpError(404, "errors.storeUnknown");
  const creative = await db.creative.findFirst({ where: { id: input.creativeId, campaign: { workspaceId: user.workspaceId } } });
  if (!creative) throw new HttpError(404, "errors.creativeNotFound");
  if (creative.status !== "COMPLETED" || !creative.outputUrl) throw new HttpError(409, "errors.creativeNotReady");
  if (creative.type !== "IMAGE") throw new HttpError(400, "errors.storeImagesOnly", "STORE_IMAGES_ONLY");

  const conn = await liveConnection(adapter, user.workspaceId);
  let item;
  try {
    item = await adapter.getItem(conn, input.itemId);
  } catch (error) {
    throw await storeError(error, conn.connectionId);
  }
  if (!item) throw new HttpError(404, "errors.storeItemNotFound");

  const pub = await db.publication.create({
    data: {
      workspaceId: user.workspaceId,
      creativeId: creative.id,
      connectionId: conn.connectionId,
      provider: adapter.provider,
      target: adapter.target,
      accountId: input.itemId,
      accountName: item.title.slice(0, 200),
      optionsJson: JSON.stringify({ asCover: input.asCover }),
      status: "PROCESSING",
      attempts: 1,
      createdById: user.id,
    },
  });
  try {
    const { buffer, mimeType } = await readOwnMedia(creative.outputUrl);
    const ext = mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
    const result = await adapter.addImage(conn, input.itemId, { buffer, mimeType, filename: `vysify-${creative.id.slice(0, 8)}.${ext}` }, input.asCover);
    return db.publication.update({ where: { id: pub.id }, data: { status: "PUBLISHED", externalId: result.externalId, permalink: result.permalink } });
  } catch (error) {
    const httpError = await storeError(error, conn.connectionId);
    const message = httpError instanceof Error ? httpError.message : String(error);
    await db.publication.update({ where: { id: pub.id }, data: { status: "FAILED", error: message.slice(0, 500) } });
    throw httpError;
  }
}
