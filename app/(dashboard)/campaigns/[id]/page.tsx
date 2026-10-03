import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getAppConfig } from "@/lib/config";
import { PLATFORMS, costPerVariation, type PlatformKey, type QualityKey } from "@/lib/catalog";
import { getMetaApp, getMetaConnection } from "@/lib/meta/connection";
import CreativeGalleryClient from "./CreativeGalleryClient";

export default async function CampaignPage(props: PageProps<"/campaigns/[id]">) {
  const { id } = await props.params;
  const user = await requireUser();

  const campaign = await db.campaign.findFirst({
    where: { id, workspaceId: user.workspaceId },
    include: {
      product: { select: { id: true, name: true, originalImageUrl: true } },
      creatives: {
        orderBy: [{ variantIndex: "asc" }, { createdAt: "asc" }],
        select: { id: true, type: true, status: true, variantIndex: true, outputUrl: true, audioUrl: true, headline: true, text: true, cta: true, aspectRatio: true, creditsUsed: true },
      },
    },
  });
  if (!campaign) notFound();
  if (campaign.status === "GENERATING" && !campaign.creatives.some((c) => c.status === "COMPLETED" && c.type !== "COPY")) {
    redirect(`/campaigns/${id}/generating`);
  }

  const config = await getAppConfig();
  const platform = campaign.platform && campaign.platform in PLATFORMS ? (campaign.platform as PlatformKey) : null;
  const unitCost = platform ? costPerVariation(config.costs, platform, (campaign.quality as QualityKey) || "standard", campaign.videoDuration, campaign.mediaType) : null;

  const [metaApp, metaConn, publications] = await Promise.all([
    getMetaApp(),
    getMetaConnection(user.workspaceId),
    db.publication.findMany({
      where: { workspaceId: user.workspaceId, creative: { campaignId: id } },
      orderBy: { createdAt: "desc" },
      select: { id: true, creativeId: true, target: true, accountName: true, status: true, permalink: true, error: true, createdAt: true },
    }),
  ]);
  // Só dados públicos dos destinos (nada de token) vão para o navegador.
  const publishing = {
    available: !!metaApp,
    connected: !!metaConn && metaConn.status === "ACTIVE",
    expired: !!metaConn && metaConn.status !== "ACTIVE",
    instagram: (metaConn?.assets || []).filter((a) => a.instagram).map((a) => ({ id: a.instagram!.id, name: `@${a.instagram!.username || a.instagram!.id}` })),
    pages: (metaConn?.assets || []).map((a) => ({ id: a.pageId, name: a.pageName })),
  };

  let strategy: { analysis?: string; hooks?: string[] } | null = null;
  try { strategy = campaign.strategyJson ? JSON.parse(campaign.strategyJson) : null; } catch { strategy = null; }

  return (
    <CreativeGalleryClient
      campaign={{
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        createdAt: campaign.createdAt.toISOString(),
        objective: campaign.objective,
        platform: campaign.platform,
        style: campaign.style,
        quality: campaign.quality,
        language: campaign.language,
        product: campaign.product,
        creatives: campaign.creatives,
      }}
      strategy={strategy ? { analysis: strategy.analysis || "", hooks: strategy.hooks || [] } : null}
      unitCost={unitCost}
      emailVerified={!!user.emailVerified}
      publishing={publishing}
      initialPublications={publications.map((p) => ({ ...p, createdAt: p.createdAt.toISOString() }))}
    />
  );
}
