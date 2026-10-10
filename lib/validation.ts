import { z } from "zod";
import { MAX_REFERENCES, MAX_VARIATIONS, MEDIA_KINDS, OBJECTIVE_KEYS, PLATFORM_KEYS, QUALITY_KEYS, STYLE_KEYS, VIDEO_DURATIONS } from "./catalog";
import { AD_LANGUAGE_KEYS, CURRENCIES, LOCALES } from "./locale";

// Mensagens padrão do Zod: o idioma é escolhido por requisição em lib/api.ts (parseBody).


const trimmed = (max: number) => z.string().trim().max(max);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ message: "validation.emailInvalid" }).max(254));

export const passwordSchema = z
  .string()
  .min(8, "validation.passwordMin")
  .max(128, "validation.passwordMax")
  .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), "validation.passwordLettersNumbers");

export const registerSchema = z.object({
  name: trimmed(80).min(2, "validation.nameRequired"),
  email: emailSchema,
  password: passwordSchema,
  acceptTerms: z.literal(true, { message: "validation.acceptTerms" }),
});

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z.object({
  token: z.string().min(20).max(200),
  password: passwordSchema,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().max(128).optional(),
  newPassword: passwordSchema,
});

export const profileSchema = z.object({
  name: trimmed(80).min(2).optional(),
  locale: z.enum(LOCALES).optional(),
  notifyOnComplete: z.boolean().optional(),
  marketingOptIn: z.boolean().optional(),
});

export const onboardingSchema = z.object({
  role: z.enum(["owner", "agency", "social", "other"]),
  goal: z.enum(["images", "videos", "posts", "idk"]),
});

export const twoFactorTokenSchema = z.object({
  token: z.string().regex(/^\d{6}$/, "validation.otpFormat"),
});

export const productReviewsSchema = z.object({
  rating: z.object({ value: z.number().min(0).max(5), count: z.number().int().min(0) }).nullable(),
  items: z.array(z.object({ rating: z.number().min(0).max(5).nullable(), text: z.string().trim().min(1).max(300) })).max(12),
});
export type ProductReviews = z.infer<typeof productReviewsSchema>;

/** Avaliações guardadas no produto (null se ausentes ou inválidas). */
export function parseProductReviews(json: string | null | undefined): ProductReviews | null {
  if (!json) return null;
  try {
    const parsed = productReviewsSchema.safeParse(JSON.parse(json));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export const productSchema = z.object({
  name: trimmed(120).min(1, "validation.productNameRequired"),
  description: optionalText(2000),
  imageUrl: z.string().min(1).max(1000),
  category: optionalText(80),
  brandName: optionalText(80),
  targetAudience: optionalText(300),
  price: z.number().nonnegative().max(10_000_000).optional().nullable(),
  // Importado pelo link da loja: moeda do preço, link de origem e avaliações dos compradores.
  currency: z.enum(CURRENCIES).optional(),
  sourceUrl: z.url({ protocol: /^https?$/ }).max(2000).optional().nullable(),
  reviews: productReviewsSchema.optional().nullable(),
});

export const campaignSchema = z.object({
  productId: z.uuid(),
  name: optionalText(120),
  objective: z.enum(OBJECTIVE_KEYS),
  targetAudience: optionalText(300),
  offer: optionalText(500),
  platform: z.enum(PLATFORM_KEYS),
  style: z.enum(STYLE_KEYS),
  quality: z.enum(QUALITY_KEYS).default("standard"),
  // "auto": a IA escolhe pelo pedido (idioma pedido explicitamente > idioma em que foi escrito > idioma do cliente)
  language: z.enum(["auto", ...AD_LANGUAGE_KEYS]).default("auto"),
  briefing: optionalText(1000),
  applyLogo: z.boolean().default(false),
  // Vídeo: legendas sincronizadas e tela final com oferta, preço e chamada.
  captions: z.boolean().default(true),
  endCard: z.boolean().default(true),
  // Imagem ou vídeo (quando o formato aceita os dois); ausente = padrão do formato.
  media: z.enum(MEDIA_KINDS).optional(),
  // Imagens extras citadas no pedido como "imagem 2", "imagem 3"... (a foto do produto é a imagem 1).
  references: z.array(z.string().trim().min(1).max(1000)).max(MAX_REFERENCES, { message: "validation.tooManyReferences" }).default([]),
  imageRights: z.boolean().default(false),
  videoDuration: z
    .number()
    .int()
    .refine((d) => (VIDEO_DURATIONS as readonly number[]).includes(d), { message: "validation.videoDuration" })
    .default(5),
  variations: z.number().int().min(1).max(MAX_VARIATIONS),
}).refine((c) => c.references.length === 0 || c.imageRights, { message: "validation.imageRights", path: ["imageRights"] });

export const regenerateSchema = z.object({
  instructions: optionalText(500),
});

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "validation.colorInvalid");

export const brandKitSchema = z.object({
  brandName: optionalText(80),
  primaryColor: hexColor.optional().nullable(),
  tone: optionalText(1000),
  website: z
    .string()
    .trim()
    .max(300)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null))
    .refine((v) => !v || /^https?:\/\//i.test(v), "validation.websiteHttps"),
  logoUrl: optionalText(1000),
});

// ---------- Configurações do admin ----------

export const planSchema = z.object({
  id: z.string().trim().min(1).max(60).regex(/^[a-zA-Z0-9_-]+$/),
  name: trimmed(60).min(1),
  description: optionalText(200),
  description_en: optionalText(200),
  price_brl: z.number().nonnegative().max(1_000_000).default(0),
  price_usd: z.number().nonnegative().max(1_000_000).default(0),
  price_eur: z.number().nonnegative().max(1_000_000).optional().nullable(),
  credits: z.number().int().positive().max(1_000_000),
  /** "once" = pacote avulso; "month" = assinatura mensal (os créditos entram a cada mês pago, só pela Stripe). */
  interval: z.enum(["once", "month"]).optional().default("once"),
  isFeatured: z.boolean().optional().default(false),
  isFree: z.boolean().optional().default(false),
  isHidden: z.boolean().optional().default(false),
  features_pt: z.array(z.string().max(120)).max(12).optional().default([]),
  features_en: z.array(z.string().max(120)).max(12).optional().default([]),
  /** Espelho na Stripe (preenchido pelo servidor ao salvar; o admin não edita). */
  stripe: z
    .object({
      mode: z.enum(["test", "live"]),
      productId: z.string().max(100),
      prices: z.partialRecord(z.enum(["brl", "usd", "eur"]), z.object({ id: z.string().max(100), amount: z.number(), monthly: z.boolean().optional() })).default({}),
    })
    .optional()
    .nullable(),
});

export const plansSchema = z.array(planSchema).max(10);
export type Plan = z.infer<typeof planSchema>;

export const costsSchema = z.object({
  image: z.number().int().min(1).max(1000),
  video: z.number().int().min(1).max(1000),
  premiumMultiplier: z.number().min(1).max(10).default(2),
  /** Custo real estimado dos provedores (US$), quando o admin quer corrigir a tabela padrão. */
  usd: z
    .object({
      videoPerSecond: z.number().min(0).max(10),
      videoPremiumPerSecond: z.number().min(0).max(10),
      lipsyncPerSecond: z.number().min(0).max(10),
      image: z.number().min(0).max(10),
      imagePremium: z.number().min(0).max(10),
      keyframe: z.number().min(0).max(10),
      voicePerVideo: z.number().min(0).max(10),
      textPerVariation: z.number().min(0).max(10),
      brlPerUsd: z.number().min(0.1).max(100),
      eurPerUsd: z.number().min(0.1).max(10),
    })
    .partial()
    .optional(),
});

const modelName = z.string().trim().min(1).max(100);
export const AI_PROVIDERS = ["gemini", "openai"] as const;
export const modelsSchema = z.object({
  /** Quem faz textos, estratégia, moderação e revisões (o outro provedor, se tiver chave, vira reserva). */
  textProvider: z.enum(AI_PROVIDERS),
  /** Quem gera as imagens e o quadro de abertura dos vídeos. */
  imageProvider: z.enum(AI_PROVIDERS),
  text: modelName,
  image: modelName,
  imagePremium: modelName,
  openaiText: modelName,
  openaiImage: modelName,
  openaiImagePremium: modelName,
  video: modelName,
  videoPremium: modelName,
  /** Passe final de sincronização labial (fal.ai) quando a pessoa fala no vídeo. */
  lipsyncEnabled: z.boolean(),
  lipsync: modelName,
});
export type AiModels = z.infer<typeof modelsSchema>;

/** Converte erros do Zod em uma mensagem curta para a UI. */
export function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message || "Dados inválidos";
}
