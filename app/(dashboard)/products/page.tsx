import Link from "next/link";
import { Plus } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { EmptyState, LinkButton, PageHeader } from "@/components/app/ui-bits";
import { timeAgo } from "@/lib/format";

export const metadata = { title: "Produtos" };

export default async function ProductsPage() {
  const user = await requireUser();
  const products = await db.product.findMany({
    where: { workspaceId: user.workspaceId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { campaigns: true } } },
  });

  return (
    <>
      <PageHeader
        title="Produtos"
        description="Os produtos que você quer anunciar. Cada um pode ter várias campanhas."
        actions={
          <LinkButton href="/products/new" variant="brand">
            <Plus className="h-4 w-4" /> Adicionar produto
          </LinkButton>
        }
      />

      {products.length === 0 ? (
        <EmptyState
          title="Nenhum produto ainda"
          description="Para criar anúncios, a IA precisa conhecer o seu produto. Envie uma foto nítida e bem iluminada."
          action={<LinkButton href="/products/new" variant="brand">Adicionar meu primeiro produto</LinkButton>}
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
                  <p className="mt-0.5 text-xs text-muted-foreground">Adicionado {timeAgo(p.createdAt)}</p>
                </div>
                <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-medium tabular-nums">
                  {p._count.campaigns} {p._count.campaigns === 1 ? "campanha" : "campanhas"}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
