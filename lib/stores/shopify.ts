import { createHmac, timingSafeEqual } from "crypto";
import { getAppConfig } from "@/lib/config";
import { StoreApiError, type LiveConnection, type StoreAdapter, type StoreItem } from "./types";

/**
 * Shopify. Cada loja tem o próprio domínio (loja.myshopify.com): o lojista informa o endereço, autoriza o app
 * e recebemos um token offline (não expira). Produtos e imagens pela Admin GraphQL API:
 * a imagem vai por upload "staged" (sem precisar de URL pública) e entra no produto com productUpdate.
 */
const API_VERSION = process.env.SHOPIFY_API_VERSION || "2025-07";
const SCOPES = "read_products,write_products";
const SHOP_DOMAIN = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;

/** "minha-loja", "minha-loja.myshopify.com" ou a URL do admin → "minha-loja.myshopify.com" (ou null). */
export function normalizeShopDomain(input: string | null | undefined): string | null {
  if (!input) return null;
  let s = input.trim().toLowerCase().replace(/^https?:\/\//, "").split("/")[0];
  if (!s.includes(".")) s = `${s}.myshopify.com`;
  return SHOP_DOMAIN.test(s) ? s : null;
}

/** Confere a assinatura (hmac) que a Shopify manda no retorno do OAuth. */
export function verifyShopifyHmac(params: URLSearchParams, secret: string): boolean {
  const hmac = params.get("hmac");
  if (!hmac) return false;
  const message = [...params.entries()]
    .filter(([k]) => k !== "hmac" && k !== "signature")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
  const digest = createHmac("sha256", secret).update(message).digest("hex");
  const a = Buffer.from(digest);
  const b = Buffer.from(hmac);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function gql<T>(shop: string, token: string, query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(`https://${shop}/admin/api/${API_VERSION}/graphql.json`, {
    method: "POST",
    headers: { "X-Shopify-Access-Token": token, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(30_000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.errors) {
    const msg = Array.isArray(data.errors) ? data.errors.map((e: { message?: string }) => e.message).join("; ") : data.errors || `Shopify ${res.status}`;
    throw new StoreApiError(String(msg).slice(0, 300), res.status, res.status === 401 || res.status === 403);
  }
  return data.data as T;
}

function userErrors(errors: { message: string }[] | undefined) {
  if (errors?.length) throw new StoreApiError(errors.map((e) => e.message).join("; "), 400);
}

interface ShopifyProduct {
  id: string;
  title: string;
  onlineStoreUrl: string | null;
  featuredMedia: { preview?: { image?: { url: string } | null } | null } | null;
  mediaCount?: { count: number } | null;
}

const PRODUCT_FIELDS = "id title onlineStoreUrl featuredMedia { preview { image { url } } } mediaCount { count }";

function toItem(p: ShopifyProduct): StoreItem {
  return {
    id: p.id,
    title: p.title,
    thumbnail: p.featuredMedia?.preview?.image?.url || null,
    permalink: p.onlineStoreUrl,
    pictureCount: p.mediaCount?.count ?? 0,
    maxPictures: 250,
  };
}

export const shopify: StoreAdapter = {
  provider: "SHOPIFY",
  slug: "shopify",
  label: "Shopify",
  target: "SHOPIFY_PRODUCT",
  refreshable: false,

  async getApp() {
    const { secrets } = await getAppConfig();
    return secrets.shopifyClientId && secrets.shopifyClientSecret ? { appId: secrets.shopifyClientId, secret: secrets.shopifyClientSecret } : null;
  },

  buildAuthUrl({ appId, redirectUri, state, shop }) {
    if (!shop) throw new StoreApiError("Informe o endereço da loja Shopify", 400);
    const url = new URL(`https://${shop}/admin/oauth/authorize`);
    url.searchParams.set("client_id", appId);
    url.searchParams.set("scope", SCOPES);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("state", state);
    return url.toString();
  },

  async exchangeCode({ appId, secret, code, shop }) {
    if (!shop) throw new StoreApiError("Loja Shopify não informada", 400);
    const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: appId, client_secret: secret, code }),
      signal: AbortSignal.timeout(30_000),
    });
    const t = await res.json().catch(() => ({}));
    if (!res.ok || !t.access_token) throw new StoreApiError(t?.error_description || "Não foi possível autorizar a loja Shopify", res.status);
    const info = await gql<{ shop: { name: string } }>(shop, t.access_token, "{ shop { name } }").catch(() => null);
    return {
      accessToken: t.access_token,
      refreshToken: null,
      expiresAt: null,
      externalUserId: shop,
      displayName: info?.shop.name || shop,
      scopes: String(t.scope || "").split(",").filter(Boolean),
    };
  },

  async searchItems(conn, q) {
    const query = q.trim() ? `title:*${q.trim().replace(/["\\]/g, "")}*` : null;
    const data = await gql<{ products: { nodes: ShopifyProduct[] } }>(
      conn.externalUserId, conn.token,
      `query($q: String) { products(first: 20, query: $q, sortKey: UPDATED_AT, reverse: true) { nodes { ${PRODUCT_FIELDS} } } }`,
      { q: query }
    );
    return data.products.nodes.map(toItem);
  },

  async getItem(conn, id) {
    if (!/^gid:\/\/shopify\/Product\/\d+$/.test(id)) return null;
    const data = await gql<{ product: ShopifyProduct | null }>(conn.externalUserId, conn.token, `query($id: ID!) { product(id: $id) { ${PRODUCT_FIELDS} } }`, { id });
    return data.product ? toItem(data.product) : null;
  },

  async addImage(conn: LiveConnection, itemId, image, asCover) {
    const product = await this.getItem(conn, itemId);
    if (!product) throw new StoreApiError("Produto não encontrado nesta loja", 404);

    // 1) Pede um endereço de upload temporário; 2) envia o arquivo; 3) anexa ao produto.
    const staged = await gql<{ stagedUploadsCreate: { stagedTargets: { url: string; resourceUrl: string; parameters: { name: string; value: string }[] }[]; userErrors: { message: string }[] } }>(
      conn.externalUserId, conn.token,
      `mutation($input: [StagedUploadInput!]!) { stagedUploadsCreate(input: $input) { stagedTargets { url resourceUrl parameters { name value } } userErrors { message } } }`,
      { input: [{ resource: "IMAGE", filename: image.filename, mimeType: image.mimeType, httpMethod: "POST", fileSize: String(image.buffer.length) }] }
    );
    userErrors(staged.stagedUploadsCreate.userErrors);
    const target = staged.stagedUploadsCreate.stagedTargets[0];
    const form = new FormData();
    for (const p of target.parameters) form.append(p.name, p.value);
    form.append("file", new Blob([new Uint8Array(image.buffer)], { type: image.mimeType }), image.filename);
    const up = await fetch(target.url, { method: "POST", body: form, signal: AbortSignal.timeout(60_000) });
    if (!up.ok) throw new StoreApiError(`Falha ao enviar a imagem para a Shopify (${up.status})`, up.status);

    const updated = await gql<{ productUpdate: { product: { media: { nodes: { id: string }[] } } | null; userErrors: { message: string }[] } }>(
      conn.externalUserId, conn.token,
      `mutation($product: ProductUpdateInput!, $media: [CreateMediaInput!]) {
        productUpdate(product: $product, media: $media) { product { media(last: 1) { nodes { id } } } userErrors { message } }
      }`,
      { product: { id: itemId }, media: [{ originalSource: target.resourceUrl, mediaContentType: "IMAGE", alt: image.filename }] }
    );
    userErrors(updated.productUpdate.userErrors);
    const mediaId = updated.productUpdate.product?.media.nodes[0]?.id;
    if (asCover && mediaId) {
      // Reordenar é assíncrono na Shopify; se falhar, a imagem continua no produto (só não vira capa).
      await gql(conn.externalUserId, conn.token,
        `mutation($id: ID!, $moves: [MoveInput!]!) { productReorderMedia(id: $id, moves: $moves) { userErrors { message } } }`,
        { id: itemId, moves: [{ id: mediaId, newPosition: "0" }] }
      ).catch((e) => console.warn("[shopify] não foi possível colocar a imagem como capa", e));
    }
    return { externalId: mediaId || target.resourceUrl, permalink: product.permalink };
  },
};
