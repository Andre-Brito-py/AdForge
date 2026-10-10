import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const url = process.env.TEST_DATABASE_URL;

vi.hoisted(() => {
  // O "gerar mais como este" exige um provedor de IA configurado (a IA em si é simulada abaixo).
  process.env.GEMINI_API_KEY = "test-key";
});

vi.mock("@/services/email", () => ({
  sendWelcomeEmail: vi.fn(async () => {}),
  appUrl: () => "https://app.vysify.test",
}));
// Os jobs de geração não rodam no teste.
vi.mock("@vercel/functions", () => ({ waitUntil: vi.fn() }));

const strategyCalls: Record<string, unknown>[] = [];
vi.mock("@/services/ai/text", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/services/ai/text")>();
  return {
    ...original,
    generateCampaignStrategy: vi.fn(async (input: Record<string, unknown>) => {
      strategyCalls.push(input);
      const n = input.variations as number;
      return {
        language: "pt-BR", productSize: null, analysis: "", hooks: [],
        variants: Array.from({ length: n }, (_, i) => ({
          headline: `Novo gancho ${i + 1}`, copy: "Copy", cta: "Compre agora", visualConcept: "Studio shot", voiceover: "", scenes: [], hashtags: ["#a"],
        })),
      };
    }),
  };
});

describe.skipIf(!url)("resultados e campeão (banco)", async () => {
  const { db } = await import("@/lib/db");
  const { createUserWithWorkspace } = await import("@/lib/users");
  const { encryptSecret } = await import("@/lib/crypto");
  const { grantCredits } = await import("@/services/credits");
  const { TERMS_VERSION } = await import("@/lib/terms");
  const { syncCampaignInsights, campaignRanking } = await import("@/lib/performance");
  const { generateFromWinner } = await import("@/lib/generation");

  const email = `perf-${Date.now()}@exemplo.com`;
  let userId = "";
  let workspaceId = "";
  let campaignId = "";
  const creatives: string[] = [];

  beforeAll(async () => {
    const created = await createUserWithWorkspace({ email, name: "Perf" });
    userId = created.user.id;
    workspaceId = created.workspaceId;
    await db.connection.create({
      data: {
        workspaceId, provider: "META", externalUserId: "1", accessToken: encryptSecret("user-token"), status: "ACTIVE",
        assetsJson: JSON.stringify([{ pageId: "PAGE1", pageName: "Página", instagram: { id: "IG1", username: "loja" } }]),
      },
    });
    const product = await db.product.create({ data: { workspaceId, name: "Garrafa", originalImageUrl: "/uploads/x.png" } });
    const campaign = await db.campaign.create({
      data: { workspaceId, productId: product.id, name: "Camp", objective: "SALES", tone: "STUDIO", style: "STUDIO", platform: "INSTAGRAM_FEED", mediaType: "IMAGE", status: "COMPLETED", language: "pt-BR" },
    });
    campaignId = campaign.id;
    for (const i of [0, 1, 2]) {
      await db.creative.create({ data: { campaignId, type: "COPY", variantIndex: i, provider: "llm", model: "m", headline: `Título ${i}`, text: `Texto ${i}`, cta: "Comprar", status: "COMPLETED" } });
      const v = await db.creative.create({ data: { campaignId, type: "IMAGE", variantIndex: i, provider: "google", model: "img", outputUrl: `/uploads/${i}.png`, aspectRatio: "4:5", status: "COMPLETED", prompt: "Studio shot" } });
      creatives.push(v.id);
    }
    // Criativos 0 e 1 viraram anúncios pagos; o 2 foi publicado no Instagram.
    for (const [i, ad] of [["AD0"], ["AD1"]].entries()) {
      await db.metaAd.create({
        data: { workspaceId, creativeId: creatives[i], adAccountId: "act_1", pageId: "PAGE1", name: "x", objective: "OUTCOME_TRAFFIC", dailyBudget: 2000, currency: "BRL", countries: "BR", link: "https://loja.com", status: "CREATED", externalAdId: ad[0] },
      });
    }
    await db.publication.create({ data: { workspaceId, creativeId: creatives[2], provider: "META", target: "INSTAGRAM_FEED", accountId: "IG1", status: "PUBLISHED", externalId: "MEDIA1" } });
    await grantCredits({ workspaceId, userId, amount: 100, type: "BONUS", description: "teste" } as never);

    // Graph API simulada.
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL) => {
      const u = new URL(String(input));
      const path = u.pathname.split("/").slice(2).join("/");
      const json =
        path === "AD0" ? { effective_status: "ACTIVE", insights: { data: [{ impressions: "3000", inline_link_clicks: "60", spend: "100", actions: [{ action_type: "omni_purchase", value: "4" }], action_values: [{ action_type: "omni_purchase", value: "520" }] }] } }
        : path === "AD1" ? { effective_status: "PAUSED", insights: { data: [{ impressions: "2500", inline_link_clicks: "70", spend: "100", actions: [{ action_type: "omni_purchase", value: "2" }], action_values: [{ action_type: "omni_purchase", value: "180" }] }] } }
        : path === "PAGE1" ? { access_token: "page-token" }
        : path === "MEDIA1/insights" ? { data: [{ name: "reach", values: [{ value: 900 }] }, { name: "likes", values: [{ value: 30 }] }] }
        : {};
      return new Response(JSON.stringify(json), { status: 200, headers: { "Content-Type": "application/json" } });
    }));
  });

  afterAll(async () => {
    vi.unstubAllGlobals();
    await db.workspace.deleteMany({ where: { id: workspaceId } });
    await db.user.deleteMany({ where: { email } });
    await db.$disconnect();
  });

  it("sincroniza anúncios e posts e aponta o campeão pelo retorno", async () => {
    const sync = await syncCampaignInsights(workspaceId, campaignId);
    expect(sync).toEqual({ synced: 3, connected: true });
    const ranking = await campaignRanking(campaignId);
    expect(ranking.basis).toBe("roas");
    expect(ranking.winnerId).toBe(creatives[0]);
    const first = ranking.results.find((r) => r.creativeId === creatives[0])!;
    expect(first).toMatchObject({ purchases: 4, revenue: 520, spend: 100, roas: 5.2, active: true });
    expect(ranking.results.find((r) => r.creativeId === creatives[2])).toMatchObject({ posts: 1, reach: 900, engagement: 30 });
    // Sincronizar de novo atualiza (não duplica).
    await syncCampaignInsights(workspaceId, campaignId);
    expect(await db.adInsight.count({ where: { workspaceId } })).toBe(3);
  });

  it("gera variações a partir do campeão, cobra e passa os números para a IA", async () => {
    const user = { id: userId, email, locale: "pt", workspaceId, workspaceRole: "OWNER", termsVersion: TERMS_VERSION, country: "BR", emailVerified: new Date() } as never;
    const result = await generateFromWinner(user, campaignId, creatives[0], 2);
    expect(result.count).toBe(2);
    const winnerInput = strategyCalls.at(-1)!.winner as { headline: string; results: string };
    expect(winnerInput.headline).toBe("Título 0");
    expect(winnerInput.results).toMatch(/ROAS 5\.20x — best of the campaign by roas/);
    const fresh = await db.creative.findMany({ where: { campaignId, variantIndex: { gte: 3 } }, orderBy: [{ variantIndex: "asc" }, { type: "asc" }] });
    expect(fresh.map((c) => `${c.variantIndex}:${c.type}`)).toEqual(["3:COPY", "3:IMAGE", "4:COPY", "4:IMAGE"]);
    expect(fresh.find((c) => c.type === "IMAGE")).toMatchObject({ aspectRatio: "4:5", creditsUsed: result.cost / 2 });
    // Cobrança única no extrato (a geração em si roda em segundo plano; aqui ela falha sem IA real e é estornada).
    const charge = await db.creditTransaction.findFirst({ where: { workspaceId, amount: -result.cost } });
    expect(charge?.description).toMatch(/campeão/);
  });
});
