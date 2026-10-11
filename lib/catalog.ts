/**
 * Fonte única de verdade para as opções de campanha. O front-end exibe estes rótulos
 * e o back-end valida contra estas chaves, então nunca confiamos em texto livre do cliente
 * para decidir custo, formato ou tipo de mídia.
 */

export const OBJECTIVES = {
  SALES: { label: "Vendas diretas", description: "Foco em conversão e urgência" },
  AWARENESS: { label: "Reconhecimento de marca", description: "Fazer a marca ser lembrada" },
  ENGAGEMENT: { label: "Engajamento", description: "Gerar comentários e interação" },
  LAUNCH: { label: "Lançamento", description: "Apresentar um produto novo" },
} as const;

/**
 * Onde o anúncio roda (define o formato). `media` é o tipo padrão; `mediaOptions` diz o que o cliente pode
 * escolher — Feed, Facebook e Stories aceitam imagem OU vídeo; Reels/TikTok é sempre vídeo.
 */
export const PLATFORMS = {
  INSTAGRAM_FEED: { label: "Instagram Feed", media: "IMAGE", mediaOptions: ["IMAGE", "VIDEO"], aspectRatio: "4:5", hint: "4:5 · imagem ou vídeo" },
  FACEBOOK_ADS: { label: "Facebook Ads", media: "IMAGE", mediaOptions: ["IMAGE", "VIDEO"], aspectRatio: "1:1", hint: "1:1 · imagem ou vídeo" },
  STORIES: { label: "Stories", media: "IMAGE", mediaOptions: ["IMAGE", "VIDEO"], aspectRatio: "9:16", hint: "9:16 · imagem ou vídeo" },
  REELS_TIKTOK: { label: "Reels / TikTok", media: "VIDEO", mediaOptions: ["VIDEO"], aspectRatio: "9:16", hint: "Vídeo 9:16 + locução" },
} as const;

export const MEDIA_KINDS = ["IMAGE", "VIDEO"] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];

/** Tipo de mídia efetivo: o pedido, se o formato aceitar; senão o padrão do formato (campanhas antigas = padrão). */
export function resolveMedia(platform: PlatformKey, requested?: string | null): MediaKind {
  const options = PLATFORMS[platform].mediaOptions as readonly string[];
  return requested && options.includes(requested) ? (requested as MediaKind) : PLATFORMS[platform].media;
}

export const STYLES = {
  CINEMATIC: "Cinematográfico",
  MINIMALIST: "Minimalista",
  STUDIO: "Estúdio profissional",
  LIFESTYLE: "Lifestyle",
  UGC: "UGC (conteúdo de usuário)",
  NEON: "Neon / Cyberpunk",
} as const;

export const QUALITIES = {
  standard: { label: "Padrão", description: "Ótimo para testar várias ofertas rapidamente" },
  premium: { label: "Premium", description: "Resolução maior e modelo mais avançado" },
} as const;

export const VARIATION_OPTIONS = [1, 2, 3, 4] as const;
export const MAX_VARIATIONS = 4;
/** Imagens de referência além da foto do produto (pessoa/modelo, cenário, estilo...). */
export const MAX_REFERENCES = 3;

/**
 * A pessoa em cena fala a locução (lábios sincronizados) quando há alguém apresentando o produto;
 * sem apresentador (só o produto), a locução fica como narração em off. Decisão automática, para todos os vídeos.
 */
export function isSpeakingOnCamera(presenter: string | null | undefined): boolean {
  return presenter === "female" || presenter === "male";
}

/**
 * Vídeos longos são feitos em trechos de 5 s: cada trecho parte do último quadro do anterior
 * (continuidade) e no fim tudo é unido com a locução. O custo em créditos é por trecho.
 */
export const VIDEO_SEGMENT_SECONDS = 5;
/** Durações oferecidas para modelos que geram cada pedido do zero (Wan, Kling, Veo Lite). */
export const VIDEO_DURATIONS = [5, 10, 15, 20, 30] as const;
/**
 * Para modelos que ESTENDEM o próprio vídeo (Veo 3.1 / Fast): 8 s + blocos de 7 s. São exatamente os segundos que o
 * provedor cobra; um vídeo de 10 s custaria 15 s gerados (e o excedente seria cortado).
 */
export const EXTENSION_DURATIONS = [8, 15, 22, 29] as const;
export const ALL_VIDEO_DURATIONS: readonly number[] = [...new Set<number>([...VIDEO_DURATIONS, ...EXTENSION_DURATIONS])].sort((a, b) => a - b);
export type VideoDuration = number;

/** Blocos de 5 s cobrados (arredonda para cima: 8 s = 2 blocos, 22 s = 5). */
export function videoSegments(duration: number | null | undefined): number {
  const d = typeof duration === "number" && duration > 0 && duration <= 60 ? duration : VIDEO_SEGMENT_SECONDS;
  return Math.max(1, Math.ceil(d / VIDEO_SEGMENT_SECONDS));
}

/** A duração aceita mais próxima (a menor que cobre o pedido; senão a maior). */
export function snapDuration(requested: number, allowed: readonly number[]): number {
  return allowed.find((d) => d >= requested) ?? allowed[allowed.length - 1];
}

export type ObjectiveKey = keyof typeof OBJECTIVES;
export type PlatformKey = keyof typeof PLATFORMS;
export type StyleKey = keyof typeof STYLES;
export type QualityKey = keyof typeof QUALITIES;

export interface AiCosts {
  image: number;
  video: number;
  premiumMultiplier: number;
  /** Ajustes do custo real dos provedores (ver lib/provider-pricing.ts). */
  usd?: Partial<Record<string, number>>;
}

/**
 * Créditos padrão (o Admin substitui): vídeo de 15 s = 75 créditos, imagem = 2. O Premium ×1,5 cobre o Veo Fast;
 * com o Veo 3.1 normal (~2,7× mais caro por segundo) no Premium, use ×2,5 em Admin › IA e custos.
 */
export const DEFAULT_COSTS: AiCosts = { image: 2, video: 25, premiumMultiplier: 1.5 };

/** Créditos por variação. Para vídeo, `costs.video` é o preço de cada trecho de 5 s. */
export function costPerVariation(costs: AiCosts, platform: PlatformKey, quality: QualityKey, videoDuration?: number | null, media?: string | null): number {
  const isVideo = resolveMedia(platform, media) === "VIDEO";
  const base = isVideo ? costs.video * videoSegments(videoDuration) : costs.image;
  return quality === "premium" ? Math.ceil(base * costs.premiumMultiplier) : base;
}

export function campaignCost(costs: AiCosts, platform: PlatformKey, quality: QualityKey, variations: number, videoDuration?: number | null, media?: string | null): number {
  return costPerVariation(costs, platform, quality, videoDuration, media) * variations;
}

export const OBJECTIVE_KEYS = Object.keys(OBJECTIVES) as [ObjectiveKey, ...ObjectiveKey[]];
export const PLATFORM_KEYS = Object.keys(PLATFORMS) as [PlatformKey, ...PlatformKey[]];
export const STYLE_KEYS = Object.keys(STYLES) as [StyleKey, ...StyleKey[]];
export const QUALITY_KEYS = Object.keys(QUALITIES) as [QualityKey, ...QualityKey[]];

/** Rótulo legível para dados antigos (texto livre) ou chaves novas. */
export function labelFor(map: Record<string, string | { label: string }>, key: string | null | undefined): string {
  if (!key) return "—";
  const v = map[key];
  if (!v) return key;
  return typeof v === "string" ? v : v.label;
}
