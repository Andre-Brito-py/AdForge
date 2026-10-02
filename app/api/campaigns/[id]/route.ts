import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handler, HttpError } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { advanceCampaign } from "@/lib/generation";

export const maxDuration = 300;

// Status da campanha. Enquanto estiver gerando, cada consulta também avança o pipeline
// (busca vídeos prontos na fal.ai e reinicia jobs parados).
export const GET = handler(async (_request: Request, ctx: RouteContext<"/api/campaigns/[id]">) => {
  const { id } = await ctx.params;
  const user = await requireApiUser();

  const owned = await db.campaign.findFirst({ where: { id, workspaceId: user.workspaceId }, select: { status: true } });
  if (!owned) throw new HttpError(404, "errors.campaignNotFound");

  if (owned.status === "GENERATING") await advanceCampaign(id);

  const campaign = await db.campaign.findUnique({
    where: { id },
    select: {
      id: true, name: true, status: true, variations: true, platform: true, createdAt: true,
      creatives: {
        orderBy: [{ variantIndex: "asc" }, { createdAt: "asc" }],
        select: { id: true, type: true, status: true, variantIndex: true, outputUrl: true, audioUrl: true, headline: true, text: true, cta: true, aspectRatio: true },
      },
    },
  });
  return NextResponse.json(campaign);
});

export const DELETE = handler(async (_request: Request, ctx: RouteContext<"/api/campaigns/[id]">) => {
  const { id } = await ctx.params;
  const user = await requireApiUser();
  const campaign = await db.campaign.findFirst({ where: { id, workspaceId: user.workspaceId } });
  if (!campaign) throw new HttpError(404, "errors.campaignNotFound");
  if (campaign.status === "GENERATING") throw new HttpError(409, "errors.waitGenerationDelete");
  await db.campaign.delete({ where: { id } });
  return NextResponse.json({ success: true });
});
