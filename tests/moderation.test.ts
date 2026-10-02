import { describe, expect, it } from "vitest";
import { IMAGE_POLICY, parseReview } from "@/services/ai/moderation";
import { campaignSchema } from "@/lib/validation";
import { parseReferences, parseVideoSpec, serializeVideoSpec } from "@/lib/video-plan";

describe("moderação de imagens", () => {
  it("imagem liberada informa se há pessoas", () => {
    expect(parseReview('{"allowed": true, "hasPeople": true}')).toEqual({ allowed: true, hasPeople: true });
  });

  it("recusa com categoria conhecida mantém categoria e motivo", () => {
    const r = parseReview('{"allowed": false, "category": "minor", "reason": "Parece haver um menor de idade em roupa íntima."}');
    expect(r).toMatchObject({ allowed: false, category: "minor" });
  });

  it("categoria desconhecida numa recusa vira 'other' (nunca libera)", () => {
    expect(parseReview('{"allowed": false, "category": "algo-novo"}')).toMatchObject({ allowed: false, category: "other" });
  });

  it("resposta inválida não é tratada como liberação", () => {
    expect(() => parseReview('{"ok": 1}')).toThrow();
  });

  it("a política cobre os pontos legais combinados", () => {
    expect(IMAGE_POLICY).toMatch(/under 18/);
    expect(IMAGE_POLICY).toMatch(/underwear, lingerie, shapewear and swimwear AS A PRODUCT/);
    expect(IMAGE_POLICY).toMatch(/see-through/);
    expect(IMAGE_POLICY).toMatch(/public figure/);
  });
});

describe("imagens de referência na campanha", () => {
  const base = { productId: "6f1c2a52-6b1e-4c43-9b8e-4b2f4f1a7c11", objective: "SALES", platform: "REELS_TIKTOK", style: "CINEMATIC", variations: 1 };

  it("com referências, exige a declaração de autorização de imagem", () => {
    const r = campaignSchema.safeParse({ ...base, references: ["/uploads/a.png"] });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].message).toBe("validation.imageRights");
    expect(campaignSchema.safeParse({ ...base, references: ["/uploads/a.png"], imageRights: true }).success).toBe(true);
  });

  it("no máximo 3 referências; sem referências não pede autorização", () => {
    expect(campaignSchema.safeParse({ ...base, references: ["a", "b", "c", "d"], imageRights: true }).success).toBe(false);
    expect(campaignSchema.parse(base).references).toEqual([]);
  });

  it("lista de referências guardada e quadro de abertura do vídeo", () => {
    expect(parseReferences('["/uploads/a.png", 3, "/uploads/b.png"]')).toEqual(["/uploads/a.png", "/uploads/b.png"]);
    expect(parseReferences("lixo")).toEqual([]);
    const spec = parseVideoSpec(serializeVideoSpec({ scenes: ["s1"], voiceover: "v", keyframe: "the woman from image 2 holding the bottle from image 1" }), "");
    expect(spec.keyframe).toContain("image 2");
  });
});
