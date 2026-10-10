import { describe, expect, it } from "vitest";
import { describeResults, parseAdInsights, parseIgInsights, rankResults, summarize, type InsightRow } from "@/lib/performance";

const row = (over: Partial<InsightRow>): InsightRow => ({
  source: "META_AD", status: "ACTIVE", currency: "BRL", error: null,
  impressions: 0, reach: 0, clicks: 0, spend: 0, purchases: 0, revenue: 0, engagement: 0, videoViews: 0, ...over,
});

describe("leitura dos resultados da Meta", () => {
  it("usa cliques no link e conta a compra uma única vez", () => {
    const m = parseAdInsights({
      impressions: "1500", reach: "1200", clicks: "80", inline_link_clicks: "45", spend: "52.37",
      actions: [
        { action_type: "purchase", value: "3" },
        { action_type: "omni_purchase", value: "3" },
        { action_type: "post_engagement", value: "210" },
        { action_type: "video_view", value: "900" },
      ],
      action_values: [{ action_type: "omni_purchase", value: "389.70" }, { action_type: "purchase", value: "389.70" }],
    });
    expect(m).toEqual({ impressions: 1500, reach: 1200, clicks: 45, spend: 52.37, purchases: 3, revenue: 389.7, engagement: 210, videoViews: 900 });
    expect(parseAdInsights(undefined).impressions).toBe(0);
  });

  it("lê os resultados de post do Instagram (values ou total_value)", () => {
    const m = parseIgInsights({
      data: [
        { name: "reach", values: [{ value: 800 }] },
        { name: "likes", total_value: { value: 40 } },
        { name: "comments", values: [{ value: 5 }] },
        { name: "saved", values: [{ value: 7 }] },
        { name: "shares", values: [{ value: 3 }] },
        { name: "views", values: [{ value: 2100 }] },
      ],
    });
    expect(m).toMatchObject({ reach: 800, impressions: 2100, engagement: 55, videoViews: 2100 });
  });
});

describe("campeão", () => {
  it("com vendas e receita, vence o maior retorno (não o que vendeu mais)", () => {
    const a = summarize("a", [row({ impressions: 2000, clicks: 40, spend: 100, purchases: 5, revenue: 300 })]);
    const b = summarize("b", [row({ impressions: 1500, clicks: 30, spend: 40, purchases: 3, revenue: 240 })]);
    expect(b.roas).toBe(6);
    expect(rankResults([a, b])).toEqual({ basis: "roas", winnerId: "b" });
  });

  it("sem receita mas com vendas, vence o menor custo por venda", () => {
    const a = summarize("a", [row({ impressions: 900, clicks: 20, spend: 90, purchases: 3 })]);
    const b = summarize("b", [row({ impressions: 900, clicks: 20, spend: 90, purchases: 1 })]);
    expect(rankResults([a, b])).toEqual({ basis: "cpa", winnerId: "a" });
  });

  it("sem vendas, vence a maior taxa de cliques; com poucos cliques ainda não há campeão", () => {
    const a = summarize("a", [row({ impressions: 1000, clicks: 12, spend: 30 })]);
    const b = summarize("b", [row({ impressions: 1000, clicks: 25, spend: 30 })]);
    expect(rankResults([a, b])).toEqual({ basis: "ctr", winnerId: "b" });
    const c = summarize("c", [row({ impressions: 1000, clicks: 2, spend: 5 })]);
    const d = summarize("d", [row({ impressions: 1000, clicks: 3, spend: 5 })]);
    expect(rankResults([c, d]).winnerId).toBeNull();
  });

  it("só orgânico: engajamento por pessoa alcançada", () => {
    const a = summarize("a", [row({ source: "INSTAGRAM_POST", reach: 1000, engagement: 50 })]);
    const b = summarize("b", [row({ source: "INSTAGRAM_POST", reach: 400, engagement: 40 })]);
    expect(rankResults([a, b])).toEqual({ basis: "engagement", winnerId: "b" });
  });

  it("precisa de pelo menos 2 criativos com dados suficientes", () => {
    const a = summarize("a", [row({ impressions: 5000, clicks: 100, spend: 50, purchases: 4, revenue: 400 })]);
    const b = summarize("b", [row({ impressions: 120, clicks: 9, spend: 2 })]);
    expect(rankResults([a, b])).toEqual({ basis: null, winnerId: null });
    expect(rankResults([a])).toEqual({ basis: null, winnerId: null });
  });

  it("soma anúncios e posts do mesmo criativo", () => {
    const r = summarize("a", [row({ impressions: 1000, spend: 20, clicks: 10 }), row({ source: "INSTAGRAM_POST", status: null, reach: 300, engagement: 30, error: "PERMISSION" })]);
    expect(r).toMatchObject({ ads: 1, posts: 1, impressions: 1000, reach: 300, ctr: 0.01, active: true, needsPermission: true });
  });

  it("resume os números para a IA", () => {
    const r = summarize("a", [row({ impressions: 2000, clicks: 50, spend: 100, purchases: 4, revenue: 500 })]);
    expect(describeResults(r, "roas")).toBe("2000 impressions, link CTR 2.50%, 4 purchases, ROAS 5.00x — best of the campaign by roas");
    expect(describeResults(undefined, null)).toMatch(/no synced metrics/);
  });
});
