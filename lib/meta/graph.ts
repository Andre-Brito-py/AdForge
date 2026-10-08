import { createHmac, timingSafeEqual } from "crypto";
import { getAppConfig } from "@/lib/config";

/**
 * Cliente mínimo da Graph API da Meta (Facebook + Instagram).
 * A versão e o ID de configuração do login vêm do painel Admin (ou META_GRAPH_VERSION /
 * META_LOGIN_CONFIG_ID). META_GRAPH_BASE_URL e META_DIALOG_BASE_URL apontam para um servidor simulado nos testes.
 */
async function metaSettings() {
  return (await getAppConfig()).settings.meta;
}
const GRAPH_BASE = (process.env.META_GRAPH_BASE_URL || "https://graph.facebook.com").replace(/\/$/, "");
const DIALOG_BASE = (process.env.META_DIALOG_BASE_URL || "https://www.facebook.com").replace(/\/$/, "");

/** Permissões pedidas no login (precisam passar pelo App Review para uso público). */
export const META_SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_posts",
  "instagram_basic",
  "instagram_content_publish",
  "business_management",
  // Anúncios pagos (criados sempre pausados): exigem o App Review dessas permissões.
  "ads_management",
  "ads_read",
];

export class MetaApiError extends Error {
  constructor(message: string, public code?: number, public subcode?: number, public status?: number) {
    super(message);
    this.name = "MetaApiError";
  }
  /** Token expirado, revogado ou senha trocada: o usuário precisa reconectar. */
  get isAuthError() {
    return this.code === 190 || this.code === 102 || this.status === 401;
  }
}

type Params = Record<string, string | number | boolean | undefined>;

async function graph<T = Record<string, unknown>>(path: string, opts: { method?: "GET" | "POST" | "DELETE"; params?: Params; token?: string } = {}): Promise<T> {
  const { graphVersion } = await metaSettings();
  const url = new URL(`${GRAPH_BASE}/${graphVersion}/${path.replace(/^\//, "")}`);
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(opts.params || {})) if (v !== undefined) params.set(k, String(v));
  const method = opts.method || "GET";
  const headers: Record<string, string> = {};
  // Token no header (não fica em logs de URL).
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;

  let body: string | undefined;
  if (method === "GET" || method === "DELETE") params.forEach((v, k) => url.searchParams.set(k, v));
  else {
    body = params.toString();
    headers["Content-Type"] = "application/x-www-form-urlencoded";
  }

  const res = await fetch(url, { method, headers, body, signal: AbortSignal.timeout(30_000) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.error) {
    const e = data?.error || {};
    throw new MetaApiError(e.error_user_msg || e.message || `Graph API ${res.status}`, e.code, e.error_subcode, res.status);
  }
  return data as T;
}

/** Acesso genérico à Graph API (usado pelos anúncios pagos em lib/meta/ads.ts). */
export const metaGraph = graph;

// ---------------- OAuth ----------------

export async function buildAuthUrl(opts: { appId: string; redirectUri: string; state: string }) {
  const { graphVersion, loginConfigId } = await metaSettings();
  const url = new URL(`${DIALOG_BASE}/${graphVersion}/dialog/oauth`);
  url.searchParams.set("client_id", opts.appId);
  url.searchParams.set("redirect_uri", opts.redirectUri);
  url.searchParams.set("state", opts.state);
  url.searchParams.set("response_type", "code");
  // "Facebook Login for Business" usa uma configuração criada no painel da Meta em vez de scopes.
  if (loginConfigId) url.searchParams.set("config_id", loginConfigId);
  else url.searchParams.set("scope", META_SCOPES.join(","));
  return url.toString();
}

/** Troca o code por um token de longa duração (~60 dias). */
export async function exchangeCodeForToken(opts: { appId: string; appSecret: string; redirectUri: string; code: string }) {
  const short = await graph<{ access_token: string }>("oauth/access_token", {
    params: { client_id: opts.appId, client_secret: opts.appSecret, redirect_uri: opts.redirectUri, code: opts.code },
  });
  const long = await graph<{ access_token: string; expires_in?: number }>("oauth/access_token", {
    params: { grant_type: "fb_exchange_token", client_id: opts.appId, client_secret: opts.appSecret, fb_exchange_token: short.access_token },
  });
  return {
    accessToken: long.access_token,
    expiresAt: long.expires_in ? new Date(Date.now() + long.expires_in * 1000) : null,
  };
}

export async function fetchMe(token: string) {
  return graph<{ id: string; name?: string }>("me", { token, params: { fields: "id,name" } });
}

export async function fetchGrantedScopes(token: string): Promise<string[]> {
  const res = await graph<{ data: { permission: string; status: string }[] }>("me/permissions", { token });
  return res.data.filter((p) => p.status === "granted").map((p) => p.permission);
}

export interface MetaPageAsset {
  pageId: string;
  pageName: string;
  instagram: { id: string; username: string | null; picture: string | null } | null;
}

/** Páginas que o usuário administra e as contas do Instagram profissionais ligadas a elas. */
export async function fetchAssets(token: string): Promise<MetaPageAsset[]> {
  const out: MetaPageAsset[] = [];
  let next: string | undefined = "me/accounts";
  let after: string | undefined;
  for (let guard = 0; next && guard < 10; guard++) {
    const res: {
      data: { id: string; name: string; instagram_business_account?: { id: string; username?: string; profile_picture_url?: string } }[];
      paging?: { cursors?: { after?: string }; next?: string };
    } = await graph(next, {
      token,
      params: { fields: "id,name,instagram_business_account{id,username,profile_picture_url}", limit: 100, after },
    });
    for (const p of res.data) {
      out.push({
        pageId: p.id,
        pageName: p.name,
        instagram: p.instagram_business_account
          ? { id: p.instagram_business_account.id, username: p.instagram_business_account.username || null, picture: p.instagram_business_account.profile_picture_url || null }
          : null,
      });
    }
    after = res.paging?.cursors?.after;
    next = res.paging?.next && after ? "me/accounts" : undefined;
  }
  return out;
}

export async function getPageAccessToken(userToken: string, pageId: string) {
  const res = await graph<{ access_token?: string }>(pageId, { token: userToken, params: { fields: "access_token" } });
  if (!res.access_token) throw new MetaApiError("Sem permissão para publicar nesta Página. Reconecte a conta e marque a Página.");
  return res.access_token;
}

export async function revokePermissions(token: string) {
  await graph("me/permissions", { method: "DELETE", token }).catch(() => undefined);
}

// ---------------- Instagram ----------------

export type IgMediaKind = "IMAGE" | "REELS" | "STORIES_IMAGE" | "STORIES_VIDEO";

export async function createIgContainer(opts: { igUserId: string; token: string; kind: IgMediaKind; mediaUrl: string; caption?: string }) {
  const params: Params = {};
  if (opts.kind === "IMAGE") Object.assign(params, { image_url: opts.mediaUrl, caption: opts.caption });
  if (opts.kind === "REELS") Object.assign(params, { media_type: "REELS", video_url: opts.mediaUrl, caption: opts.caption, share_to_feed: true });
  if (opts.kind === "STORIES_IMAGE") Object.assign(params, { media_type: "STORIES", image_url: opts.mediaUrl });
  if (opts.kind === "STORIES_VIDEO") Object.assign(params, { media_type: "STORIES", video_url: opts.mediaUrl });
  const res = await graph<{ id: string }>(`${opts.igUserId}/media`, { method: "POST", token: opts.token, params });
  return res.id;
}

/** FINISHED quando o vídeo terminou de processar; ERROR/EXPIRED são falhas. */
export async function getIgContainerStatus(containerId: string, token: string) {
  const res = await graph<{ status_code?: string; status?: string }>(containerId, { token, params: { fields: "status_code,status" } });
  return { code: res.status_code || "IN_PROGRESS", detail: res.status || null };
}

export async function publishIgContainer(igUserId: string, containerId: string, token: string) {
  const res = await graph<{ id: string }>(`${igUserId}/media_publish`, { method: "POST", token, params: { creation_id: containerId } });
  return res.id;
}

export async function getIgPermalink(mediaId: string, token: string) {
  const res = await graph<{ permalink?: string }>(mediaId, { token, params: { fields: "permalink" } }).catch(() => ({ permalink: undefined }));
  return res.permalink || null;
}

// ---------------- Facebook Page ----------------

export async function postPagePhoto(pageId: string, pageToken: string, imageUrl: string, message?: string) {
  const res = await graph<{ id: string; post_id?: string }>(`${pageId}/photos`, { method: "POST", token: pageToken, params: { url: imageUrl, message, published: true } });
  return res.post_id || res.id;
}

export async function postPageVideo(pageId: string, pageToken: string, videoUrl: string, description?: string) {
  const res = await graph<{ id: string }>(`${pageId}/videos`, { method: "POST", token: pageToken, params: { file_url: videoUrl, description, published: true } });
  return res.id;
}

// ---------------- Callbacks exigidos pela Meta ----------------

/** Valida o signed_request enviado pela Meta nos callbacks de desautorização e exclusão de dados. */
export function parseSignedRequest(signedRequest: string, appSecret: string): { user_id?: string; algorithm?: string } | null {
  const [sig, payload] = signedRequest.split(".");
  if (!sig || !payload) return null;
  const expected = createHmac("sha256", appSecret).update(payload).digest();
  const got = Buffer.from(sig.replace(/-/g, "+").replace(/_/g, "/"), "base64");
  if (got.length !== expected.length || !timingSafeEqual(got, expected)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));
    return data.algorithm?.toUpperCase() === "HMAC-SHA256" ? data : null;
  } catch {
    return null;
  }
}
