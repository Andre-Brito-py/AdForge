import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { handler, HttpError, parseBody } from "@/lib/api";
import { requireApiAdmin } from "@/lib/auth";
import { PLATFORMS, type PlatformKey } from "@/lib/catalog";
import { buildShowcaseItem, getShowcase, MAX_SHOWCASE, saveShowcase, type ShowcaseItem } from "@/lib/showcase";

const platformLabel = (key: string | null) => (key && key in PLATFORMS ? PLATFORMS[key as PlatformKey].label : "Instagram");

async function adminWorkspaces(userId: string) {
  const rows = await db.workspaceMember.findMany({ where: { userId }, select: { workspaceId: true } });
  return rows.map((r) => r.workspaceId);
}

/** Vitrine atual + criativos prontos do(s) workspace(s) do próprio admin para escolher. */
export const GET = handler(async () => {
  const admin = await requireApiAdmin();
  const workspaceIds = await adminWorkspaces(admin.id);
  const [showcase, visuals] = await Promise.all([
    getShowcase(),
    db.creative.findMany({
      where: { status: "COMPLETED", type: { in: ["IMAGE", "VIDEO"] }, outputUrl: { not: null }, campaign: { workspaceId: { in: workspaceIds } } },
      orderBy: { createdAt: "desc" },
      take: 40,
      select: {
        id: true, type: true, outputUrl: true, thumbnailUrl: true, aspectRatio: true, variantIndex: true, campaignId: true, createdAt: true,
        campaign: { select: { name: true, platform: true } },
      },
    }),
  ]);
  const copies = await db.creative.findMany({
    where: { type: "COPY", campaignId: { in: [...new Set(visuals.map((v) => v.campaignId))] } },
    select: { campaignId: true, variantIndex: true, headline: true },
  });
  const headline = (v: (typeof visuals)[number]) => copies.find((c) => c.campaignId === v.campaignId && c.variantIndex === v.variantIndex)?.headline || null;
  return NextResponse.json({
    showcase,
    max: MAX_SHOWCASE,
    candidates: visuals.map((v) => ({
      id: v.id,
      type: v.type,
      url: v.outputUrl,
      posterUrl: v.thumbnailUrl,
      aspectRatio: v.aspectRatio,
      campaignName: v.campaign.name,
      platform: platformLabel(v.campaign.platform),
      headline: headline(v),
      createdAt: v.createdAt,
    })),
  });
});

const putSchema = z.object({
  enabled: z.boolean(),
  items: z
    .array(
      z.object({
        creativeId: z.string().min(1).max(60),
        headline: z.string().max(200).optional(),
        caption: z.string().max(1500).optional(),
        hashtags: z.string().max(500).optional(),
      })
    )
    .max(MAX_SHOWCASE),
});

export const PUT = handler(async (request: Request) => {
  const admin = await requireApiAdmin();
  const body = await parseBody(request, putSchema);
  const workspaceIds = await adminWorkspaces(admin.id);
  const previous = await getShowcase();

  const items: ShowcaseItem[] = [];
  for (const it of body.items) {
    // Item que já estava na vitrine: reaproveita as cópias e só atualiza os textos.
    let item = previous.items.find((p) => p.creativeId === it.creativeId);
    if (!item) {
      try {
        item = await buildShowcaseItem(it.creativeId, workspaceIds, platformLabel);
      } catch (error) {
        throw new HttpError(400, (error as Error).message);
      }
    }
    items.push({
      ...item,
      headline: it.headline ?? item.headline,
      caption: it.caption ?? item.caption,
      hashtags: it.hashtags ?? item.hashtags,
    });
  }
  if (body.enabled && items.length === 0) throw new HttpError(400, "Escolha ao menos um criativo para ligar a vitrine");

  const next = { enabled: body.enabled, items };
  await saveShowcase(next, previous);
  return NextResponse.json({ success: true, showcase: next });
});
