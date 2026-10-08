import { z } from "zod";

/**
 * Configurações gerais editáveis no painel Admin › Configurações gerais (sem redeploy).
 * Vazio no painel = usa a variável de ambiente correspondente (ou o padrão).
 */
const text = (max: number) => z.string().trim().max(max).optional();
const email = z.union([z.literal(""), z.email()]).optional();

export const settingsSchema = z.object({
  companyName: text(200),
  companyCnpj: text(30),
  companyAddress: text(300),
  supportEmail: email,
  privacyEmail: email,
  euRepresentative: text(300),
  ukRepresentative: text(300),
  emailFrom: text(200),
  gaId: z.union([z.literal(""), z.string().trim().regex(/^G-[A-Z0-9]{4,20}$/, "Use o formato G-XXXXXXX")]).optional(),
  metaPixelId: z.union([z.literal(""), z.string().trim().regex(/^\d{5,20}$/, "O ID do Pixel tem apenas números")]).optional(),
  stripeAutomaticTax: z.boolean().optional(),
  // Quem cobra em reais: a Stripe (cartão, Pix e boleto, conforme o painel da Stripe) ou o Mercado Pago.
  brlGateway: z.enum(["stripe", "mercadopago"]).optional(),
  // Máximo de pessoas por workspace (o dono conta).
  maxMembers: z.number().int().min(1).max(200).optional(),
  metaLoginConfigId: z.union([z.literal(""), z.string().trim().regex(/^\d{5,30}$/, "O ID da configuração tem apenas números")]).optional(),
  metaGraphVersion: z.union([z.literal(""), z.string().trim().regex(/^v\d{1,3}\.\d$/, "Use o formato v23.0")]).optional(),
  elevenLabsVoiceId: text(60),
  elevenLabsVoiceIdMale: text(60),
});
export type StoredSettings = z.infer<typeof settingsSchema>;

export interface Settings {
  company: {
    name: string; cnpj: string; address: string; supportEmail: string; privacyEmail: string;
    euRepresentative: string; ukRepresentative: string;
  };
  emailFrom: string;
  trackers: { gaId: string | null; metaPixelId: string | null };
  stripeAutomaticTax: boolean;
  brlGateway: "stripe" | "mercadopago";
  maxMembers: number;
  meta: { loginConfigId: string | null; graphVersion: string };
  /** Voz padrão/feminina e voz masculina (escolhida quando quem apresenta é um homem). */
  elevenLabsVoiceId: string;
  elevenLabsVoiceIdMale: string;
}

/** Valor do painel; se vazio, a variável de ambiente; se vazia, o padrão. */
function pick(stored: string | undefined, envName: string, fallback = ""): string {
  return stored?.trim() || process.env[envName]?.trim() || fallback;
}

export function resolveSettings(s: StoredSettings): Settings {
  const supportEmail = pick(s.supportEmail, "NEXT_PUBLIC_SUPPORT_EMAIL", "suporte@vysify.com");
  return {
    company: {
      name: pick(s.companyName, "NEXT_PUBLIC_COMPANY_NAME", "[RAZÃO SOCIAL]"),
      cnpj: pick(s.companyCnpj, "NEXT_PUBLIC_COMPANY_CNPJ", "[CNPJ]"),
      address: pick(s.companyAddress, "NEXT_PUBLIC_COMPANY_ADDRESS", "[ENDEREÇO COMPLETO]"),
      supportEmail,
      privacyEmail: pick(s.privacyEmail, "NEXT_PUBLIC_PRIVACY_EMAIL", supportEmail),
      euRepresentative: pick(s.euRepresentative, "NEXT_PUBLIC_EU_REPRESENTATIVE"),
      ukRepresentative: pick(s.ukRepresentative, "NEXT_PUBLIC_UK_REPRESENTATIVE"),
    },
    emailFrom: pick(s.emailFrom, "EMAIL_FROM", "Vysify <onboarding@resend.dev>"),
    trackers: {
      gaId: pick(s.gaId, "NEXT_PUBLIC_GA_ID") || null,
      metaPixelId: pick(s.metaPixelId, "NEXT_PUBLIC_META_PIXEL_ID") || null,
    },
    stripeAutomaticTax: s.stripeAutomaticTax ?? process.env.STRIPE_AUTOMATIC_TAX === "true",
    brlGateway: s.brlGateway ?? (process.env.BRL_GATEWAY === "mercadopago" ? "mercadopago" : "stripe"),
    maxMembers: s.maxMembers ?? 5,
    meta: {
      loginConfigId: pick(s.metaLoginConfigId, "META_LOGIN_CONFIG_ID") || null,
      graphVersion: pick(s.metaGraphVersion, "META_GRAPH_VERSION", "v23.0"),
    },
    elevenLabsVoiceId: pick(s.elevenLabsVoiceId, "ELEVENLABS_VOICE_ID", "EXAVITQu4vr4xnSDxMaL"),
    // Vozes multilíngues prontas da ElevenLabs: "Sarah" (feminina) e "Adam" (masculina).
    elevenLabsVoiceIdMale: pick(s.elevenLabsVoiceIdMale, "ELEVENLABS_VOICE_ID_MALE", "pNInz6obpgDQGcFmaJgB"),
  };
}
