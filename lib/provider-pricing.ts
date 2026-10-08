import { videoModelCaps } from "./video-models";

/**
 * Custo REAL estimado (US$) de cada geração, para o registro de uso e a margem no Admin.
 * Os valores padrão são estimativas de tabela pública dos provedores (out/2026) e mudam com o tempo:
 * o admin pode sobrescrever qualquer um em Admin › IA e custos, sem deploy.
 */

export interface ProviderPrices {
  /** Vídeo, por segundo gerado. */
  videoPerSecond: number;
  videoPremiumPerSecond: number;
  /** Lip-sync final (fal.ai sync), por segundo de vídeo. */
  lipsyncPerSecond: number;
  /** Uma imagem de anúncio (padrão / premium). */
  image: number;
  imagePremium: number;
  /** Quadro de abertura do vídeo: imagem premium + revisão, com média de tentativas. */
  keyframe: number;
  /** Locução de um vídeo de ~20 s (ElevenLabs). */
  voicePerVideo: number;
  /** Chamadas de texto (estratégia, moderação, direção de cena), por variação. */
  textPerVariation: number;
  /** Cotação usada para comparar o preço em reais com o custo em dólar. */
  brlPerUsd: number;
  eurPerUsd: number;
}

export type ProviderPriceOverrides = Partial<ProviderPrices>;

/** Preço por segundo de vídeo conforme o modelo escolhido (estimativas; ajustáveis no Admin). */
export function defaultVideoPerSecond(model: string, premium: boolean): number {
  if (/^veo-3\.1-lite/i.test(model)) return premium ? 0.08 : 0.05;
  if (/^veo-3\.1-fast/i.test(model)) return 0.15;
  if (/^veo-/i.test(model)) return 0.4;
  if (/wan\/v2\.(6|[7-9])|wan-2\.(6|[7-9])|wan\/v3|wan-3/i.test(model)) return premium ? 0.15 : 0.1;
  return premium ? 0.08 : 0.05; // Wan 2.1/2.2
}

function defaultImage(model: string): number {
  if (/sunburst/i.test(model)) return 0.25;
  if (/gpt-image/i.test(model)) return 0.07;
  if (/pro-image/i.test(model)) return 0.134;
  return 0.039; // Gemini Flash Image
}

export function defaultProviderPrices(models: { video: string; videoPremium: string; lipsync?: string; image: string; imagePremium: string; openaiImage: string; openaiImagePremium: string; imageProvider: string }): ProviderPrices {
  const openai = models.imageProvider === "openai";
  const image = defaultImage(openai ? models.openaiImage : models.image);
  const imagePremium = defaultImage(openai ? models.openaiImagePremium : models.imagePremium);
  return {
    videoPerSecond: defaultVideoPerSecond(models.video, false),
    videoPremiumPerSecond: defaultVideoPerSecond(models.videoPremium, true),
    lipsyncPerSecond: /pro/i.test(models.lipsync || "") ? 0.083 : 0.05,
    image,
    imagePremium,
    // Média de ~1,5 tentativa (a revisão às vezes pede outra) + a revisão em si.
    keyframe: Math.round((imagePremium * 1.5 + 0.01) * 1000) / 1000,
    voicePerVideo: 0.08,
    textPerVariation: 0.01,
    brlPerUsd: 5.4,
    eurPerUsd: 0.92,
  };
}

export function resolveProviderPrices(defaults: ProviderPrices, overrides?: ProviderPriceOverrides | null): ProviderPrices {
  const out = { ...defaults };
  for (const [k, v] of Object.entries(overrides || {})) {
    if (typeof v === "number" && Number.isFinite(v) && v >= 0) out[k as keyof ProviderPrices] = v;
  }
  return out;
}

/**
 * Custo estimado de UMA variação. Vídeo: segundos realmente gerados (o Veo estende 8+7+7 s), quadro de abertura,
 * locução e, com apresentador falando, o lip-sync final. Sem saber se haverá apresentador, conta o lip-sync
 * (estimativa conservadora).
 */
export function estimateVariationUsd(
  prices: ProviderPrices,
  opts: { media: "IMAGE" | "VIDEO"; premium: boolean; seconds?: number | null; videoModel?: string; lipsync?: boolean }
): number {
  if (opts.media === "IMAGE") return round((opts.premium ? prices.imagePremium : prices.image) + prices.textPerVariation);
  const seconds = generatedSeconds(opts.seconds || 5, opts.videoModel || "");
  const perSecond = opts.premium ? prices.videoPremiumPerSecond : prices.videoPerSecond;
  return round(
    seconds * perSecond +
      prices.keyframe +
      prices.voicePerVideo * Math.max(0.25, (opts.seconds || 5) / 20) +
      (opts.lipsync ? (opts.seconds || 5) * prices.lipsyncPerSecond : 0) +
      prices.textPerVariation * (1 + Math.ceil(seconds / 8))
  );
}

/** Segundos que o provedor cobra para entregar `target` s (Veo: 8 s + extensões de 7 s; Wan: blocos de 5/10/15 s). */
export function generatedSeconds(target: number, model: string): number {
  const caps = videoModelCaps(model);
  if (caps.extensionSeconds) {
    const first = Math.max(...caps.durations);
    return target <= first ? first : first + Math.ceil((target - first) / caps.extensionSeconds) * caps.extensionSeconds;
  }
  const step = Math.min(...caps.durations);
  return Math.ceil(target / step) * step;
}

function round(v: number) {
  return Math.round(v * 1000) / 1000;
}

/** Quanto vale um crédito (em US$) no pacote mais barato por crédito: o pior caso para a margem. */
export function worstRevenuePerCreditUsd(
  plans: { credits: number; price_brl: number; price_usd: number; price_eur?: number | null; isHidden?: boolean; isFree?: boolean }[],
  prices: Pick<ProviderPrices, "brlPerUsd" | "eurPerUsd">
): { usd: number; plan: number } | null {
  let worst: { usd: number; plan: number } | null = null;
  plans.forEach((p, i) => {
    if (p.isHidden || p.isFree || p.credits <= 0) return;
    const values = [
      p.price_usd > 0 ? p.price_usd : null,
      p.price_brl > 0 ? p.price_brl / prices.brlPerUsd : null,
      p.price_eur ? p.price_eur / prices.eurPerUsd : null,
    ].filter((v): v is number => v !== null);
    for (const v of values) {
      const perCredit = v / p.credits;
      if (!worst || perCredit < worst.usd) worst = { usd: perCredit, plan: i };
    }
  });
  return worst;
}
