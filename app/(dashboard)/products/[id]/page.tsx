import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, Plus, Star } from "lucide-react";
import { parseProductReviews } from "@/lib/validation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { EmptyState, LinkButton, PageHeader, StatusBadge } from "@/components/app/ui-bits";
import { getFormatter, getTranslations } from "next-intl/server";
import { platformLabel } from "@/lib/catalog-i18n";
import { DeleteButton } from "@/components/app/delete-button";

export default async function ProductDetailPage(props: PageProps<"/products/[id]">) {
  const { id } = await props.params;
  const user = await requireUser();
  const t = await getTranslations("products.detail");
  const tn = await getTranslations("nav");
  const tcat = await getTranslations("catalog");
  const tcom = await getTranslations("common");
  const format = await getFormatter();
  const now = new Date();

  const product = await db.product.findFirst({
    where: { id, workspaceId: user.workspaceId },
    include: {
      campaigns: {
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { creatives: { where: { type: { in: ["IMAGE", "VIDEO"] }, status: "COMPLETED" } } } } },
      },
    },
  });
  if (!product) notFound();

  const details = [
    [t("category"), product.category],
    [t("brand"), product.brandName],
    [t("audience"), product.targetAudience],
    [t("price"), product.price != null ? format.number(product.price, { style: "currency", currency: product.currency || "BRL" }) : null],
  ].filter(([, v]) => v) as [string, string][];
  const reviews = parseProductReviews(product.reviewsJson);

  return (
    <>
      <PageHeader
        back={{ href: "/products", label: tn("products") }}
        title={product.name}
        actions={
          <>
            <DeleteButton endpoint={`/api/products/${product.id}`} redirectTo="/products" label={tcom("delete")} confirmText={t("deleteConfirm")} />
            <LinkButton href={`/campaigns/new?productId=${product.id}`} variant="brand">
              <Plus className="h-4 w-4" /> {tn("newCampaign")}
            </LinkButton>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <div className="space-y-4">
          <div className="surface overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={product.originalImageUrl} alt={product.name} className="aspect-square w-full object-contain bg-muted" />
          </div>
          {(product.description || details.length > 0) && (
            <div className="surface space-y-4 p-5">
              {product.description && <p className="whitespace-pre-line text-sm text-muted-foreground">{product.description}</p>}
              {details.length > 0 && (
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  {details.map(([k, v]) => (
                    <div key={k}>
                      <dt className="text-xs text-muted-foreground">{k}</dt>
                      <dd className="font-medium">{v}</dd>
                    </div>
                  ))}
                </dl>
              )}
              {product.sourceUrl && (
                <a href={product.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-brand hover:underline">
                  <ExternalLink className="h-3 w-3" /> {t("source")}
                </a>
              )}
            </div>
          )}
          {reviews && (
            <div className="surface space-y-3 p-5 text-sm">
              <p className="flex flex-wrap items-center gap-2 font-medium">
                {t("reviews")}
                {reviews.rating && (
                  <span className="inline-flex items-center gap-1 font-normal text-muted-foreground">
                    <Star className="h-3.5 w-3.5 fill-current text-warning" /> {t("rating", { value: reviews.rating.value, count: reviews.rating.count })}
                  </span>
                )}
              </p>
              <p className="text-xs text-muted-foreground">{t("reviewsHint")}</p>
              {reviews.items.length > 0 && (
                <ul className="space-y-2">
                  {reviews.items.slice(0, 5).map((r, i) => (
                    <li key={i} className="text-muted-foreground">“{r.text}”{r.rating !== null && <span className="ml-1 text-xs">({r.rating}/5)</span>}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <section>
          <h2 className="mb-4 text-lg font-semibold tracking-tight">{t("campaigns")}</h2>
          {product.campaigns.length === 0 ? (
            <EmptyState
              title={t("emptyTitle")}
              description={t("emptyText")}
              action={<LinkButton href={`/campaigns/new?productId=${product.id}`} variant="brand">{(await getTranslations("dashboard"))("emptyCta")}</LinkButton>}
            />
          ) : (
            <ul className="surface divide-y divide-border">
              {product.campaigns.map((c) => (
                <li key={c.id}>
                  <Link href={c.status === "GENERATING" ? `/campaigns/${c.id}/generating` : `/campaigns/${c.id}`} className="flex items-center justify-between gap-4 p-4 transition hover:bg-muted/50">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{c.name}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {platformLabel(tcat, c.platform)} · {t("creatives", { count: c._count.creatives })} · {format.relativeTime(c.createdAt, now)}
                      </p>
                    </div>
                    <StatusBadge status={c.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
