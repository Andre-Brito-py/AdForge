import Link from "next/link";
import { Plus } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { EmptyState, LinkButton, PageHeader, StatusBadge } from "@/components/app/ui-bits";
import { objectiveLabel, platformLabel } from "@/lib/catalog-i18n";

export async function generateMetadata() {
  return { title: (await getTranslations("nav"))("campaigns") };
}

export default async function CampaignsPage() {
  const user = await requireUser();
  const t = await getTranslations("campaigns");
  const tcat = await getTranslations("catalog");
  const format = await getFormatter();
  const now = new Date();
  const campaigns = await db.campaign.findMany({
    where: { workspaceId: user.workspaceId },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      product: { select: { name: true, originalImageUrl: true } },
      _count: { select: { creatives: { where: { type: { in: ["IMAGE", "VIDEO"] }, status: "COMPLETED" } } } },
    },
  });

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={<LinkButton href="/campaigns/new" variant="brand"><Plus className="h-4 w-4" /> {t("new")}</LinkButton>}
      />
      {campaigns.length === 0 ? (
        <EmptyState
          title={t("emptyTitle")}
          description={t("emptyText")}
          action={<LinkButton href="/campaigns/new" variant="brand">{t("emptyCta")}</LinkButton>}
        />
      ) : (
        <div className="surface overflow-hidden">
          <ul className="divide-y divide-border">
            {campaigns.map((c) => (
              <li key={c.id}>
                <Link href={c.status === "GENERATING" ? `/campaigns/${c.id}/generating` : `/campaigns/${c.id}`} className="flex items-center gap-4 p-4 transition hover:bg-muted/50">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={c.product.originalImageUrl} alt="" className="h-12 w-12 shrink-0 rounded-lg bg-muted object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{c.name}</p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {objectiveLabel(tcat, c.objective)} · {platformLabel(tcat, c.platform)} · {c.language} · {t("creatives", { count: c._count.creatives })} · {format.relativeTime(c.createdAt, now)}
                    </p>
                  </div>
                  <StatusBadge status={c.status} />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
