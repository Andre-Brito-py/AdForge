import { describe, expect, it } from "vitest";
import { imageEngine, hasImageProvider } from "@/lib/ai-engine";
import { openAiSize } from "@/services/ai/image";
import { directorPrompt } from "@/services/ai/motion";
import { DEFAULT_MODELS } from "@/lib/config";
import { modelsSchema } from "@/lib/validation";

const secrets = (g: string | null, o: string | null) => ({ geminiKey: g, openAiKey: o }) as never;

describe("escolha do provedor de imagem (Admin)", () => {
  it("OpenAI escolhida e com chave: usa OpenAI (Gemini fica de reserva)", () => {
    const e = imageEngine({ secrets: secrets("g", "o"), models: { ...DEFAULT_MODELS, imageProvider: "openai" } }, true);
    expect(e.provider).toBe("openai");
    expect(e.openai).toEqual({ apiKey: "o", model: "gpt-image-2.5-sunburst" });
    expect(e.apiKey).toBe("g");
  });

  it("Gemini escolhido: não usa OpenAI", () => {
    const e = imageEngine({ secrets: secrets("g", "o"), models: DEFAULT_MODELS }, false);
    expect(e.provider).toBe("gemini");
    expect(e.openai).toBeNull();
    expect(e.label).toBe(DEFAULT_MODELS.image);
  });

  it("escolhido sem chave: cai no outro", () => {
    expect(imageEngine({ secrets: secrets(null, "o"), models: DEFAULT_MODELS }, false).provider).toBe("openai");
    expect(imageEngine({ secrets: secrets("g", null), models: { ...DEFAULT_MODELS, imageProvider: "openai" } }, false).provider).toBe("gemini");
    expect(hasImageProvider({ secrets: secrets(null, null) })).toBe(false);
  });

  it("modelos padrão válidos e provedor desconhecido recusado", () => {
    expect(modelsSchema.safeParse(DEFAULT_MODELS).success).toBe(true);
    expect(modelsSchema.safeParse({ ...DEFAULT_MODELS, imageProvider: "outra" }).success).toBe(false);
  });

  it("tamanhos da OpenAI: múltiplos de 16, no formato do anúncio", () => {
    for (const r of ["1:1", "4:5", "9:16", "16:9"]) {
      const [w, h] = openAiSize(r).split("x").map(Number);
      expect(w % 16).toBe(0);
      expect(h % 16).toBe(0);
    }
    expect(openAiSize("9:16")).toBe("1008x1792");
  });
});

describe("diretor de movimento", () => {
  it("pede reflexos e sombras que acompanham o movimento (contra o aspecto de PNG colado)", () => {
    const p = directorPrompt({ direction: "woman lifts the bottle", seconds: 15, speaking: true, productSize: "~28 cm" });
    expect(p).toMatch(/specular highlights and reflections of THIS environment slide across its surface/);
    expect(p).toMatch(/never look like a flat sticker with frozen lighting/);
    expect(p).toMatch(/natural lip movement/);
    expect(p).toMatch(/~28 cm/);
    expect(directorPrompt({ direction: "x", seconds: 5, speaking: false })).toMatch(/No one speaks/);
  });
});
