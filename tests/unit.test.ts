import { createHmac } from "crypto";
import { describe, expect, it } from "vitest";
import { pickLocale, isLocale } from "@/lib/locale";
import { campaignCost, costPerVariation, DEFAULT_COSTS } from "@/lib/catalog";
import { campaignSchema, passwordSchema, plansSchema, registerSchema } from "@/lib/validation";
import { decryptSecret, encryptSecret, generateToken, hashToken, maskSecret } from "@/lib/crypto";
import { hashPassword, verifyPassword, verifyPasswordConstantTime } from "@/lib/password";
import { verifyMercadoPagoSignature } from "@/lib/mercadopago-signature";
import { safeRedirect } from "@/lib/redirect";
import { detectImageType } from "@/lib/storage";

describe("idioma", () => {
  it("brasileiro com inglês como segunda opção fica em português", () => {
    expect(pickLocale("pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7")).toBe("pt");
  });
  it("respeita o peso q", () => {
    expect(pickLocale("pt;q=0.3,en;q=0.9")).toBe("en");
  });
  it("espanhol cai para o padrão (não quebra a página)", () => {
    expect(pickLocale("es-ES,es;q=0.9")).toBe("pt");
  });
  it("cookie adulterado não é aceito como locale", () => {
    expect(isLocale("../../etc/passwd")).toBe(false);
    expect(isLocale("es")).toBe(false);
  });
});

describe("custos", () => {
  it("vídeo premium usa o multiplicador", () => {
    expect(costPerVariation(DEFAULT_COSTS, "REELS_TIKTOK", "premium")).toBe(20);
    expect(campaignCost(DEFAULT_COSTS, "INSTAGRAM_FEED", "standard", 4)).toBe(12);
  });
});

describe("validação de campanha", () => {
  const base = {
    productId: "6f1c2a7e-2b9d-4c8e-9a51-0e7b5f0d1c22",
    objective: "SALES",
    platform: "INSTAGRAM_FEED",
    style: "STUDIO",
    quality: "standard",
    variations: 3,
  };
  it("aceita um pedido válido", () => {
    expect(campaignSchema.safeParse(base).success).toBe(true);
  });
  it.each([-1000, 0, 5, 2.5])("rejeita variations=%s (antes gerava créditos infinitos)", (variations) => {
    expect(campaignSchema.safeParse({ ...base, variations }).success).toBe(false);
  });
  it("rejeita plataforma desconhecida", () => {
    expect(campaignSchema.safeParse({ ...base, platform: "Video Free" }).success).toBe(false);
  });
});

describe("senha e cadastro", () => {
  it("exige letras e números", () => {
    expect(passwordSchema.safeParse("12345678").success).toBe(false);
    expect(passwordSchema.safeParse("abcdefgh").success).toBe(false);
    expect(passwordSchema.safeParse("abc12345").success).toBe(true);
  });
  it("exige aceite dos termos e normaliza e-mail", () => {
    expect(registerSchema.safeParse({ name: "Ana", email: "a@b.com", password: "abc12345", acceptTerms: false }).success).toBe(false);
    const ok = registerSchema.safeParse({ name: "Ana", email: "  ANA@Exemplo.com ", password: "abc12345", acceptTerms: true });
    expect(ok.success && ok.data.email).toBe("ana@exemplo.com");
  });
  it("bcrypt verifica e o hash fictício é válido", async () => {
    const hash = await hashPassword("abc12345");
    expect(await verifyPassword("abc12345", hash)).toBe(true);
    expect(await verifyPassword("errada123", hash)).toBe(false);
    expect(await verifyPasswordConstantTime("qualquer1", null)).toBe(false);
  });
});

describe("pacotes", () => {
  it("rejeita créditos negativos e IDs com caracteres estranhos", () => {
    expect(plansSchema.safeParse([{ id: "p1", name: "X", price_brl: 10, price_usd: 2, credits: -5 }]).success).toBe(false);
    expect(plansSchema.safeParse([{ id: "p 1/..", name: "X", price_brl: 10, price_usd: 2, credits: 5 }]).success).toBe(false);
  });
});

describe("criptografia de segredos", () => {
  it("criptografa, descriptografa e mascara", () => {
    const enc = encryptSecret("sk_live_abcdef123456");
    expect(enc.startsWith("enc:v1:")).toBe(true);
    expect(enc).not.toContain("abcdef");
    expect(decryptSecret(enc)).toBe("sk_live_abcdef123456");
    expect(decryptSecret("valor-legado")).toBe("valor-legado");
    expect(maskSecret("sk_live_abcdef123456")).toEqual({ configured: true, hint: "••••3456" });
  });
  it("tokens de e-mail: guardamos só o hash", () => {
    const { token, tokenHash } = generateToken();
    expect(token.length).toBeGreaterThan(30);
    expect(hashToken(token)).toBe(tokenHash);
  });
});

describe("assinatura do Mercado Pago", () => {
  const secret = "segredo";
  const ts = String(Math.floor(Date.now() / 1000));
  const sign = (id: string, req: string) => createHmac("sha256", secret).update(`id:${id};request-id:${req};ts:${ts};`).digest("hex");

  it("aceita assinatura correta", () => {
    const v1 = sign("123", "req-1");
    expect(verifyMercadoPagoSignature({ secret, signatureHeader: `ts=${ts},v1=${v1}`, requestId: "req-1", dataId: "123", maxAgeSeconds: 3600 })).toBe(true);
  });
  it("recusa assinatura forjada ou de outro pagamento", () => {
    const v1 = sign("123", "req-1");
    expect(verifyMercadoPagoSignature({ secret, signatureHeader: `ts=${ts},v1=${v1}`, requestId: "req-1", dataId: "999" })).toBe(false);
    expect(verifyMercadoPagoSignature({ secret, signatureHeader: `ts=${ts},v1=deadbeef`, requestId: "req-1", dataId: "123" })).toBe(false);
    expect(verifyMercadoPagoSignature({ secret, signatureHeader: null, requestId: "req-1", dataId: "123" })).toBe(false);
  });
});

describe("redirecionamento seguro", () => {
  it("bloqueia redirecionamento para outro site", () => {
    expect(safeRedirect("https://malicioso.com")).toBe("/dashboard");
    expect(safeRedirect("//malicioso.com")).toBe("/dashboard");
    expect(safeRedirect("/campaigns/new?x=1")).toBe("/campaigns/new?x=1");
  });
});

describe("tipo real de imagem", () => {
  it("identifica pelos bytes, não pela extensão", () => {
    expect(detectImageType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBe("image/png");
    expect(detectImageType(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(detectImageType(Buffer.from("<html><script>alert(1)</script>"))).toBe(null);
  });
});
