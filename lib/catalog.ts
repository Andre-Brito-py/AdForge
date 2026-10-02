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

export const PLATFORMS = {
  INSTAGRAM_FEED: { label: "Instagram Feed", media: "IMAGE", aspectRatio: "4:5", hint: "Imagem 4:5" },
  FACEBOOK_ADS: { label: "Facebook Ads", media: "IMAGE", aspectRatio: "1:1", hint: "Imagem 1:1" },
  STORIES: { label: "Stories", media: "IMAGE", aspectRatio: "9:16", hint: "Imagem 9:16" },
  REELS_TIKTOK: { label: "Reels / TikTok", media: "VIDEO", aspectRatio: "9:16", hint: "Vídeo 9:16 + locução" },
} as const;

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
 * Vídeos longos são feitos em trechos de 5 s: cada trecho parte do último quadro do anterior
 * (continuidade) e no fim tudo é unido com a locução. O custo em créditos é por trecho.
 */
export const VIDEO_SEGMENT_SECONDS = 5;
export const VIDEO_DURATIONS = [5, 10, 15, 20, 30] as const;
export type VideoDuration = (typeof VIDEO_DURATIONS)[number];

export function videoSegments(duration: number | null | undefined): number {
  const d = VIDEO_DURATIONS.includes(duration as VideoDuration) ? (duration as number) : VIDEO_SEGMENT_SECONDS;
  return Math.round(d / VIDEO_SEGMENT_SECONDS);
}

export type ObjectiveKey = keyof typeof OBJECTIVES;
export type PlatformKey = keyof typeof PLATFORMS;
export type StyleKey = keyof typeof STYLES;
export type QualityKey = keyof typeof QUALITIES;

export interface AiCosts {
  image: number;
  video: number;
  premiumMultiplier: number;
}

export const DEFAULT_COSTS: AiCosts = { image: 3, video: 10, premiumMultiplier: 2 };

/** Créditos por variação. Para vídeo, `costs.video` é o preço de cada trecho de 5 s. */
export function costPerVariation(costs: AiCosts, platform: PlatformKey, quality: QualityKey, videoDuration?: number | null): number {
  const isVideo = PLATFORMS[platform].media === "VIDEO";
  const base = isVideo ? costs.video * videoSegments(videoDuration) : costs.image;
  return quality === "premium" ? Math.ceil(base * costs.premiumMultiplier) : base;
}

export function campaignCost(costs: AiCosts, platform: PlatformKey, quality: QualityKey, variations: number, videoDuration?: number | null): number {
  return costPerVariation(costs, platform, quality, videoDuration) * variations;
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
