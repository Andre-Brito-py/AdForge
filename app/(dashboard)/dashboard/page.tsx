import Link from "next/link";
import { ArrowRight, Coins, Image as ImageIcon, Megaphone, Package, Plus } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getWorkspaceBalance } from "@/services/credits";
import { platformLabel } from "@/lib/catalog-i18n";
import { EmptyState, LinkButton, PageHeader, StatusBadge } from "@/components/app/ui-bits";

export async function generateMetadata() {
  return { title: (await getTranslations("nav"))("dashboard") };
}

export default async function DashboardPage() {
  const user = await requireUser();
  const t = await getTranslations("dashboard");
  const tc = await getTranslations("catalog");
  const format = await getFormatter();
  const now = new Date();
  const wId = user.workspaceId;

  const [balance, productCount, campaignCount, creativeCount, recent] = await Promise.all([
    getWorkspaceBalance(wId),
    db.product.count({ where: { workspaceId: wId } }),
    db.campaign.count({ where: { workspaceId: wId } }),
    db.creative.count({ where: { campaign: { workspaceId: wId }, type: { in: ["IMAGE", "VIDEO"] }, status: "COMPLETED" } }),
    db.campaign.findMany({
      where: { workspaceId: wId },
      orderBy: { createdAt: "desc" },
      take: 6,
      include: {
        product: { select: { name: true, originalImageUrl: true } },
        creatives: { where: { type: { in: ["IMAGE", "VIDEO"] }, status: "COMPLETED" }, take: 1, select: { outputUrl: true, type: true } },
      },
    }),
  ]);

  const firstName = (user.name || "").split(" ")[0];
  const stats = [
    { label: t("stats.credits"), value: balance, icon: Coins, href: "/credits" },
    { label: t("stats.products"), value: productCount, icon: Package, href: "/products" },
    { label: t("stats.campaigns"), value: campaignCount, icon: Megaphone, href: "/campaigns" },
    { label: t("stats.creatives"), value: creativeCount, icon: ImageIcon, href: "/campaigns" },
  ];

  return (
    <>
      <PageHeader
        title={firstName ? t("hello", { name: firstName }) : t("title")}
        description={t("subtitle")}
        actions={
          <LinkButton href="/campaigns/new" variant="brand">
            <Plus className="h-4 w-4" /> {(await getTranslations("nav"))("newCampaign")}
          </LinkButton>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="surface group p-5 transition hover:border-foreground/20">
            <s.icon className="h-4 w-4 text-muted-foreground transition group-hover:text-brand" />
            <p className="mt-4 text-2xl font-semibold tabular-nums tracking-tight sm:text-3xl">{format.number(s.value)}</p>
            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">{s.label}</p>
          </Link>
        ))}
      </div>

      <section className="mt-10">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">{t("recent")}</h2>
          {recent.length > 0 && (
            <Link href="/campaigns" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
              {t("seeAll")} <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>

        {recent.length === 0 ? (
          productCount === 0 ? (
            <EmptyState
              title={t("emptyFirstTitle")}
              description={t("emptyFirstText")}
              action={<LinkButton href="/products/new" variant="brand">{t("emptyFirstCta")}</LinkButton>}
            />
          ) : (
            <EmptyState
              title={t("emptyTitle")}
              description={t("emptyText")}
              action={<LinkButton href="/campaigns/new" variant="brand">{t("emptyCta")}</LinkButton>}
            />
          )
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recent.map((c) => {
              const cover = c.creatives[0];
              return (
                <Link key={c.id} href={c.status === "GENERATING" ? `/campaigns/${c.id}/generating` : `/campaigns/${c.id}`} className="surface group overflow-hidden transition hover:border-foreground/20">
                  <div className="relative aspect-[4/3] bg-muted">
                    {cover?.type === "VIDEO" && cover.outputUrl ? (
                      <video src={cover.outputUrl} muted playsInline preload="metadata" className="h-full w-full object-cover" />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={cover?.outputUrl || c.product.originalImageUrl} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
                    )}
                    <div className="absolute left-3 top-3">
                      <StatusBadge status={c.status} />
                    </div>
                  </div>
                  <div className="p-4">
                    <p className="truncate font-medium">{c.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {platformLabel(tc, c.platform)} · {format.relativeTime(c.createdAt, now)}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
