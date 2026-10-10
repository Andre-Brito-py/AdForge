import { db } from "./db";
import { getMetaConnection, markConnectionExpired } from "./meta/connection";
import { getPageAccessToken, MetaApiError, metaGraph } from "./meta/graph";
import { findAccount } from "./publishing";
import type { PublishTarget } from "./publish-targets";

/**
 * Resultados reais dos criativos: anúncios pagos criados pelo Vysify (Marketing API, permissão ads_read) e posts
 * orgânicos no Instagram (permissão instagram_manage_insights). Os totais ficam em AdInsight e alimentam o
 * ranking da campanha ("campeão") e o "gerar mais como este".
 */

export interface Metrics {
  impressions: number;
  reach: number;
  clicks: number;
  spend: number;
  purchases: number;
  revenue: number;
  engagement: number;
  videoViews: number;
}

const EMPTY: Metrics = { impressions: 0, reach: 0, clicks: 0, spend: 0, purchases: 0, revenue: 0, engagement: 0, videoViews: 0 };

// Ordem de preferência: um único tipo é contado, para não somar a mesma compra duas vezes.
const PURCHASE_TYPES = ["omni_purchase", "purchase", "offsite_conversion.fb_pixel_purchase", "onsite_web_purchase"];

type Action = { action_type?: string; value?: string | number };

function actionValue(list: Action[] | undefined, types: string[]): number {
  for (const t of types) {
    const found = list?.find((a) => a.action_type === t);
    if (found) return Number(found.value) || 0;
  }
  return 0;
}

const int = (v: unknown) => Math.max(0, Math.round(Number(v) || 0));
const num = (v: unknown) => Math.max(0, Number(v) || 0);

/** Linha de insights de um anúncio (date_preset=maximum). */
export function parseAdInsights(row: Record<string, unknown> | null | undefined): Metrics {
  if (!row) return { ...EMPTY };
  const actions = row.actions as Action[] | undefined;
  return {
    impressions: int(row.impressions),
    reach: int(row.reach),
    clicks: int(row.inline_link_clicks ?? row.clicks),
    spend: Math.round(num(row.spend) * 100) / 100,
    purchases: int(actionValue(actions, PURCHASE_TYPES)),
    revenue: Math.round(actionValue(row.action_values as Action[] | undefined, PURCHASE_TYPES) * 100) / 100,
    engagement: int(actionValue(actions, ["post_engagement"])),
    videoViews: int(actionValue(actions, ["video_view"])),
  };
}

/** Resposta de /{ig-media-id}/insights (cada métrica em `values` ou `total_value`). */
export function parseIgInsights(res: { data?: { name: string; values?: { value: unknown }[]; total_value?: { value: unknown } }[] }): Metrics {
  const get = (name: string) => {
    const m = res.data?.find((d) => d.name === name);
    return int(m?.total_value?.value ?? m?.values?.[0]?.value);
  };
  return {
    ...EMPTY,
    reach: get("reach"),
    impressions: get("views") || get("reach"),
    engagement: get("likes") + get("comments") + get("saved") + get("shares"),
    videoViews: get("views"),
  };
}

// ---------------- sincronização ----------------

async function saveInsight(input: { workspaceId: string; creativeId: string; source: "META_AD" | "INSTAGRAM_POST"; sourceId: string; status?: string | null; currency?: string | null; metrics?: Metrics; error?: string | null }) {
  const data = { status: input.status ?? null, currency: input.currency ?? null, error: input.error ?? null, syncedAt: new Date(), ...(input.metrics || {}) };
  await db.adInsight.upsert({
    where: { source_sourceId: { source: input.source, sourceId: input.sourceId } },
    create: { workspaceId: input.workspaceId, creativeId: input.creativeId, source: input.source, sourceId: input.sourceId, ...data },
    update: data,
  });
}

const AD_FIELDS = "effective_status,insights.date_preset(maximum){impressions,reach,clicks,inline_link_clicks,spend,actions,action_values}";

async function syncAd(ad: { id: string; workspaceId: string; creativeId: string; externalAdId: string | null; currency: string }, token: string) {
  if (!ad.externalAdId) return;
  try {
    const res = await metaGraph<{ effective_status?: string; insights?: { data?: Record<string, unknown>[] } }>(ad.externalAdId, { token, params: { fields: AD_FIELDS } });
    await saveInsight({
      workspaceId: ad.workspaceId, creativeId: ad.creativeId, source: "META_AD", sourceId: ad.id,
      status: res.effective_status ?? null, currency: ad.currency, metrics: parseAdInsights(res.insights?.data?.[0]),
    });
  } catch (error) {
    if (error instanceof MetaApiError && error.isAuthError) throw error;
    await saveInsight({ workspaceId: ad.workspaceId, creativeId: ad.creativeId, source: "META_AD", sourceId: ad.id, currency: ad.currency, error: error instanceof Error ? error.message.slice(0, 300) : "erro" });
  }
}

const IG_METRICS = ["reach,likes,comments,saved,shares,views", "reach,likes,comments,saved,shares"];

async function syncInstagramPost(
  pub: { id: string; workspaceId: string; creativeId: string; externalId: string | null; target: string; accountId: string },
  conn: NonNullable<Awaited<ReturnType<typeof getMetaConnection>>>,
  pageTokens: Map<string, string>
) {
  if (!pub.externalId) return;
  const account = findAccount(conn.assets, pub.target as PublishTarget, pub.accountId);
  if (!account) return;
  try {
    let token = pageTokens.get(account.pageId);
    if (!token) {
      token = await getPageAccessToken(conn.token!, account.pageId);
      pageTokens.set(account.pageId, token);
    }
    let lastError: unknown = null;
    for (const metric of IG_METRICS) {
      try {
        const res = await metaGraph<Parameters<typeof parseIgInsights>[0]>(`${pub.externalId}/insights`, { token, params: { metric } });
        await saveInsight({ workspaceId: pub.workspaceId, creativeId: pub.creativeId, source: "INSTAGRAM_POST", sourceId: pub.id, metrics: parseIgInsights(res) });
        return;
      } catch (error) {
        lastError = error;
        // Métrica não suportada por esse tipo de mídia (ex.: views em post antigo): tenta a lista menor.
        if (!(error instanceof MetaApiError) || error.code !== 100) break;
      }
    }
    throw lastError;
  } catch (error) {
    if (error instanceof MetaApiError && error.isAuthError) throw error;
    const permission = error instanceof MetaApiError && (error.code === 10 || error.code === 200);
    await saveInsight({
      workspaceId: pub.workspaceId, creativeId: pub.creativeId, source: "INSTAGRAM_POST", sourceId: pub.id,
      error: permission ? "PERMISSION" : error instanceof Error ? error.message.slice(0, 300) : "erro",
    });
  }
}

const IG_TARGETS = ["INSTAGRAM_FEED", "INSTAGRAM_REELS"];

/** Atualiza os resultados de um workspace (opcionalmente só de uma campanha). */
async function syncWorkspace(workspaceId: string, filter: { campaignId?: string; adIds?: string[]; pubIds?: string[] }) {
  const conn = await getMetaConnection(workspaceId);
  if (!conn?.token || conn.status !== "ACTIVE") return { synced: 0, connected: false };
  const creativeFilter = filter.campaignId ? { creative: { campaignId: filter.campaignId } } : {};
  const [ads, pubs] = await Promise.all([
    db.metaAd.findMany({
      where: { workspaceId, status: "CREATED", externalAdId: { not: null }, ...(filter.adIds ? { id: { in: filter.adIds } } : {}), ...(filter.campaignId ? { creativeId: { in: (await creativeIds(filter.campaignId)) } } : {}) },
      select: { id: true, workspaceId: true, creativeId: true, externalAdId: true, currency: true },
      take: 50,
    }),
    db.publication.findMany({
      where: { workspaceId, provider: "META", status: "PUBLISHED", target: { in: IG_TARGETS }, externalId: { not: null }, ...(filter.pubIds ? { id: { in: filter.pubIds } } : {}), ...creativeFilter },
      select: { id: true, workspaceId: true, creativeId: true, externalId: true, target: true, accountId: true },
      take: 50,
    }),
  ]);
  const pageTokens = new Map<string, string>();
  try {
    for (const ad of ads) await syncAd(ad, conn.token);
    for (const pub of pubs) await syncInstagramPost(pub, conn, pageTokens);
  } catch (error) {
    if (error instanceof MetaApiError && error.isAuthError) {
      await markConnectionExpired(conn.id);
      return { synced: 0, connected: false };
    }
    throw error;
  }
  return { synced: ads.length + pubs.length, connected: true };
}

async function creativeIds(campaignId: string) {
  return (await db.creative.findMany({ where: { campaignId }, select: { id: true } })).map((c) => c.id);
}

/** Botão "Atualizar resultados" da campanha. */
export function syncCampaignInsights(workspaceId: string, campaignId: string) {
  return syncWorkspace(workspaceId, { campaignId });
}

const DUE_MS = 6 * 60 * 60_000;

/** Cron: atualiza a cada ~6 h os anúncios dos últimos 90 dias e os posts dos últimos 60 dias. */
export async function syncDueInsights(limit = 40) {
  const now = Date.now();
  const due = new Date(now - DUE_MS);
  const [ads, pubs] = await Promise.all([
    db.metaAd.findMany({
      where: { status: "CREATED", externalAdId: { not: null }, createdAt: { gt: new Date(now - 90 * 86_400_000) } },
      select: { id: true, workspaceId: true },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
    db.publication.findMany({
      where: { provider: "META", status: "PUBLISHED", target: { in: IG_TARGETS }, externalId: { not: null }, createdAt: { gt: new Date(now - 60 * 86_400_000) } },
      select: { id: true, workspaceId: true },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
  ]);
  const fresh = new Set(
    (await db.adInsight.findMany({ where: { sourceId: { in: [...ads, ...pubs].map((x) => x.id) }, syncedAt: { gt: due } }, select: { sourceId: true } })).map((x) => x.sourceId)
  );
  const byWorkspace = new Map<string, { adIds: string[]; pubIds: string[] }>();
  let count = 0;
  for (const [list, key] of [[ads, "adIds"], [pubs, "pubIds"]] as const) {
    for (const item of list) {
      if (fresh.has(item.id) || count >= limit) continue;
      const entry = byWorkspace.get(item.workspaceId) ?? { adIds: [], pubIds: [] };
      entry[key].push(item.id);
      byWorkspace.set(item.workspaceId, entry);
      count++;
    }
  }
  let synced = 0;
  for (const [workspaceId, ids] of byWorkspace) {
    try {
      synced += (await syncWorkspace(workspaceId, { adIds: ids.adIds, pubIds: ids.pubIds })).synced;
    } catch (error) {
      console.error(`[performance] workspace ${workspaceId}`, error);
    }
  }
  return synced;
}

// ---------------- ranking ----------------

export interface CreativeResult extends Metrics {
  creativeId: string;
  currency: string | null;
  ads: number;
  posts: number;
  ctr: number | null;
  cpc: number | null;
  cpa: number | null;
  roas: number | null;
  engagementRate: number | null;
  /** Algum anúncio ativo agora. */
  active: boolean;
  /** Post sem permissão de leitura dos resultados (reconectar a Meta). */
  needsPermission: boolean;
}

export type RankingBasis = "roas" | "cpa" | "ctr" | "engagement";

export interface CampaignRanking {
  results: CreativeResult[];
  basis: RankingBasis | null;
  winnerId: string | null;
  syncedAt: string | null;
}

/** Mínimo para comparar: cada criativo com pelo menos isso de impressões (ou alcance, no orgânico). */
export const MIN_IMPRESSIONS = 300;

export function rankResults(results: CreativeResult[]): { basis: RankingBasis | null; winnerId: string | null } {
  const eligible = results.filter((r) => Math.max(r.impressions, r.reach) >= MIN_IMPRESSIONS);
  if (eligible.length < 2) return { basis: null, winnerId: null };
  const best = (list: CreativeResult[], score: (r: CreativeResult) => number) => list.reduce((a, b) => (score(b) > score(a) ? b : a));

  const paid = eligible.filter((r) => r.spend > 0);
  // 1) Vendas com receita: maior retorno sobre o investimento; 2) vendas sem receita: menor custo por venda.
  if (paid.some((r) => r.revenue > 0)) return { basis: "roas", winnerId: best(paid, (r) => r.roas ?? 0).creativeId };
  if (paid.some((r) => r.purchases > 0)) return { basis: "cpa", winnerId: best(paid, (r) => (r.cpa ? -r.cpa : -Infinity)).creativeId };
  // 3) Sem vendas: taxa de cliques no link (precisa de cliques suficientes para não ser sorte).
  if (paid.length >= 2 && paid.reduce((n, r) => n + r.clicks, 0) >= 10) return { basis: "ctr", winnerId: best(paid, (r) => r.ctr ?? 0).creativeId };
  // 4) Só orgânico: engajamento por pessoa alcançada.
  const organic = eligible.filter((r) => r.reach > 0);
  if (organic.length >= 2 && organic.some((r) => r.engagement > 0)) return { basis: "engagement", winnerId: best(organic, (r) => r.engagementRate ?? 0).creativeId };
  return { basis: null, winnerId: null };
}

const ratio = (a: number, b: number) => (b > 0 ? a / b : null);

export type InsightRow = Metrics & { source: string; status: string | null; currency: string | null; error: string | null };

/** Soma os resultados de todos os anúncios e posts de um criativo. */
export function summarize(creativeId: string, list: InsightRow[]): CreativeResult {
  const sum = list.reduce<Metrics>(
    (acc, r) => ({
      impressions: acc.impressions + r.impressions, reach: acc.reach + r.reach, clicks: acc.clicks + r.clicks, spend: acc.spend + r.spend,
      purchases: acc.purchases + r.purchases, revenue: acc.revenue + r.revenue, engagement: acc.engagement + r.engagement, videoViews: acc.videoViews + r.videoViews,
    }),
    { ...EMPTY }
  );
  return {
    creativeId,
    ...sum,
    spend: Math.round(sum.spend * 100) / 100,
    currency: list.find((r) => r.currency)?.currency ?? null,
    ads: list.filter((r) => r.source === "META_AD").length,
    posts: list.filter((r) => r.source === "INSTAGRAM_POST").length,
    ctr: ratio(sum.clicks, sum.impressions),
    cpc: ratio(sum.spend, sum.clicks),
    cpa: ratio(sum.spend, sum.purchases),
    roas: sum.spend > 0 && sum.revenue > 0 ? sum.revenue / sum.spend : null,
    engagementRate: ratio(sum.engagement, sum.reach),
    active: list.some((r) => r.status === "ACTIVE"),
    needsPermission: list.some((r) => r.error === "PERMISSION"),
  };
}

/** Resumo dos números para a IA (em inglês, como o resto do prompt). */
export function describeResults(r: CreativeResult | undefined, basis: RankingBasis | null): string {
  if (!r) return "best performer chosen by the client (no synced metrics)";
  const parts = [
    r.impressions && `${r.impressions} impressions`,
    r.reach && `${r.reach} people reached`,
    r.ctr !== null && r.spend > 0 && `link CTR ${(r.ctr * 100).toFixed(2)}%`,
    r.purchases && `${r.purchases} purchases`,
    r.roas !== null && `ROAS ${r.roas.toFixed(2)}x`,
    r.engagementRate !== null && r.engagement > 0 && `engagement rate ${(r.engagementRate * 100).toFixed(1)}%`,
  ].filter(Boolean);
  return `${parts.join(", ")}${basis ? ` — best of the campaign by ${basis}` : ""}`;
}

/** Resultados e campeão de uma campanha (do que já foi sincronizado). */
export async function campaignRanking(campaignId: string): Promise<CampaignRanking> {
  const rows = await db.adInsight.findMany({ where: { creative: { campaignId } }, orderBy: { syncedAt: "desc" } });
  const byCreative = new Map<string, typeof rows>();
  for (const r of rows) byCreative.set(r.creativeId, [...(byCreative.get(r.creativeId) || []), r]);
  const results = [...byCreative.entries()].map(([id, list]) => summarize(id, list));
  const { basis, winnerId } = rankResults(results);
  return { results, basis, winnerId, syncedAt: rows[0]?.syncedAt.toISOString() ?? null };
}
