import Link from "next/link";
import { Plus } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { EmptyState, LinkButton, PageHeader } from "@/components/app/ui-bits";

export async function generateMetadata() {
  return { title: (await getTranslations("nav"))("products") };
}

export default async function ProductsPage() {
  const user = await requireUser();
  const t = await getTranslations("products");
  const tt = await getTranslations("time");
  const format = await getFormatter();
  const now = new Date();
  const products = await db.product.findMany({
    where: { workspaceId: user.workspaceId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { campaigns: true } } },
  });

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          <LinkButton href="/products/new" variant="brand">
            <Plus className="h-4 w-4" /> {t("add")}
          </LinkButton>
        }
      />

      {products.length === 0 ? (
        <EmptyState
          title={t("emptyTitle")}
          description={t("emptyText")}
          action={<LinkButton href="/products/new" variant="brand">{t("emptyCta")}</LinkButton>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => (
            <Link key={p.id} href={`/products/${p.id}`} className="surface group overflow-hidden transition hover:border-foreground/20">
              <div className="relative aspect-[4/3] overflow-hidden bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.originalImageUrl} alt={p.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
                {p.category && (
                  <span className="absolute left-3 top-3 rounded-full bg-background/90 px-2.5 py-1 text-xs font-medium backdrop-blur">{p.category}</span>
                )}
              </div>
              <div className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="truncate font-medium">{p.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{tt("added", { time: format.relativeTime(p.createdAt, now) })}</p>
                </div>
                <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-medium tabular-nums">
                  {t("campaignsCount", { count: p._count.campaigns })}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
