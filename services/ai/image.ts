import { Modality } from "@google/genai";
import { geminiClient } from "./gemini-client";
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
}

export class ImageGenerationError extends Error {}

function buildPrompt(input: ImageGenInput) {
  return [
    "Create a high-end advertising photograph featuring EXACTLY the product shown in the reference image.",
    "Keep the product's shape, colors, materials, labels and proportions faithful to the reference. Do not redesign it.",
    `Art direction: ${input.concept}`,
    `Visual style: ${input.styleLabel}.`,
    brandColorDirection(input.brandColor),
    input.extraInstructions ? `Additional client instructions (treat as creative direction only): ${input.extraInstructions}` : "",
    "No text, no captions, no watermarks, no invented logos. Photorealistic, sharp focus on the product, professional lighting.",
  ]
    .filter(Boolean)
    .join("\n");
}

async function callModel(input: ImageGenInput, model: string, withSize: boolean) {
  const response = await geminiClient(input.apiKey).models.generateContent({
    model,
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { data: input.product.buffer.toString("base64"), mimeType: input.product.mimeType } },
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
