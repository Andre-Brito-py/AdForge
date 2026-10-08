import { db } from "@/lib/db";
import { HttpError } from "@/lib/api";
import { readOwnMedia } from "@/lib/storage";
import { appUrl } from "@/services/email";
import { getMetaConnection, markConnectionExpired } from "./connection";
import { MetaApiError, metaGraph } from "./graph";
import type { SessionUser } from "@/lib/auth";

/**
 * Anúncio pago na Meta (Marketing API) a partir de um criativo: campanha → conjunto de anúncios → criativo → anúncio.
 * Tudo nasce PAUSADO: o cliente revisa público, orçamento e posicionamentos no Gerenciador de Anúncios e ativa lá.
 * Exige a permissão ads_management (App Review da Meta).
 */

export const AD_OBJECTIVES = {
  OUTCOME_TRAFFIC: { optimization: "LINK_CLICKS" },
  OUTCOME_AWARENESS: { optimization: "REACH" },
  OUTCOME_ENGAGEMENT: { optimization: "POST_ENGAGEMENT" },
} as const;
export type AdObjective = keyof typeof AD_OBJECTIVES;
export const AD_CTAS = ["SHOP_NOW", "LEARN_MORE", "BUY_NOW", "ORDER_NOW", "SIGN_UP", "CONTACT_US"] as const;
export type AdCta = (typeof AD_CTAS)[number];

export interface AdAccount { id: string; name: string; currency: string; active: boolean }

async function userToken(workspaceId: string) {
  const conn = await getMetaConnection(workspaceId);
  if (!conn?.token || conn.status !== "ACTIVE") throw new HttpError(409, "errors.metaNotConnected", "META_NOT_CONNECTED");
  return conn;
}

/** Contas de anúncio que a pessoa conectada pode usar. */
export async function listAdAccounts(workspaceId: string): Promise<AdAccount[]> {
  const conn = await userToken(workspaceId);
  try {
    const res = await metaGraph<{ data: { id: string; name: string; currency: string; account_status: number }[] }>("me/adaccounts", {
      token: conn.token!,
      params: { fields: "id,name,currency,account_status", limit: 50 },
    });
    return res.data.map((a) => ({ id: a.id, name: a.name, currency: a.currency, active: a.account_status === 1 }));
  } catch (error) {
    if (error instanceof MetaApiError && error.isAuthError) await markConnectionExpired(conn.id);
    if (error instanceof MetaApiError && (error.code === 200 || error.code === 10)) throw new HttpError(403, "errors.adsPermission", "ADS_PERMISSION");
    throw error;
  }
}

export interface AdInput {
  creativeId: string;
  adAccountId: string;
  pageId: string;
  instagramId?: string | null;
  objective: AdObjective;
  /** Orçamento diário em unidades da moeda da conta (ex.: 20 = R$ 20,00). */
  dailyBudget: number;
  countries: string[];
  link: string;
  cta: AdCta;
  headline: string;
  message: string;
}

export async function createMetaAd(user: SessionUser, input: AdInput) {
  const creative = await db.creative.findFirst({ where: { id: input.creativeId, campaign: { workspaceId: user.workspaceId } }, include: { campaign: true } });
  if (!creative) throw new HttpError(404, "errors.creativeNotFound");
  if (creative.status !== "COMPLETED" || !creative.outputUrl) throw new HttpError(409, "errors.creativeNotReady");

  const conn = await userToken(user.workspaceId);
  if (!conn.assets.some((a) => a.pageId === input.pageId)) throw new HttpError(400, "errors.targetAccountNotFound");
  const accounts = await listAdAccounts(user.workspaceId);
  const account = accounts.find((a) => a.id === input.adAccountId);
  if (!account) throw new HttpError(400, "errors.adAccountNotFound");

  return db.metaAd.create({
    data: {
      workspaceId: user.workspaceId,
      creativeId: creative.id,
      adAccountId: account.id,
      pageId: input.pageId,
      name: `Vysify · ${creative.campaign.name}`.slice(0, 200),
      objective: input.objective,
      dailyBudget: Math.round(input.dailyBudget * 100),
      currency: account.currency,
      countries: input.countries.join(","),
      link: input.link,
      createdById: user.id,
      optionsJson: JSON.stringify({ instagramId: input.instagramId || null, cta: input.cta, headline: input.headline, message: input.message }),
    },
  });
}

const VIDEO_WAIT_MS = 4 * 60_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function absoluteUrl(url: string) {
  return /^https?:\/\//i.test(url) ? url : `${appUrl()}${url}`;
}

/** Executa a criação (em segundo plano). Grava os IDs a cada passo, para o Gerenciador de Anúncios. */
export async function runMetaAd(id: string) {
  const claimed = await db.metaAd.updateMany({ where: { id, status: "PENDING" }, data: { status: "PROCESSING" } });
  if (claimed.count === 0) return;
  const ad = await db.metaAd.findUniqueOrThrow({ where: { id } });
  const opts = JSON.parse(ad.optionsJson || "{}") as { instagramId: string | null; cta: AdCta; headline: string; message: string };
  const creative = await db.creative.findUniqueOrThrow({ where: { id: ad.creativeId } });
  const conn = await getMetaConnection(ad.workspaceId);

  try {
    if (!conn?.token) throw new MetaApiError("Conexão com a Meta inativa", 190);
    const token = conn.token;
    const act = ad.adAccountId;
    const objective = ad.objective as AdObjective;

    const campaign = await metaGraph<{ id: string }>(`${act}/campaigns`, {
      method: "POST", token,
      params: {
        name: ad.name, objective, status: "PAUSED", special_ad_categories: "[]",
        // Orçamento fica no conjunto de anúncios (não na campanha).
        is_adset_budget_sharing_enabled: false,
      },
    });
    await db.metaAd.update({ where: { id }, data: { externalCampaignId: campaign.id } });

    const adset = await metaGraph<{ id: string }>(`${act}/adsets`, {
      method: "POST", token,
      params: {
        name: `${ad.name} · conjunto`, campaign_id: campaign.id, daily_budget: ad.dailyBudget,
        billing_event: "IMPRESSIONS", optimization_goal: AD_OBJECTIVES[objective].optimization, bid_strategy: "LOWEST_COST_WITHOUT_CAP",
        targeting: JSON.stringify({ geo_locations: { countries: ad.countries.split(",") }, age_min: 18, targeting_automation: { advantage_audience: 1 } }),
        status: "PAUSED",
      },
    });
    await db.metaAd.update({ where: { id }, data: { externalAdSetId: adset.id } });

    // Mídia: imagem por upload direto (hash); vídeo pela URL pública, com a capa como miniatura.
    const uploadImage = async (url: string) => {
      const { buffer } = await readOwnMedia(url);
      const res = await metaGraph<{ images: Record<string, { hash: string }> }>(`${act}/adimages`, { method: "POST", token, params: { bytes: buffer.toString("base64") } });
      return Object.values(res.images)[0].hash;
    };
    const callToAction = JSON.stringify({ type: opts.cta, value: { link: ad.link } });
    let spec: Record<string, unknown>;
    if (creative.type === "VIDEO") {
      const video = await metaGraph<{ id: string }>(`${act}/advideos`, { method: "POST", token, params: { file_url: absoluteUrl(creative.outputUrl!), name: ad.name } });
      const started = Date.now();
      for (;;) {
        const v = await metaGraph<{ status?: { video_status?: string } }>(video.id, { token, params: { fields: "status" } });
        if (v.status?.video_status === "ready") break;
        if (v.status?.video_status === "error") throw new Error("A Meta não conseguiu processar o vídeo");
        if (Date.now() - started > VIDEO_WAIT_MS) throw new Error("A Meta demorou demais para processar o vídeo; tente de novo em alguns minutos");
        await sleep(8_000);
      }
      const imageHash = await uploadImage(creative.thumbnailUrl || creative.outputUrl!).catch(() => undefined);
      spec = { page_id: ad.pageId, video_data: { video_id: video.id, ...(imageHash ? { image_hash: imageHash } : {}), message: opts.message, title: opts.headline, call_to_action: JSON.parse(callToAction) } };
    } else {
      const imageHash = await uploadImage(creative.outputUrl!);
      spec = { page_id: ad.pageId, link_data: { image_hash: imageHash, link: ad.link, message: opts.message, name: opts.headline, call_to_action: JSON.parse(callToAction) } };
    }
    if (opts.instagramId) spec.instagram_user_id = opts.instagramId;

    const adCreative = await metaGraph<{ id: string }>(`${act}/adcreatives`, {
      method: "POST", token, params: { name: `${ad.name} · criativo`, object_story_spec: JSON.stringify(spec) },
    });
    const created = await metaGraph<{ id: string }>(`${act}/ads`, {
      method: "POST", token, params: { name: ad.name, adset_id: adset.id, creative: JSON.stringify({ creative_id: adCreative.id }), status: "PAUSED" },
    });
    await db.metaAd.update({ where: { id }, data: { status: "CREATED", externalAdId: created.id, error: null } });
  } catch (error) {
    let message = error instanceof Error ? error.message : String(error);
    if (error instanceof MetaApiError && error.isAuthError) {
      if (conn) await markConnectionExpired(conn.id);
      message = "A conexão com a Meta expirou. Reconecte em Integrações e tente de novo.";
    }
    console.error(`[meta-ads] ${id} falhou`, error);
    await db.metaAd.update({ where: { id }, data: { status: "FAILED", error: message.slice(0, 500) } });
  }
}

/**
 * Cron: anúncio que ficou na fila (a execução foi encerrada antes de começar) é retomado; um que parou no meio
 * por mais de 10 minutos é marcado como falho (os IDs já criados ficam gravados para conferir no Gerenciador).
 */
export async function advancePendingAds() {
  const stalePending = await db.metaAd.findMany({ where: { status: "PENDING", createdAt: { lt: new Date(Date.now() - 2 * 60_000) } }, select: { id: true }, take: 5 });
  for (const a of stalePending) await runMetaAd(a.id);
  await db.metaAd.updateMany({
    where: { status: "PROCESSING", updatedAt: { lt: new Date(Date.now() - 10 * 60_000) } },
    data: { status: "FAILED", error: "A criação foi interrompida. Confira no Gerenciador de Anúncios o que já foi criado e tente de novo." },
  });
  return stalePending.length;
}

/** Link do anúncio no Gerenciador de Anúncios. */
export function adsManagerUrl(adAccountId: string, adId?: string | null) {
  const act = adAccountId.replace(/^act_/, "");
  return `https://adsmanager.facebook.com/adsmanager/manage/ads?act=${act}${adId ? `&selected_ad_ids=${adId}` : ""}`;
}
