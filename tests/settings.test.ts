import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveSettings, settingsSchema } from "@/lib/settings";

describe("configurações gerais (painel > variável de ambiente > padrão)", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("o valor do painel vence a variável de ambiente", () => {
    vi.stubEnv("NEXT_PUBLIC_COMPANY_NAME", "Empresa Env");
    expect(resolveSettings({ companyName: "Empresa Painel" }).company.name).toBe("Empresa Painel");
    expect(resolveSettings({}).company.name).toBe("Empresa Env");
  });

  it("sem painel nem variável, usa o padrão (e o e-mail de privacidade cai no de suporte)", () => {
    vi.stubEnv("NEXT_PUBLIC_COMPANY_CNPJ", "");
    vi.stubEnv("NEXT_PUBLIC_PRIVACY_EMAIL", "");
    const s = resolveSettings({ supportEmail: "ajuda@exemplo.com" });
    expect(s.company.cnpj).toBe("[CNPJ]");
    expect(s.company.privacyEmail).toBe("ajuda@exemplo.com");
    expect(s.meta.graphVersion).toBe("v23.0");
  });

  it("o switch de impostos do painel vence o STRIPE_AUTOMATIC_TAX", () => {
    vi.stubEnv("STRIPE_AUTOMATIC_TAX", "true");
    expect(resolveSettings({}).stripeAutomaticTax).toBe(true);
    expect(resolveSettings({ stripeAutomaticTax: false }).stripeAutomaticTax).toBe(false);
  });

  it("rejeita IDs de rastreador fora do formato (vão parar dentro de um <script>)", () => {
    expect(settingsSchema.safeParse({ gaId: "G-ABC1234" }).success).toBe(true);
    expect(settingsSchema.safeParse({ gaId: "G-1');alert(1)//" }).success).toBe(false);
    expect(settingsSchema.safeParse({ metaPixelId: "123abc" }).success).toBe(false);
    expect(settingsSchema.safeParse({ gaId: "" }).success).toBe(true);
  });
});
