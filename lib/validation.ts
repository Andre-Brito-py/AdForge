import { z } from "zod";
import { MAX_VARIATIONS, OBJECTIVE_KEYS, PLATFORM_KEYS, QUALITY_KEYS, STYLE_KEYS, VIDEO_DURATIONS } from "./catalog";
import { AD_LANGUAGE_KEYS, LOCALES } from "./locale";

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

export const productSchema = z.object({
  name: trimmed(120).min(1, "validation.productNameRequired"),
  description: optionalText(2000),
  imageUrl: z.string().min(1).max(1000),
  category: optionalText(80),
  brandName: optionalText(80),
  targetAudience: optionalText(300),
  price: z.number().nonnegative().max(10_000_000).optional().nullable(),
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
  videoDuration: z
    .number()
    .int()
    .refine((d) => (VIDEO_DURATIONS as readonly number[]).includes(d), { message: "validation.videoDuration" })
    .default(5),
  variations: z.number().int().min(1).max(MAX_VARIATIONS),
});

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
  isFeatured: z.boolean().optional().default(false),
  isFree: z.boolean().optional().default(false),
  isHidden: z.boolean().optional().default(false),
  features_pt: z.array(z.string().max(120)).max(12).optional().default([]),
  features_en: z.array(z.string().max(120)).max(12).optional().default([]),
});

export const plansSchema = z.array(planSchema).max(10);
export type Plan = z.infer<typeof planSchema>;

export const costsSchema = z.object({
  image: z.number().int().min(1).max(1000),
  video: z.number().int().min(1).max(1000),
  premiumMultiplier: z.number().min(1).max(10).default(2),
});

export const modelsSchema = z.object({
  text: z.string().trim().min(1).max(100),
  image: z.string().trim().min(1).max(100),
  imagePremium: z.string().trim().min(1).max(100),
  video: z.string().trim().min(1).max(100),
  videoPremium: z.string().trim().min(1).max(100),
});
export type AiModels = z.infer<typeof modelsSchema>;

/** Converte erros do Zod em uma mensagem curta para a UI. */
export function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message || "Dados inválidos";
}
