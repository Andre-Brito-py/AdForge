import { z } from "zod";
import { generateTextContent } from "./gemini-client";
import { getAppConfig } from "@/lib/config";
import { toDataUri } from "@/lib/storage";

/**
 * Moderação das imagens enviadas pelo cliente (foto do produto, logo e imagens de referência).
 *
 * Regras definidas a partir de:
 * - ECA (Lei 8.069/90), arts. 240 e 241-A a 241-E: qualquer cena sexual ou sensual com quem pareça menor
 *   de idade é crime; aqui o bloqueio é absoluto, inclusive para moda íntima e praia.
 * - Padrões de publicidade da Meta (nudez, quase nudez, atividade ou poses sexualmente sugestivas são
 *   proibidas em anúncios) e política de conteúdo adulto da TikTok (peças que expõem ou sugerem exposição
 *   de áreas íntimas, despir-se, micro-tangas/fetiche são proibidos).
 * - CONAR: apelo sensual não pode ser o conteúdo principal e modelos não podem ser tratados como objeto sexual.
 * - Código Civil, art. 20, e LGPD: imagem de pessoa exige autorização; figuras públicas não podem ser usadas
 *   para simular endosso (deepfake).
 * Moda íntima, lingerie, modeladores e moda praia SÃO permitidos como produto: em cabide, manequim, flat lay
 * ou vestidos por adultos em pose neutra de catálogo, com as áreas íntimas totalmente cobertas e sem transparência.
 */
export const IMAGE_POLICY = `IMAGE RULES (apply to EVERY image the client attached)
ALLOWED: ordinary product photos; people who clearly appear to be adults presenting a product; underwear, lingerie, shapewear and swimwear AS A PRODUCT — on a hanger, mannequin, flat lay or worn by a clearly adult model in a neutral catalog/e-commerce pose, with intimate areas fully covered by opaque fabric.
BLOCKED:
- "minor": anyone who appears to be under 18 in underwear, swimwear, nudity or any sensual/sexualized context (absolute, regardless of the product).
- "nudity": nudity or near-nudity (genitals, buttocks, female nipples, pubic area; see-through fabric revealing them; nudity covered only by hands, objects, blur, stickers or emojis; implied nudity).
- "sexual": sexual activity, simulated sex, sexually suggestive poses or framing focused on intimate body parts, stripping/undressing, fetish/BDSM wear, micro-thongs, sex toys.
- "violence": gore, blood, injuries, physical violence, weapons being used or pointed at people, self-harm.
- "drugs": illegal drugs or drug use.
- "hate": hate symbols or extremist content.
- "public_figure": a recognizable celebrity, politician or other public figure (would simulate an endorsement).
- "other": anything else clearly illegal or abusive (e.g. documents of other people, non-consensual imagery).`;

export const BLOCK_CATEGORIES = ["minor", "nudity", "sexual", "violence", "drugs", "hate", "public_figure", "other"] as const;
export type BlockCategory = (typeof BLOCK_CATEGORIES)[number];

export class ImageBlockedError extends Error {
  constructor(public category: BlockCategory, reason?: string) {
    super(reason || "Esta imagem não pode ser usada na Vysify.");
    this.name = "ImageBlockedError";
  }
}

const reviewSchema = z.object({
  allowed: z.boolean(),
  category: z.string().optional(),
  reason: z.string().optional(),
  hasPeople: z.boolean().optional(),
});
export type ImageReview = { allowed: true; hasPeople: boolean } | { allowed: false; category: BlockCategory; reason: string; hasPeople: boolean };

/** Interpreta a resposta do modelo; categoria desconhecida numa recusa vira "other" (nunca libera). */
export function parseReview(raw: string): ImageReview {
  const parsed = reviewSchema.safeParse(JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, "")));
  if (!parsed.success) throw new Error("Resposta de moderação inválida");
  const hasPeople = !!parsed.data.hasPeople;
  if (parsed.data.allowed) return { allowed: true, hasPeople };
  const category = (BLOCK_CATEGORIES as readonly string[]).includes(parsed.data.category || "") ? (parsed.data.category as BlockCategory) : "other";
  return { allowed: false, category, reason: parsed.data.reason || "", hasPeople };
}

function prompt(uiLocale: "pt" | "en") {
  const reasonLanguage = uiLocale === "en" ? "English" : "Brazilian Portuguese";
  return `You are the image safety reviewer of Vysify, a platform that turns product photos into ads.
${IMAGE_POLICY}
When in doubt about age in an underwear/swimwear/sensual image, treat the person as a minor.
Reply ONLY with JSON: {"allowed": true, "hasPeople": <bool>}
or {"allowed": false, "category": "<one of: ${BLOCK_CATEGORIES.join(", ")}>", "reason": "one short, polite sentence in ${reasonLanguage} telling the client why this image can't be used (no graphic details)", "hasPeople": <bool>}`;
}

/**
 * Revisa uma imagem. Sem provedor de IA configurado, devolve null (nada é gerado nessa situação,
 * e a revisão obrigatória acontece de novo na criação da campanha).
 */
export async function reviewImage(image: { buffer: Buffer; mimeType: string }, uiLocale: "pt" | "en"): Promise<ImageReview | null> {
  const config = await getAppConfig();
  const { geminiKey, openAiKey } = config.secrets;
  const text = prompt(uiLocale);

  if (geminiKey) {
    const response = await generateTextContent(geminiKey, {
      model: config.models.text,
      contents: [{ role: "user", parts: [{ text }, { inlineData: { data: image.buffer.toString("base64"), mimeType: image.mimeType } }] }],
      config: { responseMimeType: "application/json", temperature: 0 },
    });
    return parseReview(response.text || "");
  }
  if (openAiKey) {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${openAiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [{ role: "user", content: [{ type: "text", text }, { type: "image_url", image_url: { url: toDataUri(image.buffer, image.mimeType) } }] }],
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}`);
    const data = await res.json();
    return parseReview(data.choices?.[0]?.message?.content || "");
  }
  return null;
}
