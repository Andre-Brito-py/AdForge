import { z } from "zod";
import { generateJson, hasTextProvider, type Img } from "./llm";

/**
 * "Diretor de movimento": antes de cada pedido ao modelo de vídeo, uma IA olha o quadro REAL que será
 * animado (o de abertura ou o último quadro do trecho anterior) e escreve o prompt com física de luz e
 * movimento coerentes com aquela imagem. Sem isso, o modelo tende a manter o produto com a iluminação
 * "congelada", parecendo um PNG colado sobre o vídeo.
 */

const schema = z.object({ prompt: z.string().min(40).max(1500) });

export function directorPrompt(opts: { direction: string; seconds: number; speaking: boolean; productSize?: string | null; transcript?: string | null }) {
  return `You are a cinematographer writing the prompt for an IMAGE-TO-VIDEO model that will animate the attached frame for ${opts.seconds} seconds.
Look carefully at the frame and identify: the visible light sources (direction, hardness, color temperature), the product's material (glossy, matte, metallic, transparent), how and where it is held or placed, the setting and the camera angle.

Creative direction for this shot: ${opts.direction}
${opts.productSize ? `Real product size: ${opts.productSize} — keep this scale.` : ""}

Write ONE prompt (English, max 1200 characters) that makes the result look filmed, not composited:
- The product is a real physical object: as it moves or turns, specular highlights and reflections of THIS environment slide across its surface, its shading changes with the angle to the light sources you identified, and fingers cast contact shadows on it. It must never look like a flat sticker with frozen lighting.
- Natural, physically plausible motion: small tilt/rotation of the product revealing its side, grip adjustments, breathing, subtle hair and fabric movement, slight background parallax; one gentle camera move (slow push-in, orbit or handheld sway).
${opts.speaking
    ? `- The person speaks directly to the camera FROM THE VERY FIRST FRAME (0.0 s) until the last one — no silent intro, no pause before talking — with lips, jaw and expressions matching the attached voice line${opts.transcript ? `: "${opts.transcript.replace(/"/g, "'")}"` : ""}. Any action with the product happens WHILE she/he talks. State this explicitly at the start of your prompt.`
    : "- No one speaks; motion focuses on the product and the scene."}
- Keep the same person identity, product shape/label/colors, scale, setting, light direction and color grading as the frame. One continuous shot: no cuts, no new objects or people, no on-screen text.
Reply ONLY with JSON: {"prompt": "..."}`;
}

/** Devolve o prompt dirigido; se a IA de texto falhar, devolve `fallback` (a geração nunca para por causa disto). */
export async function directMotion(opts: {
  frame: Img;
  direction: string;
  seconds: number;
  speaking: boolean;
  productSize?: string | null;
  transcript?: string | null;
  fallback: string;
}): Promise<string> {
  // Mesmo sem o diretor, o pedido de fala desde o primeiro quadro não pode faltar.
  const fallback = opts.speaking
    ? `The person talks to the camera from the very first frame to the last, lips synced to the voice line${opts.transcript ? ` "${opts.transcript.replace(/"/g, "'")}"` : ""}. ${opts.fallback}`
    : opts.fallback;
  if (!(await hasTextProvider())) return fallback;
  try {
    const out = await generateJson({
      prompt: directorPrompt(opts),
      images: [opts.frame],
      temperature: 0.4,
      parse: (raw) => schema.parse(JSON.parse(raw)).prompt,
    });
    return out;
  } catch (error) {
    console.warn("[motion] diretor de movimento indisponível, usando o prompt base", error);
    return fallback;
  }
}
