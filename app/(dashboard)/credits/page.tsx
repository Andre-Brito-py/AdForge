import { ArrowDownLeft, ArrowUpRight, Plus } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getWorkspaceBalance } from "@/services/credits";
import { getAppConfig } from "@/lib/config";
import { LinkButton, PageHeader } from "@/components/app/ui-bits";
import { formatDateTime } from "@/lib/format";

export const metadata = { title: "Créditos" };

const TYPE_LABEL: Record<string, string> = {
  CONSUME: "Uso",
  REFUND: "Estorno",
  PURCHASE: "Compra",
  BONUS: "Bônus",
  ADJUSTMENT: "Ajuste",
};

export default async function CreditsPage() {
  const user = await requireUser();
  const [balance, transactions, config] = await Promise.all([
    getWorkspaceBalance(user.workspaceId),
    db.creditTransaction.findMany({ where: { workspaceId: user.workspaceId }, orderBy: { createdAt: "desc" }, take: 100 }),
    getAppConfig(),
  ]);

  return (
    <>
      <PageHeader
        title="Créditos"
        description="Seu saldo e todas as movimentações."
        actions={<LinkButton href="/billing" variant="brand"><Plus className="h-4 w-4" /> Comprar créditos</LinkButton>}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="surface p-6">
          <p className="text-sm text-muted-foreground">Saldo disponível</p>
          <p className="mt-2 text-4xl font-semibold tabular-nums tracking-tight">{balance.toLocaleString("pt-BR")}</p>
          <div className="mt-6 space-y-2 border-t border-border pt-4 text-sm">
            <p className="font-medium">Quanto custa</p>
            <p className="flex justify-between text-muted-foreground"><span>Imagem</span><span>{config.costs.image} créditos</span></p>
            <p className="flex justify-between text-muted-foreground"><span>Vídeo + locução</span><span>{config.costs.video} créditos</span></p>
            <p className="flex justify-between text-muted-foreground"><span>Qualidade Premium</span><span>×{config.costs.premiumMultiplier}</span></p>
            <p className="text-xs text-muted-foreground">Estratégia e textos estão inclusos. Falhas são estornadas automaticamente.</p>
          </div>
        </div>

        <div className="surface overflow-hidden lg:col-span-2">
          <h2 className="border-b border-border px-5 py-4 font-semibold">Extrato</h2>
          {transactions.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">Nenhuma movimentação ainda.</p>
          ) : (
            <ul className="max-h-[560px] divide-y divide-border overflow-y-auto">
              {transactions.map((tx) => (
                <li key={tx.id} className="flex items-center gap-3 px-5 py-3.5">
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${tx.amount > 0 ? "bg-success/12 text-success" : "bg-muted text-muted-foreground"}`}>
                    {tx.amount > 0 ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{tx.description || TYPE_LABEL[tx.type] || tx.type}</p>
                    <p className="text-xs text-muted-foreground">{TYPE_LABEL[tx.type] || tx.type} · {formatDateTime(tx.createdAt)}</p>
                  </div>
                  <span className={`font-semibold tabular-nums ${tx.amount > 0 ? "text-success" : ""}`}>
                    {tx.amount > 0 ? "+" : ""}{tx.amount}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
