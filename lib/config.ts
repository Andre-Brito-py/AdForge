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
  googleClientId: "GOOGLE_CLIENT_ID",
  googleClientSecret: "GOOGLE_CLIENT_SECRET",
  resendKey: "RESEND_API_KEY",
};

// gemini-2.5-* não é mais liberado para contas novas do Google (out/2026). Trocáveis em Admin › IA e custos.
export const DEFAULT_MODELS: AiModels = {
  text: "gemini-3.8-flash",
  image: "gemini-3.1-flash-image",
  imagePremium: "gemini-3-pro-image",
  // Wan 2.2 (mesmos parâmetros do 2.1, bem mais rápido); o antigo fal-ai/wan-i2v levava 10+ min por trecho.
  video: "fal-ai/wan/v2.2-a14b/image-to-video",
  videoPremium: "fal-ai/wan/v2.2-a14b/image-to-video",
};

export const DEFAULT_PLANS: Plan[] = [
  {
    id: "starter", name: "Starter", description: "Para começar a testar anúncios com IA.", description_en: "To start testing AI ads.",
    price_brl: 49, price_usd: 10, price_eur: null, credits: 200,
    isFeatured: false, isFree: false, isHidden: false,
    features_pt: ["~65 imagens ou ~20 vídeos", "Copy e estratégia inclusas", "Download em alta resolução"],
    features_en: ["~65 images or ~20 videos", "Copy and strategy included", "High-resolution downloads"],
  },
  {
    id: "pro", name: "Pro", description: "Para quem anuncia toda semana.", description_en: "For brands that advertise every week.",
    price_brl: 99, price_usd: 20, price_eur: null, credits: 500,
    isFeatured: true, isFree: false, isHidden: false,
    features_pt: ["~165 imagens ou ~50 vídeos", "Qualidade Premium disponível", "Brand Kit aplicado nas gerações"],
    features_en: ["~165 images or ~50 videos", "Premium quality available", "Brand Kit applied to generations"],
  },
  {
    id: "scale", name: "Scale", description: "Para agências e alto volume.", description_en: "For agencies and high volume.",
    price_brl: 249, price_usd: 50, price_eur: null, credits: 1500,
    isFeatured: false, isFree: false, isHidden: false,
    features_pt: ["~500 imagens ou ~150 vídeos", "Melhor custo por crédito", "Suporte prioritário por e-mail"],
    features_en: ["~500 images or ~150 videos", "Best price per credit", "Priority email support"],
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
