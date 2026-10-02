import { describe, expect, it } from "vitest";
import { parse, TYPE, type MessageFormatElement } from "@formatjs/icu-messageformat-parser";
import pt from "../messages/pt.json";
import en from "../messages/en.json";
import { AD_LANGUAGES, currencyForCountry, defaultAdLanguage, pickLocale, refundWindowDays } from "@/lib/locale";
import { parseConsent } from "@/components/consent/consent";
import { txDescription } from "@/lib/generation-text";

type Tree = { [k: string]: unknown };
function keys(obj: Tree, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === "object" && !Array.isArray(v) ? keys(v as Tree, `${prefix}${k}.`) : [`${prefix}${k}`]
  );
}
/** Variáveis e tags reais da mensagem ICU (o parser ignora o texto dos ramos de plural). */
function placeholders(s: string) {
  const found = new Set<string>();
  const walk = (nodes: MessageFormatElement[]) => {
    for (const n of nodes) {
      if ("value" in n && typeof n.value === "string" && n.type !== TYPE.literal) found.add(n.value);
      if (n.type === TYPE.tag) { found.add(`<${n.value}>`); walk(n.children); }
      if (n.type === TYPE.plural || n.type === TYPE.select) for (const opt of Object.values(n.options)) walk(opt.value);
    }
  };
  walk(parse(s, { ignoreTag: false }));
  return [...found].sort().join(",");
}
function get(obj: Tree, path: string): unknown {
  return path.split(".").reduce<unknown>((o, k) => (o as Tree)?.[k], obj);
}

describe("traduções", () => {
  it("pt e en têm exatamente as mesmas chaves", () => {
    const a = keys(pt as Tree), b = keys(en as Tree);
    expect(a.filter((k) => !b.includes(k))).toEqual([]);
    expect(b.filter((k) => !a.includes(k))).toEqual([]);
  });

  it("as variáveis e tags de cada mensagem batem entre os idiomas", () => {
    const mismatches = keys(pt as Tree).filter((k) => {
      const p = get(pt as Tree, k), e = get(en as Tree, k);
      if (typeof p !== "string" || typeof e !== "string") return false;
      return placeholders(p) !== placeholders(e);
    });
    expect(mismatches).toEqual([]);
  });

  it("listas (dicas, etapas) têm o mesmo tamanho", () => {
    expect((en as Tree & { mascot: { tips: string[] } }).mascot.tips.length).toBe((pt as Tree & { mascot: { tips: string[] } }).mascot.tips.length);
  });
});

describe("idioma, moeda e país", () => {
  it("visitante dos EUA com navegador em espanhol vê inglês (não há tradução em espanhol)", () => {
    expect(pickLocale("es-MX,es;q=0.9", "MX")).toBe("en");
    expect(pickLocale("es-ES,es;q=0.9", "BR")).toBe("pt");
    expect(pickLocale(null, "US")).toBe("en");
    expect(pickLocale(null, "BR")).toBe("pt");
  });
  it("moeda padrão pelo país", () => {
    expect(currencyForCountry("BR", "pt")).toBe("BRL");
    expect(currencyForCountry("DE", "en")).toBe("EUR");
    expect(currencyForCountry("US", "en")).toBe("USD");
    expect(currencyForCountry("JP", "en")).toBe("USD");
    expect(currencyForCountry(null, "pt")).toBe("BRL");
  });
  it("reembolso: 7 dias no Brasil, 14 nas compras internacionais", () => {
    expect(refundWindowDays("BRL")).toBe(7);
    expect(refundWindowDays("USD")).toBe(14);
    expect(refundWindowDays("EUR")).toBe(14);
  });
  it("idioma do anúncio sugerido pelo país", () => {
    expect(defaultAdLanguage("en", "GB")).toBe("en-GB");
    expect(defaultAdLanguage("en", "MX")).toBe("es-419");
    expect(defaultAdLanguage("pt", "BR")).toBe("pt-BR");
    expect(defaultAdLanguage("en", null)).toBe("en-US");
    expect(Object.keys(AD_LANGUAGES)).toHaveLength(9);
  });
});

describe("consentimento de cookies", () => {
  it("lê apenas o formato esperado", () => {
    expect(parseConsent("v1.a1.m0")).toEqual({ analytics: true, marketing: false });
    expect(parseConsent("v1.a0.m1")).toEqual({ analytics: false, marketing: true });
    expect(parseConsent("qualquer-coisa")).toBeNull();
    expect(parseConsent(null)).toBeNull();
  });
});

describe("extrato no idioma do cliente", () => {
  it("descrições de transação", () => {
    expect(txDescription("en", "campaign", { n: 3, media: "IMAGE", quality: "standard" })).toBe("Campaign: 3x image (standard)");
    expect(txDescription("pt", "refund")).toBe("Estorno automático: falha na geração");
  });
});
