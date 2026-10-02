import { ArrowDownLeft, ArrowUpRight, Plus } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getWorkspaceBalance } from "@/services/credits";
import { getAppConfig } from "@/lib/config";
import { LinkButton, PageHeader } from "@/components/app/ui-bits";

export async function generateMetadata() {
  return { title: (await getTranslations("nav"))("credits") };
}

export default async function CreditsPage() {
  const user = await requireUser();
  const t = await getTranslations("credits");
  const tc = await getTranslations("common");
  const format = await getFormatter();
  const [balance, transactions, config] = await Promise.all([
    getWorkspaceBalance(user.workspaceId),
    db.creditTransaction.findMany({ where: { workspaceId: user.workspaceId }, orderBy: { createdAt: "desc" }, take: 100 }),
    getAppConfig(),
  ]);
  const typeLabel = (type: string) => (t.has(`types.${type}`) ? t(`types.${type}`) : type);

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={<LinkButton href="/billing" variant="brand"><Plus className="h-4 w-4" /> {t("buy")}</LinkButton>}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="surface p-6">
          <p className="text-sm text-muted-foreground">{t("available")}</p>
          <p className="mt-2 text-4xl font-semibold tabular-nums tracking-tight">{format.number(balance)}</p>
          <div className="mt-6 space-y-2 border-t border-border pt-4 text-sm">
            <p className="font-medium">{t("pricing")}</p>
            <p className="flex justify-between text-muted-foreground"><span>{t("image")}</span><span>{tc("credits", { count: config.costs.image })}</span></p>
            <p className="flex justify-between text-muted-foreground"><span>{t("video")}</span><span>{tc("credits", { count: config.costs.video })}</span></p>
            <p className="flex justify-between text-muted-foreground"><span>{t("premium")}</span><span>×{config.costs.premiumMultiplier}</span></p>
            <p className="text-xs text-muted-foreground">{t("pricingNote")}</p>
          </div>
        </div>

        <div className="surface overflow-hidden lg:col-span-2">
          <h2 className="border-b border-border px-5 py-4 font-semibold">{t("statement")}</h2>
          {transactions.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">{t("empty")}</p>
          ) : (
            <ul className="max-h-[560px] divide-y divide-border overflow-y-auto">
              {transactions.map((tx) => (
                <li key={tx.id} className="flex items-center gap-3 px-5 py-3.5">
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${tx.amount > 0 ? "bg-success/12 text-success" : "bg-muted text-muted-foreground"}`}>
                    {tx.amount > 0 ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{tx.description || typeLabel(tx.type)}</p>
                    <p className="text-xs text-muted-foreground">{typeLabel(tx.type)} · {format.dateTime(tx.createdAt, "short")}</p>
                  </div>
                  <span className={`font-semibold tabular-nums ${tx.amount > 0 ? "text-success" : ""}`}>
                    {tx.amount > 0 ? "+" : ""}{format.number(tx.amount)}
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
