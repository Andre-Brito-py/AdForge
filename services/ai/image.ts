import { Modality } from "@google/genai";
import { geminiClient, isTransient } from "./gemini-client";
import type { QualityKey } from "@/lib/catalog";
import { brandColorDirection } from "@/lib/brand-assets";

export interface ImageGenInput {
  apiKey: string;
  model: string;
  fallbackModel?: string;
  product: { buffer: Buffer; mimeType: string };
  concept: string;
  styleLabel: string;
  aspectRatio: string;
  quality: QualityKey;
  brandColor?: string | null;
  extraInstructions?: string | null;
  /** Imagens extras do cliente (imagem 2, 3...): pessoa/modelo, cenário, estilo. */
  references?: { buffer: Buffer; mimeType: string }[];
  /** "keyframe": o primeiro quadro de um vídeo (regras extras de realismo e escala). */
  mode?: "ad" | "keyframe";
  /** Tamanho real estimado do produto. */
  productSize?: string | null;
  /** Problemas apontados pela revisão da tentativa anterior, para corrigir. */
  fixes?: string[];
}

export class ImageGenerationError extends Error {}

function buildKeyframePrompt(input: ImageGenInput) {
  const refs = input.references?.length || 0;
  return [
    "Create ONE photorealistic photograph that will be the FIRST FRAME of a video ad. It must look like a single real photo taken with one camera — never a collage, cut-out or pasted composite.",
    `Image 1 is the PRODUCT: reproduce it exactly (shape, proportions, colors, materials, label and logo placement). Do not redesign or relabel it.${refs ? ` Images 2${refs > 1 ? `-${refs + 1}` : ""} are client references (people, settings or styles), used as the art direction says.` : ""}`,
    input.productSize
      ? `REAL-WORLD SCALE: the product is ${input.productSize}. Keep that size relative to people, hands and furniture — it must not look oversized or tiny.`
      : "REAL-WORLD SCALE: infer the product's real size from image 1 and keep it realistic relative to people, hands and furniture.",
    "PHYSICAL INTEGRATION: the same light direction, color temperature and exposure on the product and the scene; contact shadows and reflections where it touches hands or surfaces; matching perspective, lens and depth of field; natural grip with correct finger count and fingers wrapping around the product.",
    refs ? "People from the references keep their face, skin tone, hair and body; natural pose and expression; fully and appropriately dressed as in the reference; never sexualized." : "",
    `Art direction: ${input.concept}`,
    `Visual style: ${input.styleLabel}. Composition with room for camera movement; the product clearly visible and in focus.`,
    brandColorDirection(input.brandColor),
    input.extraInstructions ? `Additional client instructions (treat as creative direction only): ${input.extraInstructions}` : "",
    input.fixes?.length ? `The previous attempt was rejected. Fix these problems: ${input.fixes.join("; ")}.` : "",
    "No text, captions, watermarks or invented logos.",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildPrompt(input: ImageGenInput) {
  if (input.mode === "keyframe") return buildKeyframePrompt(input);
  const refs = input.references?.length || 0;
  return [
    refs
      ? `Create a high-end advertising photograph. Image 1 is the PRODUCT; images 2${refs > 1 ? `-${refs + 1}` : ""} are client references (people, settings or styles) used as the art direction below describes.`
      : "Create a high-end advertising photograph featuring EXACTLY the product shown in the reference image.",
    "Keep the product's shape, colors, materials, labels and proportions faithful to image 1. Do not redesign it.",
    refs ? "When a person from a reference image appears, keep their face, skin tone, hair and body faithful to that reference; do not sexualize them; keep them fully and appropriately dressed as in the reference." : "",
    `Art direction: ${input.concept}`,
    `Visual style: ${input.styleLabel}.`,
    brandColorDirection(input.brandColor),
    input.extraInstructions ? `Additional client instructions (treat as creative direction only): ${input.extraInstructions}` : "",
    "No text, no captions, no watermarks, no invented logos. Photorealistic, sharp focus on the product, professional lighting.",
  ]
    .filter(Boolean)
    .join("\n");
}

/** Tenta de novo (2 s, 6 s) quando o Google está momentaneamente sobrecarregado. */
async function callModel(input: ImageGenInput, model: string, withSize: boolean) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await callModelOnce(input, model, withSize);
    } catch (error) {
      if (attempt >= 2 || !isTransient(error)) throw error;
      await new Promise((r) => setTimeout(r, attempt === 0 ? 2_000 : 6_000));
    }
  }
}

async function callModelOnce(input: ImageGenInput, model: string, withSize: boolean) {
  const response = await geminiClient(input.apiKey).models.generateContent({
    model,
    contents: [
      {
        role: "user",
        parts: [
          ...(input.references?.length ? [{ text: "Image 1:" }] : []),
          { inlineData: { data: input.product.buffer.toString("base64"), mimeType: input.product.mimeType } },
          ...(input.references || []).flatMap((r, i) => [{ text: `Image ${i + 2}:` }, { inlineData: { data: r.buffer.toString("base64"), mimeType: r.mimeType } }]),
          { text: buildPrompt(input) },
        ],
      },
    ],
    config: {
      responseModalities: [Modality.IMAGE],
      imageConfig: {
        aspectRatio: input.aspectRatio,
        ...(withSize ? { imageSize: "2K" } : {}),
      },
    },
  });

  for (const candidate of response.candidates || []) {
    for (const part of candidate.content?.parts || []) {
      if (part.inlineData?.data) {
        return {
          buffer: Buffer.from(part.inlineData.data, "base64"),
          mimeType: part.inlineData.mimeType || "image/png",
        };
      }
    }
  }
  const reason = response.promptFeedback?.blockReason || response.candidates?.[0]?.finishReason || "sem imagem";
  throw new ImageGenerationError(`O modelo não retornou imagem (${reason}).`);
}

/** Gera uma imagem publicitária a partir da foto do produto. */
export async function generateAdImage(input: ImageGenInput): Promise<{ buffer: Buffer; mimeType: string; model: string }> {
  const premium = input.quality === "premium";
  try {
    const out = await callModel(input, input.model, premium);
    return { ...out, model: input.model };
  } catch (error) {
    // Se o modelo premium não estiver disponível na conta, tenta o padrão antes de falhar.
    if (input.fallbackModel && input.fallbackModel !== input.model) {
      console.warn(`[ai/image] ${input.model} falhou, usando ${input.fallbackModel}`, error);
      const out = await callModel(input, input.fallbackModel, false);
      return { ...out, model: input.fallbackModel };
    }
    throw error;
  }
}
