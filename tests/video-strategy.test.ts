import { describe, expect, it } from "vitest";
import { OutOfScopeError, PolicyViolationError, normalizeScenes, parseStrategy, voiceoverWordBudget, type StrategyInput } from "@/services/ai/text";
import { parseVideoProgress, parseVideoSpec, serializeVideoSpec, isClaimed } from "@/lib/video-plan";
import { costPerVariation, videoSegments, DEFAULT_COSTS } from "@/lib/catalog";
import { campaignSchema } from "@/lib/validation";

const input = (over: Partial<StrategyInput> = {}): StrategyInput => ({
  imageUrl: "/uploads/x.png", productName: "Garrafa", objective: "SALES", platform: "REELS_TIKTOK", media: "VIDEO", style: "CINEMATIC",
  variations: 2, language: "auto", fallbackLanguage: "pt-BR", videoDuration: 15, uiLocale: "pt", ...over,
});
const variant = { headline: "H", copy: "Copy ☕", cta: "Compre", visualConcept: "Bottle on marble", voiceover: "Seu café quente o dia todo.", scenes: ["s1", "s2", "s3"] };

describe("estratégia de vídeo", () => {
  it("modo automático usa o idioma detectado pela IA", () => {
    const s = parseStrategy(JSON.stringify({ language: "es-419", variants: [variant] }), input());
    expect(s.language).toBe("es-419");
  });

  it("idioma escolhido manualmente vence o que a IA disser", () => {
    const s = parseStrategy(JSON.stringify({ language: "es-419", variants: [variant] }), input({ language: "en-US" }));
    expect(s.language).toBe("en-US");
  });

  it("idioma inválido/ausente no automático cai no padrão do cliente", () => {
    expect(parseStrategy(JSON.stringify({ language: "klingon", variants: [variant] }), input()).language).toBe("pt-BR");
    expect(parseStrategy(JSON.stringify({ variants: [variant] }), input({ fallbackLanguage: "en-US" })).language).toBe("en-US");
  });

  it("garante uma cena por trecho de 5 s e a locução", () => {
    const s = parseStrategy(JSON.stringify({ variants: [{ ...variant, scenes: ["only one"], voiceover: undefined }] }), input({ videoDuration: 20 }));
    expect(s.variants).toHaveLength(2);
    expect(s.variants[0].scenes).toHaveLength(4);
    expect(s.variants[0].voiceover).toBe("Copy ☕"); // sem roteiro, usa o texto
    expect(normalizeScenes(["a", "b", "c"], "x", 2)).toEqual(["a", "b"]);
    expect(normalizeScenes(undefined, "concept", 1)).toEqual(["concept"]);
  });

  it("pedido fora do escopo de anúncios vira OutOfScopeError (com o motivo)", () => {
    expect(() => parseStrategy(JSON.stringify({ outOfScope: true, scopeReason: "Você pediu uma novela." }), input())).toThrow(OutOfScopeError);
    expect(() => parseStrategy(JSON.stringify({ outOfScope: true, scopeReason: "Você pediu uma novela." }), input())).toThrow("Você pediu uma novela.");
  });

  it("conteúdo proibido continua sendo PolicyViolationError", () => {
    expect(() => parseStrategy(JSON.stringify({ violation: true, violationReason: "violência" }), input())).toThrow(PolicyViolationError);
  });

  it("tamanho da locução acompanha a duração", () => {
    expect(voiceoverWordBudget(5)).toBe(11);
    expect(voiceoverWordBudget(30)).toBe(69);
  });
});

describe("plano do vídeo", () => {
  it("lê o formato novo e o antigo (texto com [INSTRUCTIONS])", () => {
    const spec = parseVideoSpec(serializeVideoSpec({ scenes: ["a", "b"], voiceover: "v", extra: "mais rápido" }), "fallback");
    expect(spec).toEqual({ v: 2, scenes: ["a", "b"], voiceover: "v", extra: "mais rápido", keyframe: null, productSize: null, presenter: null, offerLine: null });
    expect(parseVideoSpec(serializeVideoSpec({ scenes: ["a"], voiceover: "v", offerLine: "Frete grátis" }), "").offerLine).toBe("Frete grátis");
    const legacy = parseVideoSpec("Bottle shot\n[INSTRUCTIONS] mais luz", "texto da copy");
    expect(legacy.scenes).toEqual(["Bottle shot"]);
    expect(legacy.extra).toBe("mais luz");
    expect(legacy.voiceover).toBe("texto da copy");
  });

  it("estado antigo (um FalRequest) vira um vídeo de 1 trecho", () => {
    const p = parseVideoProgress(JSON.stringify({ requestId: "r", statusUrl: "s", responseUrl: "o" }), 123);
    expect(p).toMatchObject({ total: 1, done: [], segmentStartedAt: 123 });
    expect(parseVideoProgress("lixo", 0)).toBeNull();
  });

  it("trava de avanço expira (um worker que caiu não prende o vídeo para sempre)", () => {
    const now = Date.now();
    expect(isClaimed({ v: 2, total: 2, done: [], current: null, segmentStartedAt: now, claimedAt: now - 1000 }, now)).toBe(true);
    expect(isClaimed({ v: 2, total: 2, done: [], current: null, segmentStartedAt: now, claimedAt: now - 4 * 60_000 }, now)).toBe(false);
  });
});

describe("custo e validação", () => {
  it("vídeo cobra por trecho de 5 s; imagem não muda", () => {
    expect(videoSegments(5)).toBe(1);
    expect(videoSegments(30)).toBe(6);
    expect(videoSegments(7)).toBe(1); // valor fora da lista cai para 5 s
    expect(costPerVariation(DEFAULT_COSTS, "REELS_TIKTOK", "standard", 15)).toBe(DEFAULT_COSTS.video * 3);
    expect(costPerVariation(DEFAULT_COSTS, "REELS_TIKTOK", "premium", 10)).toBe(Math.ceil(DEFAULT_COSTS.video * 2 * DEFAULT_COSTS.premiumMultiplier));
    expect(costPerVariation(DEFAULT_COSTS, "INSTAGRAM_FEED", "standard", 30)).toBe(DEFAULT_COSTS.image);
  });

  it("só aceita durações da lista e idioma automático por padrão", () => {
    const base = { productId: "6f1c2a52-6b1e-4c43-9b8e-4b2f4f1a7c11", objective: "SALES", platform: "REELS_TIKTOK", style: "CINEMATIC", variations: 1 };
    expect(campaignSchema.safeParse({ ...base, videoDuration: 12 }).success).toBe(false);
    const ok = campaignSchema.parse({ ...base, videoDuration: 20 });
    expect(ok.language).toBe("auto");
    expect(ok.videoDuration).toBe(20);
  });
});
