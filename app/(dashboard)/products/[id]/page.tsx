import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { EmptyState, LinkButton, PageHeader, StatusBadge } from "@/components/app/ui-bits";
import { PLATFORMS, labelFor } from "@/lib/catalog";
import { formatMoney, timeAgo } from "@/lib/format";
import { DeleteButton } from "@/components/app/delete-button";

export default async function ProductDetailPage(props: PageProps<"/products/[id]">) {
  const { id } = await props.params;
  const user = await requireUser();

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
    ["Categoria", product.category],
    ["Marca", product.brandName],
    ["Público-alvo", product.targetAudience],
    ["Preço", product.price != null ? formatMoney(product.price) : null],
  ].filter(([, v]) => v) as [string, string][];

  return (
    <>
      <PageHeader
        back={{ href: "/products", label: "Produtos" }}
        title={product.name}
        actions={
          <>
            <DeleteButton endpoint={`/api/products/${product.id}`} redirectTo="/products" label="Excluir" confirmText="Excluir este produto e todas as campanhas dele? Esta ação não pode ser desfeita." />
            <LinkButton href={`/campaigns/new?productId=${product.id}`} variant="brand">
              <Plus className="h-4 w-4" /> Nova campanha
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
            </div>
          )}
        </div>

        <section>
          <h2 className="mb-4 text-lg font-semibold tracking-tight">Campanhas deste produto</h2>
          {product.campaigns.length === 0 ? (
            <EmptyState
              title="Nenhuma campanha ainda"
              description="Gere a primeira campanha para este produto em poucos cliques."
              action={<LinkButton href={`/campaigns/new?productId=${product.id}`} variant="brand">Criar campanha</LinkButton>}
            />
          ) : (
            <ul className="surface divide-y divide-border">
              {product.campaigns.map((c) => (
                <li key={c.id}>
                  <Link href={c.status === "GENERATING" ? `/campaigns/${c.id}/generating` : `/campaigns/${c.id}`} className="flex items-center justify-between gap-4 p-4 transition hover:bg-muted/50">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{c.name}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {labelFor(PLATFORMS, c.platform)} · {c._count.creatives} criativos · {timeAgo(c.createdAt)}
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
