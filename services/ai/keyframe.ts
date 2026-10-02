import { z } from "zod";
import { generateTextContent } from "./gemini-client";
import { generateAdImage, type ImageGenInput } from "./image";

/**
 * Quadro de abertura do vídeo: gerado como UMA foto realista a partir da foto do produto e das referências,
 * e revisado por uma segunda IA antes de ir para a animação. Se a revisão reprovar (escala errada, cara de
 * recorte, produto diferente, mãos estranhas...), gera de novo com as correções. Animação só amplifica defeitos
 * do primeiro quadro, então vale gastar aqui.
 */

const MAX_ATTEMPTS = 3;
const PASS_SCORE = 7;

const reviewSchema = z.object({
  score: z.number().min(0).max(10),
  pass: z.boolean(),
  issues: z.array(z.string().max(300)).max(8).default([]),
});
export type KeyframeReview = z.infer<typeof reviewSchema>;

type Img = { buffer: Buffer; mimeType: string };

export function parseKeyframeReview(raw: string): KeyframeReview {
  const parsed = reviewSchema.parse(JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, "")));
  // A nota manda: "pass" com nota baixa não passa.
  return { ...parsed, pass: parsed.pass && parsed.score >= PASS_SCORE };
}

export async function reviewKeyframe(opts: {
  apiKey: string;
  model: string;
  candidate: Img;
  product: Img;
  references: Img[];
  productSize?: string | null;
  concept: string;
}): Promise<KeyframeReview> {
  const refs = opts.references.length;
  const images = [opts.product, ...opts.references, opts.candidate];
  const last = images.length;
  const prompt = `You are a strict photo editor reviewing the opening frame of a video ad before it is animated.
Image 1 is the real PRODUCT.${refs ? ` Images 2-${refs + 1} are the client's references (people/settings).` : ""} Image ${last} is the CANDIDATE frame.
Intended frame: ${opts.concept}
${opts.productSize ? `Real product size: ${opts.productSize}.` : ""}
Check the candidate for:
1. Product fidelity: same shape, proportions, colors and label as image 1 (no redesign, no extra or missing parts).
2. Realistic SCALE of the product relative to people, hands and surroundings.
3. Real photo look: no cut-out/pasted/collage appearance; consistent lighting, shadows, reflections, perspective and focus.
4. Anatomy: natural hands (correct number of fingers, believable grip), body and face; ${refs ? "the person keeps the identity of the reference image." : "no deformed people."}
5. Matches the intended frame; no text, watermarks or invented logos.
Score 0-10 (10 = indistinguishable from a professional photo shoot). Be strict: oversized product or pasted look must fail.
Reply ONLY with JSON: {"score": <0-10>, "pass": <true if score >= ${PASS_SCORE} and no serious problem>, "issues": ["short, specific fix instructions in English"]}`;

  const response = await generateTextContent(opts.apiKey, {
    model: opts.model,
    contents: [{ role: "user", parts: [{ text: prompt }, ...images.flatMap((img, i) => [{ text: `Image ${i + 1}:` }, { inlineData: { data: img.buffer.toString("base64"), mimeType: img.mimeType } }])] }],
    config: { responseMimeType: "application/json", temperature: 0 },
  });
  return parseKeyframeReview(response.text || "");
}

/** Gera o quadro de abertura com revisão; devolve a melhor tentativa (nunca trava a geração por causa da revisão). */
export async function createKeyframe(
  input: Omit<ImageGenInput, "mode" | "fixes">,
  review: { apiKey: string; model: string }
): Promise<Img & { attempts: number; score: number | null }> {
  let best: (Img & { score: number }) | null = null;
  let fixes: string[] = [];
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const image = await generateAdImage({ ...input, mode: "keyframe", fixes });
    let verdict: KeyframeReview;
    try {
      verdict = await reviewKeyframe({
        apiKey: review.apiKey, model: review.model, candidate: image, product: input.product,
        references: input.references || [], productSize: input.productSize, concept: input.concept,
      });
    } catch (error) {
      // Revisão indisponível: segue com a imagem gerada (a revisão melhora, mas não pode derrubar o vídeo).
      console.warn("[keyframe] revisão indisponível, usando a tentativa atual", error);
      return { ...image, attempts: attempt, score: null };
    }
    console.info(`[keyframe] tentativa ${attempt}: nota ${verdict.score}${verdict.pass ? " (aprovado)" : ` — ${verdict.issues.join("; ")}`}`);
    if (!best || verdict.score > best.score) best = { ...image, score: verdict.score };
    if (verdict.pass) return { ...image, attempts: attempt, score: verdict.score };
    fixes = verdict.issues;
  }
  return { buffer: best!.buffer, mimeType: best!.mimeType, attempts: MAX_ATTEMPTS, score: best!.score };
}
