import { describe, expect, it } from "vitest";
import { isModelUnavailable, isTransient } from "@/services/ai/gemini-client";

describe("tolerância a falhas do Gemini", () => {
  it("reconhece modelo aposentado (troca para o alias do Flash mais recente)", () => {
    expect(isModelUnavailable({ status: 404, message: "This model models/gemini-2.5-flash is no longer available to new users." })).toBe(true);
    expect(isModelUnavailable({ status: 400, message: "invalid argument" })).toBe(false);
  });

  it("reconhece sobrecarga momentânea (tenta de novo)", () => {
    expect(isTransient({ status: 503, message: "This model is currently experiencing high demand." })).toBe(true);
    expect(isTransient({ status: 429, message: "RESOURCE_EXHAUSTED" })).toBe(true);
    expect(isTransient({ status: 400, message: "API key not valid" })).toBe(false);
    // Plano grátis sem cota para o modelo: esperar não resolve.
    expect(isTransient({ status: 429, message: "You exceeded your current quota ... free_tier_requests, limit: 0, model: gemini-3.1-flash-image" })).toBe(false);
  });
});
