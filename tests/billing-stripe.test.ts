import { describe, expect, it } from "vitest";
import type Stripe from "stripe";
import { stripeMode, stripePriceFor, syncPlansToStripe } from "@/lib/stripe-sync";
import { creditsToClawBack } from "@/lib/payments";
import { billingProblem, isBillingMessage, providerOfCreative } from "@/lib/admin-alerts";
import { defaultProviderPrices, estimateVariationUsd, generatedSeconds, worstRevenuePerCreditUsd } from "@/lib/provider-pricing";
import { DEFAULT_MODELS, DEFAULT_PLANS } from "@/lib/config";
import type { Plan } from "@/lib/validation";

/** Stripe falsa: guarda produtos e preços em memória e registra as chamadas. */
function fakeStripe() {
  let n = 0;
  const products = new Map<string, { active: boolean; default_price?: string; name: string }>();
  const prices = new Map<string, { product: string; currency: string; unit_amount: number; active: boolean }>();
  const calls: string[] = [];
  const stripe = {
    products: {
      create: async (p: { name: string; active?: boolean }) => {
        const id = `prod_${++n}`;
        products.set(id, { active: p.active ?? true, name: p.name });
        calls.push(`products.create ${p.name}`);
        return { id };
      },
      update: async (id: string, p: { active?: boolean; default_price?: string; name?: string }) => {
        const prod = products.get(id);
        if (!prod) throw Object.assign(new Error("No such product"), { code: "resource_missing" });
        Object.assign(prod, p);
        calls.push(`products.update ${id}`);
        return { id };
      },
    },
    prices: {
      create: async (p: { product: string; currency: string; unit_amount: number }) => {
        const id = `price_${++n}`;
        prices.set(id, { ...p, active: true });
        calls.push(`prices.create ${p.currency} ${p.unit_amount}`);
        return { id };
      },
      update: async (id: string, p: { active: boolean }) => {
        const price = prices.get(id)!;
        // Como a Stripe: o preço padrão do produto não pode ser arquivado.
        if (!p.active && products.get(price.product)?.default_price === id) throw new Error("default price");
        price.active = p.active;
        calls.push(`prices.archive ${id}`);
        return { id };
      },
    },
  };
  return { stripe: stripe as unknown as Stripe, products, prices, calls };
}

const plan = (over: Partial<Plan> = {}): Plan => ({
  id: "starter", name: "Starter", description: null, description_en: null, price_brl: 49, price_usd: 10, price_eur: null, credits: 200, interval: "once",
  isFeatured: false, isFree: false, isHidden: false, features_pt: [], features_en: [], ...over,
});

describe("pacotes na Stripe", () => {
  it("cria produto e um preço por moeda com valor", async () => {
    const f = fakeStripe();
    const { plans, errors } = await syncPlansToStripe(f.stripe, "test", [plan()], []);
    expect(errors).toEqual([]);
    expect(plans[0].stripe?.productId).toBe("prod_1");
    expect(Object.keys(plans[0].stripe!.prices)).toEqual(["brl", "usd"]);
    expect(f.calls).toContain("prices.create brl 4900");
    expect(f.calls).toContain("prices.create usd 1000");
  });

  it("mudar o preço cria um preço novo e arquiva o antigo; preço igual não mexe", async () => {
    const f = fakeStripe();
    const first = (await syncPlansToStripe(f.stripe, "test", [plan()], [])).plans[0];
    const oldBrl = first.stripe!.prices.brl!.id;
    const second = (await syncPlansToStripe(f.stripe, "test", [{ ...first, price_brl: 59 }], [first])).plans[0];
    expect(second.stripe!.prices.brl!.id).not.toBe(oldBrl);
    expect(second.stripe!.prices.brl!.amount).toBe(59);
    expect(second.stripe!.prices.usd).toEqual(first.stripe!.prices.usd);
    expect(f.prices.get(oldBrl)!.active).toBe(false);
    expect(f.products.get(second.stripe!.productId)!.default_price).toBe(second.stripe!.prices.brl!.id);
  });

  it("pacote removido ou oculto arquiva o produto", async () => {
    const f = fakeStripe();
    const [a, b] = (await syncPlansToStripe(f.stripe, "test", [plan(), plan({ id: "pro", name: "Pro" })], [])).plans;
    await syncPlansToStripe(f.stripe, "test", [{ ...a, isHidden: true }], [a, b]);
    expect(f.products.get(a.stripe!.productId)!.active).toBe(false);
    expect(f.products.get(b.stripe!.productId)!.active).toBe(false);
  });

  it("chave de produção recria tudo (os IDs de teste não existem lá)", async () => {
    const f = fakeStripe();
    const test = (await syncPlansToStripe(f.stripe, "test", [plan()], [])).plans[0];
    const live = (await syncPlansToStripe(f.stripe, "live", [test], [test])).plans[0];
    expect(live.stripe!.mode).toBe("live");
    expect(live.stripe!.productId).not.toBe(test.stripe!.productId);
  });

  it("só usa o preço da Stripe se for da mesma conta e do mesmo valor", async () => {
    const f = fakeStripe();
    const synced = (await syncPlansToStripe(f.stripe, "test", [plan()], [])).plans[0];
    expect(stripePriceFor(synced, "BRL", "test")).toBe(synced.stripe!.prices.brl!.id);
    expect(stripePriceFor(synced, "BRL", "live")).toBeNull();
    expect(stripePriceFor({ ...synced, price_brl: 59 }, "BRL", "test")).toBeNull();
    expect(stripePriceFor(synced, "EUR", "test")).toBeNull();
    expect(stripeMode("sk_live_abc")).toBe("live");
    expect(stripeMode("sk_test_abc")).toBe("test");
  });
});

describe("estornos", () => {
  it("retira créditos proporcionais ao valor devolvido", () => {
    expect(creditsToClawBack(200, 49, 49)).toBe(200);
    expect(creditsToClawBack(200, 49, 24.5)).toBe(100);
    expect(creditsToClawBack(200, 49, 0)).toBe(0);
    expect(creditsToClawBack(200, 49, 60)).toBe(200);
  });
});

describe("alertas de provedor", () => {
  it("reconhece falta de saldo e o provedor", () => {
    expect(billingProblem('Veo recusou o pedido (402): {"message":"Your prepayment credits are depleted"}')).toBe("google");
    expect(billingProblem('fal.ai recusou o upload (403): "User is locked. Reason: Exhausted balance."')).toBe("fal");
    expect(billingProblem("OpenAI imagem 429: You exceeded your current quota, please check your plan and billing details")).toBe("openai");
    // Limite por minuto do Google passa sozinho: não é falta de saldo.
    expect(isBillingMessage("429 Quota exceeded for metric generate_requests_per_minute")).toBe(false);
    expect(isBillingMessage("fetch failed")).toBe(false);
    expect(providerOfCreative("google-veo")).toBe("google");
    expect(providerOfCreative("fal.ai")).toBe("fal");
  });
});

describe("custo real e margem", () => {
  it("Veo cobra 8 s + extensões de 7 s; Wan em blocos de 5 s", () => {
    expect(generatedSeconds(20, "veo-3.1-fast-generate-preview")).toBe(22);
    expect(generatedSeconds(8, "veo-3.1-fast-generate-preview")).toBe(8);
    expect(generatedSeconds(20, "wan/v2.6/image-to-video")).toBe(20);
  });

  it("vídeo de 20 s custa bem mais que uma imagem e o pior crédito vem do maior pacote", () => {
    const prices = defaultProviderPrices({ ...DEFAULT_MODELS, imageProvider: "openai" });
    const video = estimateVariationUsd(prices, { media: "VIDEO", premium: false, seconds: 20, videoModel: DEFAULT_MODELS.video, lipsync: true });
    const image = estimateVariationUsd(prices, { media: "IMAGE", premium: false });
    expect(video).toBeGreaterThan(2);
    expect(image).toBeLessThan(0.2);
    const worst = worstRevenuePerCreditUsd(DEFAULT_PLANS, prices)!;
    expect(DEFAULT_PLANS[worst.plan].id).toBe("scale");
  });
});
