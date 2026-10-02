import { getAppConfig } from "@/lib/config";
import { StoreApiError, type StoreAdapter, type StoreItem } from "./types";

/**
 * Nuvemshop (Tiendanube). O lojista instala o app pela URL de autorização; o token não expira
 * (vale até o app ser desinstalado). A API usa o header "Authentication: bearer ..." e exige User-Agent.
 */
const API = (process.env.NUVEMSHOP_API_BASE_URL || "https://api.nuvemshop.com.br/v1").replace(/\/$/, "");
const AUTH = (process.env.NUVEMSHOP_AUTH_BASE_URL || "https://www.nuvemshop.com.br").replace(/\/$/, "");

type I18n = Record<string, string> | string | null | undefined;
function text(v: I18n): string {
  if (!v) return "";
  if (typeof v === "string") return v;
  return v.pt || v.es || v.en || Object.values(v)[0] || "";
}

interface NsProduct {
  id: number;
  name: I18n;
  canonical_url?: string;
  images?: { id: number; src: string; position: number }[];
}

async function ns<T>(storeId: string, token: string, path: string, init: { method?: string; json?: unknown } = {}): Promise<T> {
  const { supportEmail } = (await getAppConfig()).settings.company;
  const res = await fetch(`${API}/${storeId}${path}`, {
    method: init.method || "GET",
    headers: {
      Authentication: `bearer ${token}`,
      "User-Agent": `Vysify (${supportEmail})`,
      "Content-Type": "application/json",
    },
    body: init.json !== undefined ? JSON.stringify(init.json) : undefined,
    signal: AbortSignal.timeout(30_000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new StoreApiError(data?.description || data?.message || `Nuvemshop ${res.status}`, res.status, res.status === 401);
  }
  return data as T;
}

function toItem(p: NsProduct): StoreItem {
  const images = [...(p.images || [])].sort((a, b) => a.position - b.position);
  return {
    id: String(p.id),
    title: text(p.name) || `Produto ${p.id}`,
    thumbnail: images[0]?.src || null,
    permalink: p.canonical_url || null,
    pictureCount: images.length,
    maxPictures: null,
  };
}

export const nuvemshop: StoreAdapter = {
  provider: "NUVEMSHOP",
  slug: "nuvemshop",
  label: "Nuvemshop",
  target: "NUVEMSHOP_PRODUCT",
  refreshable: false,

  async getApp() {
    const { secrets } = await getAppConfig();
    return secrets.nuvemshopAppId && secrets.nuvemshopSecret ? { appId: secrets.nuvemshopAppId, secret: secrets.nuvemshopSecret } : null;
  },

  // A URL de retorno é a cadastrada no Portal de Parceiros (não vai como parâmetro).
  buildAuthUrl({ appId, state }) {
    const url = new URL(`${AUTH}/apps/${encodeURIComponent(appId)}/authorize`);
    url.searchParams.set("state", state);
    return url.toString();
  },

  async exchangeCode({ appId, secret, code }) {
    const res = await fetch(`${AUTH}/apps/authorize/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: appId, client_secret: secret, grant_type: "authorization_code", code }),
      signal: AbortSignal.timeout(30_000),
    });
    const t = await res.json().catch(() => ({}));
    if (!res.ok || !t.access_token || !t.user_id) throw new StoreApiError(t?.error_description || "Não foi possível autorizar a loja", res.status);

    const storeId = String(t.user_id);
    const store = await ns<{ name?: I18n; url_with_protocol?: string }>(storeId, t.access_token, "/store?fields=name,url_with_protocol").catch(() => null);
    return {
      accessToken: t.access_token,
      refreshToken: null,
      expiresAt: null,
      externalUserId: storeId,
      displayName: text(store?.name) || `Loja ${storeId}`,
      scopes: String(t.scope || "").split(",").filter(Boolean),
    };
  },

  async searchItems(conn, q) {
    const params = new URLSearchParams({ per_page: "20", page: "1", fields: "id,name,images,canonical_url" });
    if (q.trim()) params.set("q", q.trim());
    try {
      const list = await ns<NsProduct[]>(conn.externalUserId, conn.token, `/products?${params}`);
      return list.map(toItem);
    } catch (error) {
      // A API responde 404 quando a busca não encontra nada.
      if (error instanceof StoreApiError && error.status === 404) return [];
      throw error;
    }
  },

  async getItem(conn, id) {
    if (!/^\d+$/.test(id)) return null;
    try {
      return toItem(await ns<NsProduct>(conn.externalUserId, conn.token, `/products/${id}?fields=id,name,images,canonical_url`));
    } catch (error) {
      if (error instanceof StoreApiError && error.status === 404) return null;
      throw error;
    }
  },

  async addImage(conn, itemId, image, asCover) {
    const product = await this.getItem(conn, itemId);
    if (!product) throw new StoreApiError("Produto não encontrado nesta loja", 404);
    // Envio em base64: funciona mesmo sem URL pública da imagem.
    const created = await ns<{ id: number; src: string }>(conn.externalUserId, conn.token, `/products/${itemId}/images`, {
      method: "POST",
      json: {
        attachment: image.buffer.toString("base64"),
        filename: image.filename,
        position: asCover ? 1 : product.pictureCount + 1,
      },
    });
    return { externalId: String(created.id), permalink: product.permalink };
  },
};
