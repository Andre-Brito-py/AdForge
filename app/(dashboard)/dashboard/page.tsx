import Link from "next/link";
import { ArrowRight, Coins, Image as ImageIcon, Megaphone, Package, Plus } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getWorkspaceBalance } from "@/services/credits";
import { PLATFORMS, labelFor } from "@/lib/catalog";
import { EmptyState, LinkButton, PageHeader, StatusBadge } from "@/components/app/ui-bits";
import { timeAgo } from "@/lib/format";

export const metadata = { title: "Painel" };

export default async function DashboardPage() {
  const user = await requireUser();
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
    { label: "Créditos disponíveis", value: balance, icon: Coins, href: "/credits" },
    { label: "Produtos", value: productCount, icon: Package, href: "/products" },
    { label: "Campanhas", value: campaignCount, icon: Megaphone, href: "/campaigns" },
    { label: "Criativos gerados", value: creativeCount, icon: ImageIcon, href: "/campaigns" },
  ];

  return (
    <>
      <PageHeader
        title={firstName ? `Olá, ${firstName}` : "Seu painel"}
        description="Crie anúncios a partir das fotos dos seus produtos."
        actions={
          <LinkButton href="/campaigns/new" variant="brand">
            <Plus className="h-4 w-4" /> Nova campanha
          </LinkButton>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="surface group p-5 transition hover:border-foreground/20">
            <s.icon className="h-4 w-4 text-muted-foreground transition group-hover:text-brand" />
            <p className="mt-4 text-2xl font-semibold tabular-nums tracking-tight sm:text-3xl">{s.value.toLocaleString("pt-BR")}</p>
            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">{s.label}</p>
          </Link>
        ))}
      </div>

      <section className="mt-10">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Campanhas recentes</h2>
          {recent.length > 0 && (
            <Link href="/campaigns" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
              Ver todas <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>

        {recent.length === 0 ? (
          productCount === 0 ? (
            <EmptyState
              title="Vamos criar seu primeiro anúncio"
              description="Comece cadastrando um produto com uma boa foto. Depois é só escolher o objetivo e eu cuido do resto."
              action={<LinkButton href="/products/new" variant="brand">Cadastrar produto</LinkButton>}
            />
          ) : (
            <EmptyState
              title="Nenhuma campanha ainda"
              description="Você já tem produtos cadastrados. Que tal gerar a primeira campanha?"
              action={<LinkButton href="/campaigns/new" variant="brand">Criar campanha</LinkButton>}
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
                      {labelFor(PLATFORMS, c.platform)} · {timeAgo(c.createdAt)}
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
