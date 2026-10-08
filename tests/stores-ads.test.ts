import { createHmac } from "crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { normalizeShopDomain, verifyShopifyHmac } from "@/lib/stores/shopify";

const url = process.env.TEST_DATABASE_URL;
vi.mock("@/services/email", () => ({
  sendWelcomeEmail: vi.fn(async () => {}),
  appUrl: () => "https://app.vysify.test",
}));

describe("Shopify", () => {
  it("aceita só domínios .myshopify.com", () => {
    expect(normalizeShopDomain("Minha-Loja")).toBe("minha-loja.myshopify.com");
    expect(normalizeShopDomain("https://minha-loja.myshopify.com/admin")).toBe("minha-loja.myshopify.com");
    expect(normalizeShopDomain("evil.com")).toBeNull();
    expect(normalizeShopDomain("loja.myshopify.com.evil.com")).toBeNull();
  });

  it("confere a assinatura do retorno do OAuth", () => {
    const secret = "segredo";
    const params = new URLSearchParams({ code: "abc", shop: "loja.myshopify.com", state: "xyz", timestamp: "1700000000" });
    const message = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join("&");
    params.set("hmac", createHmac("sha256", secret).update(message).digest("hex"));
    expect(verifyShopifyHmac(params, secret)).toBe(true);
    params.set("shop", "outra.myshopify.com");
    expect(verifyShopifyHmac(params, secret)).toBe(false);
  });
});

describe.skipIf(!url)("anúncio pago na Meta", async () => {
  const { db } = await import("@/lib/db");
  const { createUserWithWorkspace } = await import("@/lib/users");
  const { encryptSecret } = await import("@/lib/crypto");
  const { runMetaAd } = await import("@/lib/meta/ads");

  const email = `ads-${Date.now()}@exemplo.com`;
  let workspaceId = "";
  const calls: { path: string; body: URLSearchParams }[] = [];

  beforeAll(async () => {
    const created = await createUserWithWorkspace({ email, name: "Ads" });
    workspaceId = created.workspaceId;
    await db.connection.create({
      data: {
        workspaceId, provider: "META", externalUserId: "1", accessToken: encryptSecret("token-de-teste"), status: "ACTIVE",
        assetsJson: JSON.stringify([{ pageId: "111", pageName: "Página", instagram: null }]),
      },
    });
    // Graph API simulada: devolve ids em sequência e registra o que foi enviado.
    let n = 0;
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL, init?: RequestInit) => {
      const path = new URL(String(input)).pathname.split("/").slice(2).join("/");
      calls.push({ path, body: new URLSearchParams(String(init?.body || "")) });
      const json = path.endsWith("adimages") ? { images: { "a.png": { hash: "HASH" } } } : { id: `id_${++n}` };
      return new Response(JSON.stringify(json), { status: 200, headers: { "Content-Type": "application/json" } });
    }));
  });

  afterAll(async () => {
    vi.unstubAllGlobals();
    await db.workspace.deleteMany({ where: { id: workspaceId } });
    await db.user.deleteMany({ where: { email } });
    await db.$disconnect();
  });

  it("cria campanha, conjunto, criativo e anúncio, tudo pausado", async () => {
    const product = await db.product.create({ data: { workspaceId, name: "Produto", originalImageUrl: "/uploads/x.png" } });
    const campaign = await db.campaign.create({ data: { workspaceId, productId: product.id, name: "Camp", objective: "SALES", tone: "STUDIO", status: "COMPLETED" } });
    // A imagem é lida do armazenamento: apontamos para um arquivo pequeno de verdade.
    const fs = await import("fs");
    const path = await import("path");
    const dir = path.join(process.cwd(), "public", "uploads", "test-ads");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "img.png"), Buffer.from("89504e470d0a1a0a", "hex"));
    const creative = await db.creative.create({ data: { campaignId: campaign.id, type: "IMAGE", provider: "openai", model: "teste", variantIndex: 0, status: "COMPLETED", outputUrl: "/uploads/test-ads/img.png" } });
    const ad = await db.metaAd.create({
      data: {
        workspaceId, creativeId: creative.id, adAccountId: "act_999", pageId: "111", name: "Vysify · Camp", objective: "OUTCOME_TRAFFIC",
        dailyBudget: 2000, currency: "BRL", countries: "BR", link: "https://loja.com", optionsJson: JSON.stringify({ instagramId: null, cta: "SHOP_NOW", headline: "Título", message: "Texto" }),
      },
    });

    await runMetaAd(ad.id);
    const done = await db.metaAd.findUniqueOrThrow({ where: { id: ad.id } });
    fs.rmSync(dir, { recursive: true, force: true });

    expect(done.error).toBeNull();
    expect(done.status).toBe("CREATED");
    expect(calls.map((c) => c.path)).toEqual(["act_999/campaigns", "act_999/adsets", "act_999/adimages", "act_999/adcreatives", "act_999/ads"]);
    expect(calls[0].body.get("status")).toBe("PAUSED");
    expect(calls[1].body.get("status")).toBe("PAUSED");
    expect(calls[1].body.get("daily_budget")).toBe("2000");
    expect(calls[4].body.get("status")).toBe("PAUSED");
    expect(JSON.parse(calls[3].body.get("object_story_spec")!).link_data.image_hash).toBe("HASH");
  });
});
