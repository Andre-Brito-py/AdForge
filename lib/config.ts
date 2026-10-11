import { db } from "./db";
import { decryptSecret } from "./crypto";
import { AiCosts, DEFAULT_COSTS } from "./catalog";
import { AiModels, costsSchema, modelsSchema, Plan, plansSchema } from "./validation";
import { resolveSettings, settingsSchema, type Settings, type StoredSettings } from "./settings";

export const SECRET_FIELDS = [
  "geminiKey",
  "openAiKey",
  "wanKey",
  "elevenLabsKey",
  "stripeSecretKey",
  "stripeWebhookSecret",
  "mercadoPagoAccessToken",
  "mercadoPagoWebhookSecret",
  "metaAppId",
  "metaAppSecret",
  "mercadoLivreAppId",
  "mercadoLivreSecret",
  "nuvemshopAppId",
  "nuvemshopSecret",
  "shopifyClientId",
  "shopifyClientSecret",
  "nfeioApiKey",
  "googleClientId",
  "googleClientSecret",
  "resendKey",
] as const;
export type SecretField = (typeof SECRET_FIELDS)[number];

// Variável de ambiente usada quando o segredo não foi definido pelo painel admin.
const ENV_FALLBACK: Record<SecretField, string> = {
  geminiKey: "GEMINI_API_KEY",
  openAiKey: "OPENAI_API_KEY",
  wanKey: "FAL_KEY",
  elevenLabsKey: "ELEVENLABS_API_KEY",
  stripeSecretKey: "STRIPE_SECRET_KEY",
  stripeWebhookSecret: "STRIPE_WEBHOOK_SECRET",
  mercadoPagoAccessToken: "MERCADOPAGO_ACCESS_TOKEN",
  mercadoPagoWebhookSecret: "MERCADOPAGO_WEBHOOK_SECRET",
  metaAppId: "META_APP_ID",
  metaAppSecret: "META_APP_SECRET",
  mercadoLivreAppId: "ML_APP_ID",
  mercadoLivreSecret: "ML_CLIENT_SECRET",
  nuvemshopAppId: "NUVEMSHOP_APP_ID",
  nuvemshopSecret: "NUVEMSHOP_CLIENT_SECRET",
  shopifyClientId: "SHOPIFY_CLIENT_ID",
  shopifyClientSecret: "SHOPIFY_CLIENT_SECRET",
  nfeioApiKey: "NFEIO_API_KEY",
  googleClientId: "GOOGLE_CLIENT_ID",
  googleClientSecret: "GOOGLE_CLIENT_SECRET",
  resendKey: "RESEND_API_KEY",
};

// gemini-2.5-* não é mais liberado para contas novas do Google (out/2026). Trocáveis em Admin › IA e custos.
export const DEFAULT_MODELS: AiModels = {
  textProvider: "gemini",
  imageProvider: "gemini",
  // OpenAI (out/2026): gpt-6.1-sol (texto + visão, equilibrado); gpt-image-2.5-flare (rápido) e -sunburst (máxima qualidade).
  openaiText: "gpt-6.1-sol",
  openaiImage: "gpt-image-2.5-flare",
  openaiImagePremium: "gpt-image-2.5-sunburst",
  text: "gemini-3.8-flash",
  image: "gemini-3.1-flash-image",
  imagePremium: "gemini-3-pro-image",
  // Wan 2.6: até 15 s por pedido (menos emendas), 720p/1080p e lip-sync com a locução (audio_url).
  // Os modelos Wan 2.1/2.2 continuam suportados (trechos de 5 s, sem lip-sync) se escolhidos no Admin.
  video: "wan/v2.6/image-to-video",
  videoPremium: "wan/v2.6/image-to-video",
  // Passe final de lip-sync: refaz a boca de quem fala no vídeo inteiro (o lip-sync do Wan às vezes atrasa).
  lipsyncEnabled: true,
  lipsync: "fal-ai/sync-lipsync/v2",
};

/**
 * Planos padrão (instalação nova; o Admin substitui). Calculados para o Veo 3.1 Fast com lip-sync (~R$ 17,80 por
 * vídeo de 15 s) e os créditos padrão (vídeo de 15 s = 75 créditos, imagem = 2): margem de ~30% a ~50% mesmo se o
 * cliente gastar tudo em vídeo. Revise em Admin › IA e custos › Custo real e margem.
 */
export const DEFAULT_PLANS: Plan[] = [
  {
    id: "pack", name: "Teste", description: "Um vídeo para conhecer o Vysify.", description_en: "One video to try Vysify.",
    price_brl: 45, price_usd: 9, price_eur: null, credits: 75, interval: "once",
    isFeatured: false, isFree: false, isHidden: false,
    features_pt: ["1 vídeo de 15 s ou ~37 imagens", "Copy, legendas e tela final inclusas", "Créditos não expiram"],
    features_en: ["1 15-second video or ~37 images", "Copy, captions and end screen included", "Credits never expire"],
  },
  {
    id: "pack-plus", name: "Avulso", description: "Créditos para usar quando quiser, sem assinatura.", description_en: "Credits to use anytime, no subscription.",
    price_brl: 119, price_usd: 24, price_eur: null, credits: 225, interval: "once",
    isFeatured: false, isFree: false, isHidden: false,
    features_pt: ["3 vídeos de 15 s ou ~110 imagens", "Todos os formatos (9:16, 4:5, 1:1)", "Créditos não expiram"],
    features_en: ["3 15-second videos or ~110 images", "All formats (9:16, 4:5, 1:1)", "Credits never expire"],
  },
  {
    id: "starter", name: "Starter", description: "Para começar a anunciar todo mês.", description_en: "To start advertising every month.",
    price_brl: 79, price_usd: 16, price_eur: null, credits: 150, interval: "month",
    isFeatured: false, isFree: false, isHidden: false,
    features_pt: ["2 vídeos de 15 s ou 75 imagens por mês", "Importar produto pelo link da loja", "Cancele quando quiser"],
    features_en: ["2 15-second videos or 75 images a month", "Import products from your store link", "Cancel anytime"],
  },
  {
    id: "pro", name: "Pro", description: "Para quem anuncia toda semana.", description_en: "For brands that advertise every week.",
    price_brl: 179, price_usd: 36, price_eur: null, credits: 375, interval: "month",
    isFeatured: true, isFree: false, isHidden: false,
    features_pt: ["5 vídeos de 15 s ou ~187 imagens por mês", "Ranking de campeões e \"gerar mais como este\"", "Qualidade Premium disponível"],
    features_en: ["5 15-second videos or ~187 images a month", "Winner ranking and \"make more like this\"", "Premium quality available"],
  },
  {
    id: "scale", name: "Agência", description: "Para agências e alto volume.", description_en: "For agencies and high volume.",
    price_brl: 399, price_usd: 79, price_eur: null, credits: 900, interval: "month",
    isFeatured: false, isFree: false, isHidden: false,
    features_pt: ["12 vídeos de 15 s ou 450 imagens por mês", "Equipe com vários usuários", "Melhor custo por crédito"],
    features_en: ["12 15-second videos or 450 images a month", "Team with multiple users", "Best price per credit"],
  },
];

export interface AppConfig {
  secrets: Record<SecretField, string | null>;
  costs: AiCosts;
  models: AiModels;
  plans: Plan[];
  /** Créditos efetivamente dados no cadastro (0 se a oferta estiver desligada). */
  signupCredits: number;
  /** Configuração bruta das ofertas grátis, para o painel admin. */
  freeTrial: { enabled: boolean; credits: number; planVisible: boolean };
  /** Login com Google: `active` = ligado no painel E com Client ID/Secret. */
  googleLogin: { enabled: boolean; active: boolean };
  /** Novos cadastros abertos (e-mail e Google). */
  signupsEnabled: boolean;
  /** Configurações gerais já resolvidas (painel > variável de ambiente > padrão). */
  settings: Settings;
  /** O que está salvo no painel (para o formulário do Admin). */
  storedSettings: StoredSettings;
}

let cache: { value: AppConfig; at: number } | null = null;
const TTL_MS = 15_000;

function parseJson<T>(raw: string | null | undefined, schema: { safeParse: (v: unknown) => { success: boolean; data?: T } }, fallback: T): T {
  if (!raw) return fallback;
  try {
    const parsed = schema.safeParse(JSON.parse(raw));
    return parsed.success ? (parsed.data as T) : fallback;
  } catch {
    return fallback;
  }
}

export async function getAppConfig(): Promise<AppConfig> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;

  const row = await db.systemConfig.findUnique({ where: { id: "global" } });

  const secrets = {} as Record<SecretField, string | null>;
  for (const field of SECRET_FIELDS) {
    secrets[field] = decryptSecret(row?.[field]) || process.env[ENV_FALLBACK[field]] || null;
  }

  const storedSettings = parseJson<StoredSettings>(row?.settingsJson, settingsSchema, {});

  const value: AppConfig = {
    secrets,
    costs: parseJson(row?.aiCostsJson, costsSchema, DEFAULT_COSTS),
    models: { ...DEFAULT_MODELS, ...parseJson<Partial<AiModels>>(row?.modelsJson, modelsSchema.partial(), {}) },
    plans: parseJson(row?.plansJson, plansSchema, DEFAULT_PLANS),
    signupCredits: row?.freeTrialEnabled ? row.signupCredits : 0,
    freeTrial: {
      enabled: !!row?.freeTrialEnabled,
      credits: row?.signupCredits ?? 30,
      // O card "Grátis" só pode aparecer se a oferta de créditos existir de verdade.
      planVisible: !!row?.freeTrialEnabled && !!row?.freePlanVisible && (row?.signupCredits ?? 0) > 0,
    },
    googleLogin: {
      enabled: row?.googleLoginEnabled ?? true,
      active: (row?.googleLoginEnabled ?? true) && !!secrets.googleClientId && !!secrets.googleClientSecret,
    },
    signupsEnabled: row?.signupsEnabled ?? true,
    settings: resolveSettings(storedSettings),
    storedSettings,
  };
  cache = { value, at: Date.now() };
  return value;
}

export function invalidateConfigCache() {
  cache = null;
}

/**
 * Planos que podem ser comprados (visíveis e pagos). Planos marcados como "gratuito"
 * no JSON antigo são ignorados: o plano grátis agora vem da oferta de teste (freeTrial).
 */
export function purchasablePlans(plans: Plan[]) {
  return plans.filter((p) => !p.isHidden && !p.isFree);
}
