import { getAppConfig } from "@/lib/config";
import { StoreApiError, type LiveConnection, type StoreAdapter, type StoreItem } from "./types";

/**
 * Mercado Livre. Fluxo: OAuth (com PKCE) → listar anúncios do vendedor →
 * enviar a imagem (/pictures/items/upload) → incluir no anúncio (PUT /items/{id}).
 * Tokens valem 6h; o refresh_token é de uso único e rotaciona a cada renovação.
 */
const API = (process.env.ML_API_BASE_URL || "https://api.mercadolibre.com").replace(/\/$/, "");
const AUTH = (process.env.ML_AUTH_BASE_URL || "https://auth.mercadolivre.com.br").replace(/\/$/, "");
const MAX_PICTURES = 12;
const ATTRS = "id,title,thumbnail,secure_thumbnail,pictures,permalink,status,seller_id,variations";

interface MlItem {
  id: string;
  title: string;
  thumbnail?: string;
  secure_thumbnail?: string;
  permalink?: string;
  seller_id?: number;
  pictures?: { id: string }[];
  variations?: { id: number; picture_ids?: string[] }[];
}

async function ml<T>(path: string, init: { method?: string; token?: string; body?: BodyInit; json?: unknown; form?: Record<string, string> } = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (init.token) headers.Authorization = `Bearer ${init.token}`;
  let body = init.body;
  if (init.json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(init.json);
  }
  if (init.form) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    body = new URLSearchParams(init.form).toString();
  }
  const res = await fetch(`${API}${path}`, { method: init.method || "GET", headers, body, signal: AbortSignal.timeout(30_000) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const cause = Array.isArray(data?.cause) && data.cause[0]?.message ? ` (${data.cause[0].message})` : "";
    const auth = res.status === 401 || data?.error === "invalid_token" || data?.error === "invalid_grant";
    throw new StoreApiError(`${data?.message || `Mercado Livre ${res.status}`}${cause}`, res.status, auth);
  }
  return data as T;
}

function toItem(i: MlItem): StoreItem {
  return {
    id: i.id,
    title: i.title,
    thumbnail: i.secure_thumbnail || i.thumbnail || null,
    permalink: i.permalink || null,
    pictureCount: i.pictures?.length || 0,
    maxPictures: MAX_PICTURES,
  };
}

async function fetchItems(token: string, ids: string[]): Promise<MlItem[]> {
  if (ids.length === 0) return [];
  const res = await ml<{ code: number; body: MlItem }[]>(`/items?ids=${ids.map(encodeURIComponent).join(",")}&attributes=${ATTRS}`, { token });
  return res.filter((r) => r.code === 200).map((r) => r.body);
}

export const mercadoLivre: StoreAdapter = {
  provider: "MERCADOLIVRE",
  slug: "mercadolivre",
  label: "Mercado Livre",
  target: "MERCADOLIVRE_ITEM",
  refreshable: true,

  async getApp() {
    const { secrets } = await getAppConfig();
    return secrets.mercadoLivreAppId && secrets.mercadoLivreSecret ? { appId: secrets.mercadoLivreAppId, secret: secrets.mercadoLivreSecret } : null;
  },

  buildAuthUrl({ appId, redirectUri, state, codeChallenge }) {
    const url = new URL(`${AUTH}/authorization`);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", appId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("state", state);
    if (process.env.ML_PKCE !== "false") {
      url.searchParams.set("code_challenge", codeChallenge);
      url.searchParams.set("code_challenge_method", "S256");
    }
    return url.toString();
  },

  async exchangeCode({ appId, secret, redirectUri, code, codeVerifier }) {
    const form: Record<string, string> = { grant_type: "authorization_code", client_id: appId, client_secret: secret, code, redirect_uri: redirectUri };
    if (process.env.ML_PKCE !== "false") form.code_verifier = codeVerifier;
    const t = await ml<{ access_token: string; refresh_token?: string; expires_in: number; user_id: number; scope?: string }>("/oauth/token", { method: "POST", form });
    const me = await ml<{ id: number; nickname?: string }>("/users/me", { token: t.access_token });
    return {
      accessToken: t.access_token,
      refreshToken: t.refresh_token || null,
      expiresAt: new Date(Date.now() + t.expires_in * 1000),
      externalUserId: String(me.id),
      displayName: me.nickname || null,
      scopes: (t.scope || "").split(" ").filter(Boolean),
    };
  },

  async refresh({ appId, secret, refreshToken }) {
    const t = await ml<{ access_token: string; refresh_token?: string; expires_in: number }>("/oauth/token", {
      method: "POST",
      form: { grant_type: "refresh_token", client_id: appId, client_secret: secret, refresh_token: refreshToken },
    });
    return { accessToken: t.access_token, refreshToken: t.refresh_token || refreshToken, expiresAt: new Date(Date.now() + t.expires_in * 1000) };
  },

  async searchItems(conn, q) {
    const params = new URLSearchParams({ status: "active", limit: "20" });
    if (q.trim()) params.set("q", q.trim());
    const res = await ml<{ results: string[] }>(`/users/${conn.externalUserId}/items/search?${params}`, { token: conn.token });
    return (await fetchItems(conn.token, res.results.slice(0, 20))).map(toItem);
  },

  async getItem(conn, id) {
    const [item] = await fetchItems(conn.token, [id]);
    // Só aceita anúncios do próprio vendedor conectado.
    if (!item || String(item.seller_id) !== conn.externalUserId) return null;
    return toItem(item);
  },

  async addImage(conn, itemId, image, asCover) {
    const [item] = await fetchItems(conn.token, [itemId]);
    if (!item || String(item.seller_id) !== conn.externalUserId) throw new StoreApiError("Anúncio não encontrado nesta conta do Mercado Livre", 404);
    const current = (item.pictures || []).map((p) => p.id);
    if (current.length >= MAX_PICTURES) throw new StoreApiError(`O anúncio já tem ${current.length} fotos (máximo do Mercado Livre). Remova alguma antes.`, 400);

    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(image.buffer)], { type: image.mimeType }), image.filename);
    const uploaded = await ml<{ id: string }>("/pictures/items/upload", { method: "POST", token: conn.token, body: form });

    const pictures = asCover ? [uploaded.id, ...current] : [...current, uploaded.id];
    const payload: { pictures: { id: string }[]; variations?: { id: number; picture_ids: string[] }[] } = { pictures: pictures.map((id) => ({ id })) };
    // Anúncios com variações: a foto nova também precisa ser associada a cada variação.
    if (item.variations?.length) {
      payload.variations = item.variations.map((v) => {
        const ids = v.picture_ids || [];
        return { id: v.id, picture_ids: asCover ? [uploaded.id, ...ids] : [...ids, uploaded.id] };
      });
    }
    await ml(`/items/${encodeURIComponent(itemId)}`, { method: "PUT", token: conn.token, json: payload });
    return { externalId: uploaded.id, permalink: item.permalink || null };
  },
};

export type { LiveConnection };
