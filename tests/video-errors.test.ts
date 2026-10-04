import { describe, expect, it } from "vitest";
import { VideoGenerationError, describeVideoError, isPermanentVideoError } from "@/services/ai/video";
import { isTransient } from "@/services/ai/gemini-client";

const depleted = new Error(
  'Veo recusou o pedido (402): {"code":402,"message":"Your prepayment credits are depleted. Please go to AI Studio","status":"RESOURCE_EXHAUSTED"}'
);

describe("erros dos provedores de vídeo", () => {
  it("créditos esgotados ou pedido rejeitado não são tentados de novo", () => {
    expect(isPermanentVideoError(depleted)).toBe(true);
    expect(isPermanentVideoError(new VideoGenerationError("fal.ai recusou o pedido (401): unauthorized"))).toBe(true);
    expect(isPermanentVideoError(new VideoGenerationError("Chave do Gemini não configurada (necessária para o Veo)"))).toBe(true);
  });

  it("sobrecarga e limite momentâneo continuam sendo tentados", () => {
    expect(isPermanentVideoError(new Error("Veo recusou o pedido (429): rate limit"))).toBe(false);
    expect(isPermanentVideoError(new Error("Veo recusou o pedido (503): overloaded"))).toBe(false);
    expect(isPermanentVideoError(new VideoGenerationError("fal.ai recusou o pedido (500): internal"))).toBe(false);
    expect(isPermanentVideoError(new Error("fetch failed"))).toBe(false);
  });

  it("explica no painel que faltam créditos do Google", () => {
    expect(describeVideoError(depleted)).toMatch(/Créditos do Google/);
    expect(isTransient({ status: 429, message: depleted.message })).toBe(false);
  });
});
