import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { enforceRateLimit, handler, HttpError } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { campaignRanking, syncCampaignInsights } from "@/lib/performance";

export const maxDuration = 60;

async function ownCampaign(id: string, workspaceId: string) {
  const campaign = await db.campaign.findFirst({ where: { id, workspaceId }, select: { id: true } });
  if (!campaign) throw new HttpError(404, "errors.campaignNotFound");
}

// Resultados e campeão da campanha (do que já foi sincronizado).
export const GET = handler(async (_request: Request, ctx: RouteContext<"/api/campaigns/[id]/insights">) => {
  const { id } = await ctx.params;
  const user = await requireApiUser();
  await ownCampaign(id, user.workspaceId);
  return NextResponse.json(await campaignRanking(id));
});

// "Atualizar resultados": busca agora na Meta os números dos anúncios e posts desta campanha.
export const POST = handler(async (request: Request, ctx: RouteContext<"/api/campaigns/[id]/insights">) => {
  const { id } = await ctx.params;
  const user = await requireApiUser();
  await enforceRateLimit(request, "insights-sync", 12, 60 * 60, user.id);
  await ownCampaign(id, user.workspaceId);
  const sync = await syncCampaignInsights(user.workspaceId, id);
  if (!sync.connected) throw new HttpError(409, "errors.metaNotConnected", "META_NOT_CONNECTED");
  return NextResponse.json(await campaignRanking(id));
});
