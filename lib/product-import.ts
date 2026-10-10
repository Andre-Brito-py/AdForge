import { safeFetch, SafeFetchError } from "./safe-fetch";

/**
 * Importar produto pelo link da loja: nome, descrição, preço, fotos e AVALIAÇÕES dos compradores.
 *  - Mercado Livre: API oficial (anúncio, descrição e avaliações), com o token da loja conectada quando houver;
 *  - Shopify: /products/{handle}.js, público em toda loja;
 *  - demais lojas (Nuvemshop, VTEX, WooCommerce, Tray, Loja Integrada, Shopee...): dados estruturados que a página
 *    publica para o Google (JSON-LD schema.org/Product) e, na falta deles, as metatags Open Graph.
 * As avaliações viram argumento de venda no roteiro (ver services/ai/text.ts).
 */

export interface ImportedReview {
  rating: number | null;
  text: string;
}

export interface ImportedProduct {
  source: "mercadolivre" | "shopify" | "page";
  url: string;
  name: string;
  description: string | null;
  price: number | null;
  currency: string | null;
  brand: string | null;
  category: string | null;
  images: string[];
  rating: { value: number; count: number } | null;
  reviews: ImportedReview[];
}

export class ProductImportError extends Error {
  constructor(message: string, readonly code: "INVALID_URL" | "BLOCKED" | "UNREADABLE" | "NOT_FOUND" | "ML_AUTH") {
    super(message);
  }
}

const MAX_REVIEWS = 12;

// ---------- utilidades ----------

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
export function decodeEntities(s: string) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

/** Texto limpo de HTML (parágrafos viram quebras de linha). */
export function htmlToText(html: string, max = 2000) {
  const text = decodeEntities(
    html
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<br\s*\/?>|<\/(p|div|li|h\d)>/gi, "\n")
      .replace(/<li[^>]*>/gi, "• ")
      // Tags de texto (negrito, link...) somem sem deixar espaço: "<b>24h</b>." -> "24h."
      .replace(/<\/?(b|strong|i|em|u|span|a|small|sup|sub|font|mark)\b[^>]*>/gi, "")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/[ \t\f\v\u00a0]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    // Itens de lista colados (lojas põem <p> dentro de <li>).
    .replace(/\n+(?=• )/g, "\n")
    .replace(/• \n+/g, "• ")
    .trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

function cut(s: string | null | undefined, max: number) {
  if (!s) return null;
  const t = decodeEntities(String(s)).replace(/\s+/g, " ").trim();
  if (!t) return null;
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

/** "1.299,90", "1,299.90", "129.9", 129.9 -> número. */
export function parsePrice(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) && v > 0 ? v : null;
  if (typeof v !== "string") return null;
  let s = v.replace(/[^\d.,]/g, "");
  if (!s) return null;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma > lastDot) s = s.replace(/\./g, "").replace(",", ".");
  else if (lastDot > lastComma && lastComma >= 0) s = s.replace(/,/g, "");
  else if (lastComma >= 0 && lastDot < 0) s = s.replace(",", ".");
  // "1.299" sem centavos (milhar) vs "12.9": três dígitos depois do único ponto = milhar.
  else if (lastDot >= 0 && /^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

function absolute(u: unknown, base: string): string | null {
  if (typeof u !== "string" || !u.trim()) return null;
  try {
    const url = new URL(u.trim().startsWith("//") ? `https:${u.trim()}` : u.trim(), base);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function uniq<T>(list: T[]) {
  return [...new Set(list)];
}

/** Normaliza o que o cliente colou ("loja.com/produto", espaços, texto antes do link). */
export function normalizeProductUrl(input: string): string {
  const match = /https?:\/\/[^\s<>"']+/i.exec(input);
  const raw = (match ? match[0] : input).trim();
  const withProto = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(withProto);
    if (!url.hostname.includes(".")) throw new Error();
    return url.toString();
  } catch {
    throw new ProductImportError("Link inválido", "INVALID_URL");
  }
}

// ---------- JSON-LD / Open Graph ----------

type Json = Record<string, unknown>;

function ldBlocks(html: string): unknown[] {
  const out: unknown[] = [];
  const re = /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const raw = m[1].trim().replace(/^<!--|-->$/g, "");
    try {
      out.push(JSON.parse(raw));
    } catch {
      try {
        out.push(JSON.parse(raw.replace(/[\u0000-\u001f]+/g, " ")));
      } catch {
        /* bloco inválido: ignora */
      }
    }
  }
  return out;
}

function isType(node: Json, type: string) {
  const t = node["@type"];
  return Array.isArray(t) ? t.some((x) => String(x).toLowerCase() === type) : String(t || "").toLowerCase() === type;
}

/** Primeiro schema.org/Product (dentro de @graph, listas ou ProductGroup). */
export function findLdProduct(blocks: unknown[]): Json | null {
  const stack = [...blocks];
  while (stack.length) {
    const node = stack.shift();
    if (Array.isArray(node)) {
      stack.push(...node);
      continue;
    }
    if (!node || typeof node !== "object") continue;
    const obj = node as Json;
    if (isType(obj, "product") || isType(obj, "productgroup")) return obj;
    if (obj["@graph"]) stack.push(obj["@graph"]);
    if (obj.mainEntity) stack.push(obj.mainEntity);
  }
  return null;
}

function text(v: unknown): string | null {
  if (typeof v === "string") return v;
  if (v && typeof v === "object" && typeof (v as Json).name === "string") return (v as Json).name as string;
  return null;
}

function ldImages(v: unknown, base: string): string[] {
  const list = Array.isArray(v) ? v : [v];
  return list
    .map((x) => (typeof x === "string" ? x : x && typeof x === "object" ? ((x as Json).url ?? (x as Json).contentUrl) : null))
    .map((x) => absolute(x, base))
    .filter((x): x is string => !!x);
}

function ldOffer(v: unknown): { price: number | null; currency: string | null } {
  const list = Array.isArray(v) ? v : [v];
  for (const o of list) {
    if (!o || typeof o !== "object") continue;
    const offer = o as Json;
    const spec = offer.priceSpecification as Json | undefined;
    const price = parsePrice(offer.price ?? offer.lowPrice ?? spec?.price);
    if (price) return { price, currency: typeof offer.priceCurrency === "string" ? offer.priceCurrency : typeof spec?.priceCurrency === "string" ? (spec.priceCurrency as string) : null };
    if (offer.offers) return ldOffer(offer.offers);
  }
  return { price: null, currency: null };
}

function ldReviews(v: unknown): ImportedReview[] {
  const list = Array.isArray(v) ? v : v ? [v] : [];
  return list
    .map((r) => {
      if (!r || typeof r !== "object") return null;
      const review = r as Json;
      const body = cut((review.reviewBody ?? review.description) as string, 300);
      const rating = Number(((review.reviewRating as Json | undefined)?.ratingValue) ?? NaN);
      return body ? { rating: Number.isFinite(rating) ? rating : null, text: body } : null;
    })
    .filter((x): x is ImportedReview => !!x);
}

function meta(html: string, key: string): string | null {
  const re = new RegExp(`<meta[^>]+(?:property|name|itemprop)\\s*=\\s*["']${key.replace(/[.:]/g, "\\$&")}["'][^>]*>`, "i");
  const tag = re.exec(html)?.[0];
  if (!tag) return null;
  const content = /content\s*=\s*["']([^"']*)["']/i.exec(tag)?.[1];
  return content ? decodeEntities(content).trim() || null : null;
}

/** Produto a partir do HTML da página (JSON-LD, com Open Graph como reserva). */
export function parseProductPage(html: string, url: string): ImportedProduct {
  const ld = findLdProduct(ldBlocks(html));
  const variant = ld && Array.isArray(ld.hasVariant) ? (ld.hasVariant[0] as Json) : null;
  const offer = ldOffer(ld?.offers ?? variant?.offers);
  const agg = (ld?.aggregateRating ?? null) as Json | null;
  const ratingValue = Number(agg?.ratingValue);
  const ratingCount = Number(agg?.reviewCount ?? agg?.ratingCount);
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1];

  const images = uniq([
    ...ldImages(ld?.image ?? variant?.image, url),
    ...[meta(html, "og:image:secure_url"), meta(html, "og:image"), meta(html, "twitter:image")].map((x) => absolute(x, url)).filter((x): x is string => !!x),
  ]);

  return {
    source: "page",
    url,
    name: cut(text(ld?.name) || meta(html, "og:title") || title, 120) || "",
    description: (() => {
      const d = (typeof ld?.description === "string" && ld.description) || meta(html, "og:description") || meta(html, "description");
      return d ? htmlToText(d) || null : null;
    })(),
    price: offer.price ?? parsePrice(meta(html, "product:price:amount") || meta(html, "og:price:amount")),
    currency: (offer.currency || meta(html, "product:price:currency") || meta(html, "og:price:currency") || null)?.toUpperCase() ?? null,
    brand: cut(text(ld?.brand), 80),
    category: cut(typeof ld?.category === "string" ? ld.category.split(/[>/|]/).pop() : null, 80),
    images,
    rating: Number.isFinite(ratingValue) && ratingValue > 0 ? { value: Math.round(ratingValue * 10) / 10, count: Number.isFinite(ratingCount) ? ratingCount : 0 } : null,
    reviews: ldReviews(ld?.review).slice(0, MAX_REVIEWS),
  };
}

// ---------- Shopify ----------

function shopifyHandle(url: URL) {
  return /\/products\/([^/?#]+)/.exec(url.pathname)?.[1] ?? null;
}

interface ShopifyJs {
  title?: string;
  description?: string;
  vendor?: string;
  type?: string;
  price?: number;
  images?: string[];
}

async function enrichFromShopify(page: ImportedProduct, html: string): Promise<ImportedProduct> {
  const url = new URL(page.url);
  const handle = shopifyHandle(url);
  if (!handle || !/cdn\.shopify\.com|Shopify\.shop|shopify-section/i.test(html)) return page;
  try {
    const res = await safeFetch(`${url.origin}/products/${handle}.js`, { accept: "application/json", maxBytes: 2 * 1024 * 1024 });
    const p = JSON.parse(res.body.toString("utf8")) as ShopifyJs;
    const currency = /Shopify\.currency\s*=\s*\{[^}]*"active"\s*:\s*"([A-Z]{3})"/.exec(html)?.[1] || page.currency;
    return {
      ...page,
      source: "shopify",
      name: cut(p.title, 120) || page.name,
      description: p.description ? htmlToText(p.description) : page.description,
      price: typeof p.price === "number" && p.price > 0 ? p.price / 100 : page.price,
      currency,
      brand: cut(p.vendor, 80) || page.brand,
      category: cut(p.type, 80) || page.category,
      images: uniq([...(p.images || []).map((i) => absolute(i, url.origin)).filter((x): x is string => !!x), ...page.images]),
    };
  } catch {
    return page; // fica com o que a página já trouxe
  }
}

// ---------- Mercado Livre ----------

const ML_API = (process.env.ML_API_BASE_URL || "https://api.mercadolibre.com").replace(/\/$/, "");

export function isMercadoLivre(url: URL) {
  return /(^|\.)mercadoli(vre|bre)\.com(\.[a-z]{2})?$/i.test(url.hostname) || /(^|\.)mercadolivre\.com$/i.test(url.hostname);
}

/** "MLB-1234567890" / "MLB1234567890" (anúncio) ou "/p/MLB123" (produto de catálogo). */
export function mercadoLivreIds(url: URL): { item: string | null; catalog: string | null } {
  const catalog = /\/p\/(ML[A-Z])(\d+)/i.exec(url.pathname);
  const itemFromQuery = url.searchParams.get("item_id") || url.searchParams.get("wid");
  const item = /(ML[A-Z])-?(\d{6,})/i.exec(itemFromQuery || url.pathname);
  return {
    item: item ? `${item[1].toUpperCase()}${item[2]}` : null,
    catalog: catalog ? `${catalog[1].toUpperCase()}${catalog[2]}` : null,
  };
}

async function ml<T>(path: string, token?: string | null): Promise<T> {
  const res = await fetch(`${ML_API}${path}`, {
    headers: { Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) throw new Error(`Mercado Livre ${res.status}`);
  return (await res.json()) as T;
}

interface MlItem {
  id: string;
  title: string;
  price?: number;
  currency_id?: string;
  pictures?: { secure_url?: string; url?: string }[];
  attributes?: { id: string; value_name?: string | null }[];
  permalink?: string;
}

async function fromMercadoLivre(ids: { item: string | null; catalog: string | null }, url: string, token?: string | null): Promise<ImportedProduct | null> {
  let itemId = ids.item;
  let catalogName: string | null = null;
  let catalogPictures: string[] = [];
  let catalogDescription: string | null = null;
  if (!itemId && ids.catalog) {
    const p = await ml<{ name?: string; pictures?: { url?: string }[]; short_description?: { content?: string }; buy_box_winner?: { item_id?: string } | null }>(
      `/products/${ids.catalog}`,
      token
    );
    itemId = p.buy_box_winner?.item_id || null;
    catalogName = p.name || null;
    catalogPictures = (p.pictures || []).map((x) => x.url).filter((x): x is string => !!x);
    catalogDescription = p.short_description?.content || null;
  }
  if (!itemId) {
    if (!catalogName) return null;
    return {
      source: "mercadolivre", url, name: cut(catalogName, 120) || "", description: catalogDescription ? htmlToText(catalogDescription) : null,
      price: null, currency: "BRL", brand: null, category: null, images: catalogPictures, rating: null, reviews: [],
    };
  }

  const [item, description, reviews] = await Promise.all([
    ml<MlItem>(`/items/${itemId}`, token),
    ml<{ plain_text?: string }>(`/items/${itemId}/description`, token).catch(() => null),
    ml<{ reviews?: { rate?: number; content?: string; title?: string }[]; rating_average?: number; paging?: { total?: number } }>(
      `/reviews/item/${itemId}?limit=${MAX_REVIEWS * 2}`,
      token
    ).catch(() => null),
  ]);
  const attr = (id: string) => item.attributes?.find((a) => a.id === id)?.value_name || null;
  const reviewList = (reviews?.reviews || [])
    .map((r) => ({ rating: typeof r.rate === "number" ? r.rate : null, text: cut([r.title, r.content].filter(Boolean).join(". "), 300) || "" }))
    .filter((r) => r.text)
    .slice(0, MAX_REVIEWS);
  return {
    source: "mercadolivre",
    url: item.permalink || url,
    name: cut(item.title || catalogName, 120) || "",
    description: description?.plain_text ? htmlToText(description.plain_text) : catalogDescription ? htmlToText(catalogDescription) : null,
    price: typeof item.price === "number" && item.price > 0 ? item.price : null,
    currency: item.currency_id || "BRL",
    brand: cut(attr("BRAND"), 80),
    category: null,
    images: uniq([...(item.pictures || []).map((p) => p.secure_url || p.url).filter((x): x is string => !!x), ...catalogPictures]),
    rating: reviews?.rating_average ? { value: Math.round(reviews.rating_average * 10) / 10, count: reviews.paging?.total || reviewList.length } : null,
    reviews: reviewList,
  };
}

// ---------- entrada ----------

function mapFetchError(error: unknown): never {
  if (error instanceof SafeFetchError) {
    if (error.code === "INVALID_URL") throw new ProductImportError(error.message, "INVALID_URL");
    if (error.code === "BLOCKED") throw new ProductImportError(error.message, "BLOCKED");
  }
  throw new ProductImportError(error instanceof Error ? error.message : "Página indisponível", "UNREADABLE");
}

/**
 * Lê o produto do link. `mlToken`: token da conta do Mercado Livre conectada (a API pública às vezes exige).
 */
export async function importProduct(input: string, opts: { mlToken?: () => Promise<string | null> } = {}): Promise<ImportedProduct> {
  const url = normalizeProductUrl(input);
  let parsed = new URL(url);

  // Mercado Livre com o código do anúncio no link: direto pela API (a página é pesada e às vezes bloqueia robôs).
  if (isMercadoLivre(parsed)) {
    let ids = mercadoLivreIds(parsed);
    if (!ids.item && !ids.catalog) {
      // Link curto do app ("mercadolivre.com/sec/..."): segue o redirecionamento até o anúncio.
      const page = await safeFetch(url).catch(mapFetchError);
      parsed = new URL(page.url);
      ids = mercadoLivreIds(parsed);
      if (!ids.item && !ids.catalog) return finalize(parseProductPage(page.body.toString("utf8"), page.url));
    }
    let token: string | null = null;
    try {
      return finalize(await fromMercadoLivre(ids, parsed.toString()));
    } catch {
      token = (await opts.mlToken?.().catch(() => null)) ?? null;
    }
    if (token) {
      const withToken = await fromMercadoLivre(ids, parsed.toString(), token).catch(() => null);
      if (withToken) return finalize(withToken);
    }
    // API recusou: tenta os dados estruturados da própria página. Sem token, o Mercado Livre costuma mandar
    // robôs para uma tela de verificação; aí o caminho é conectar a conta em Integrações.
    try {
      const page = await safeFetch(parsed.toString()).catch(mapFetchError);
      return finalize(parseProductPage(page.body.toString("utf8"), page.url));
    } catch (error) {
      if (!token && error instanceof ProductImportError && error.code !== "INVALID_URL" && error.code !== "BLOCKED") {
        throw new ProductImportError("O Mercado Livre exige uma conta conectada", "ML_AUTH");
      }
      throw error;
    }
  }

  const page = await safeFetch(url).catch(mapFetchError);
  const html = page.body.toString("utf8");
  return finalize(await enrichFromShopify(parseProductPage(html, page.url), html));
}

function finalize(p: ImportedProduct | null): ImportedProduct {
  if (!p || !p.name || p.images.length === 0) {
    throw new ProductImportError("Não encontramos os dados do produto nesta página", "NOT_FOUND");
  }
  return { ...p, images: p.images.slice(0, 6), reviews: p.reviews.slice(0, MAX_REVIEWS) };
}
