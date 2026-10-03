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
  /** Quadro de abertura de um vídeo em que a pessoa fala: já começa no meio de uma frase. */
  speaking?: boolean;
  /** Gera pela OpenAI (escolhido em Admin › IA e custos) em vez do Gemini. */
  openai?: { apiKey: string; model: string } | null;
}

const OPENAI_BASE = (process.env.OPENAI_BASE_URL || "https://api.openai.com").replace(/\/$/, "");

/** Tamanho em pixels para a OpenAI (múltiplos de 16; proporção do formato do anúncio). */
export function openAiSize(aspectRatio: string): string {
  return ({ "1:1": "1024x1024", "4:5": "1024x1280", "9:16": "1008x1792", "16:9": "1792x1008" } as Record<string, string>)[aspectRatio] || "1024x1024";
}

async function generateWithOpenAI(input: ImageGenInput, openai: { apiKey: string; model: string }) {
  const images = [input.product, ...(input.references || [])];
  const form = new FormData();
  form.append("model", openai.model);
  form.append(
    "prompt",
    `${images.length > 1 ? `The input images are numbered in order: image 1 is the product${images.length > 1 ? `, images 2-${images.length} are the client's references` : ""}.\n` : ""}${buildPrompt(input)}`
  );
  images.forEach((img, i) => {
    const ext = img.mimeType.split("/")[1] || "png";
    form.append("image[]", new Blob([new Uint8Array(img.buffer)], { type: img.mimeType }), `image-${i + 1}.${ext}`);
  });
  form.append("size", openAiSize(input.aspectRatio));
  form.append("quality", input.mode === "keyframe" || input.quality === "premium" ? "high" : "medium");
  form.append("n", "1");

  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${OPENAI_BASE}/v1/images/edits`, {
      method: "POST",
      headers: { Authorization: `Bearer ${openai.apiKey}` },
      body: form,
      signal: AbortSignal.timeout(180_000),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.data?.[0]?.b64_json) {
      return { buffer: Buffer.from(data.data[0].b64_json, "base64"), mimeType: "image/png", model: openai.model };
    }
    const error = Object.assign(new ImageGenerationError(`OpenAI imagem ${res.status}: ${data?.error?.message || "sem imagem"}`.slice(0, 400)), {
      status: res.status,
      message: `${data?.error?.message || ""}`,
    });
    if (attempt >= 2 || !isTransient(error)) throw error;
    await new Promise((r) => setTimeout(r, attempt === 0 ? 2_000 : 6_000));
  }
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
    "PHYSICAL INTEGRATION: the same light direction, color temperature and exposure on the product and the scene; the product's surface reflects THIS environment (its light sources, windows and surroundings) — never studio-lit or cut out; contact shadows and reflections where it touches hands or surfaces; matching perspective, lens, grain and depth of field; natural grip with correct finger count and fingers wrapping around the product.",
    refs ? "People from the references keep their face, skin tone, hair and body; natural pose and expression; fully and appropriately dressed as in the reference; never sexualized." : "",
    // Começar a animação com a boca fechada faz o modelo de vídeo "demorar" para falar: o quadro já nasce falando.
    input.speaking
      ? "The presenter is captured MID-SENTENCE, talking to the camera: lips naturally parted as in speech, engaged expression, eyes on the lens (not a closed-mouth smile, not a frozen pose)."
      : "",
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
  if (input.openai) {
    try {
      return await generateWithOpenAI(input, input.openai);
    } catch (error) {
      // OpenAI fora do ar: usa o Gemini como reserva, se houver chave.
      if (!input.apiKey) throw error;
      console.warn("[ai/image] OpenAI falhou, usando o Gemini como reserva", error);
    }
  }
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
