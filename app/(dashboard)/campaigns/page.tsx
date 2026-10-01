import Link from "next/link";
import { Plus } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { EmptyState, LinkButton, PageHeader, StatusBadge } from "@/components/app/ui-bits";
import { OBJECTIVES, PLATFORMS, labelFor } from "@/lib/catalog";
import { timeAgo } from "@/lib/format";

export const metadata = { title: "Campanhas" };

export default async function CampaignsPage() {
  const user = await requireUser();
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
        title="Campanhas"
        description="Tudo o que você já gerou, do mais recente para o mais antigo."
        actions={<LinkButton href="/campaigns/new" variant="brand"><Plus className="h-4 w-4" /> Nova campanha</LinkButton>}
      />
      {campaigns.length === 0 ? (
        <EmptyState
          title="Nenhuma campanha ainda"
          description="Escolha um produto, defina o objetivo e eu gero estratégia, textos e criativos para você."
          action={<LinkButton href="/campaigns/new" variant="brand">Criar primeira campanha</LinkButton>}
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
                      {labelFor(OBJECTIVES, c.objective)} · {labelFor(PLATFORMS, c.platform)} · {c._count.creatives} criativos · {timeAgo(c.createdAt)}
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
