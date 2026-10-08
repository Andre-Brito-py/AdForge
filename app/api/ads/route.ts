import { NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { z } from "zod";
import { db } from "@/lib/db";
import { enforceRateLimit, handler, HttpError, parseBody } from "@/lib/api";
import { requireApiManager, requireApiUser } from "@/lib/auth";
import { AD_CTAS, AD_OBJECTIVES, adsManagerUrl, createMetaAd, runMetaAd } from "@/lib/meta/ads";

export const maxDuration = 300;

const bodySchema = z.object({
  creativeId: z.uuid(),
  adAccountId: z.string().regex(/^act_\d+$/),
  pageId: z.string().regex(/^\d+$/),
  instagramId: z.string().regex(/^\d+$/).optional().nullable(),
  objective: z.enum(Object.keys(AD_OBJECTIVES) as [keyof typeof AD_OBJECTIVES, ...(keyof typeof AD_OBJECTIVES)[]]),
  dailyBudget: z.number().min(1).max(100_000),
  countries: z.array(z.string().regex(/^[A-Z]{2}$/)).min(1).max(25),
  link: z.string().trim().url().refine((v) => /^https:\/\//i.test(v), "validation.websiteHttps"),
  cta: z.enum(AD_CTAS),
  headline: z.string().trim().min(1).max(255),
  message: z.string().trim().min(1).max(2000),
});

// Cria um anúncio PAUSADO na conta de anúncios da Meta (dono/admin: envolve orçamento).
export const POST = handler(async (request: Request) => {
  const user = await requireApiManager({ verified: true });
  await enforceRateLimit(request, "meta-ads", 20, 60 * 60, user.workspaceId);
  const body = await parseBody(request, bodySchema);
  const ad = await createMetaAd(user, body);
  waitUntil(runMetaAd(ad.id).catch((e) => console.error("[meta-ads] run", e)));
  return NextResponse.json({ id: ad.id, status: ad.status }, { status: 201 });
});

// Anúncios criados a partir dos criativos de uma campanha.
export const GET = handler(async (request: Request) => {
  const user = await requireApiUser();
  const campaignId = new URL(request.url).searchParams.get("campaignId");
  if (!campaignId) throw new HttpError(400, "errors.campaignRequired");
  const creatives = await db.creative.findMany({ where: { campaignId, campaign: { workspaceId: user.workspaceId } }, select: { id: true } });
  const ads = await db.metaAd.findMany({
    where: { workspaceId: user.workspaceId, creativeId: { in: creatives.map((c) => c.id) } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(ads.map((a) => ({
    id: a.id, creativeId: a.creativeId, status: a.status, error: a.status === "FAILED" ? a.error : null,
    dailyBudget: a.dailyBudget / 100, currency: a.currency, objective: a.objective, createdAt: a.createdAt,
    managerUrl: a.status === "CREATED" ? adsManagerUrl(a.adAccountId, a.externalAdId) : null,
  })));
});
