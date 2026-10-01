import { cookies } from "next/headers";
import { Check, ShieldCheck } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getAppConfig, purchasablePlans } from "@/lib/config";
import { getWorkspaceBalance } from "@/services/credits";
import { PageHeader } from "@/components/app/ui-bits";
import { CheckoutButton } from "@/components/checkout-button";
import { CheckoutStatusToast } from "./status-toast";
import { formatDateTime, formatMoney } from "@/lib/format";

export const metadata = { title: "Comprar créditos" };

type Currency = "BRL" | "USD" | "EUR";

export default async function BillingPage() {
  const user = await requireUser();
  const [config, balance, payments] = await Promise.all([
    getAppConfig(),
    getWorkspaceBalance(user.workspaceId),
    db.payment.findMany({ where: { workspaceId: user.workspaceId }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);

  const cookieCurrency = (await cookies()).get("CURRENCY")?.value;
  const currency: Currency = cookieCurrency === "USD" || cookieCurrency === "EUR" ? cookieCurrency : "BRL";
  const priceOf = (p: (typeof config.plans)[number]) => (currency === "BRL" ? p.price_brl : currency === "EUR" ? p.price_eur ?? 0 : p.price_usd);
  const plans = purchasablePlans(config.plans).filter((p) => priceOf(p) > 0);

  return (
    <>
      <CheckoutStatusToast />
      <PageHeader
        title="Comprar créditos"
        description={<>Você tem <strong className="text-foreground">{balance} créditos</strong>. Pacotes avulsos, sem assinatura e sem renovação automática. Créditos não expiram.</>}
      />

      {plans.length === 0 ? (
        <div className="surface p-8 text-center text-muted-foreground">Nenhum pacote disponível nesta moeda no momento.</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {plans.map((plan) => {
            const price = priceOf(plan);
            const features = plan.features_pt.filter((f) => f.trim());
            return (
              <div key={plan.id} className={`surface relative flex flex-col p-6 ${plan.isFeatured ? "border-brand ring-1 ring-brand" : ""}`}>
                {plan.isFeatured && (
                  <span className="absolute -top-3 left-6 rounded-full bg-brand px-3 py-1 text-xs font-semibold text-brand-foreground">Mais escolhido</span>
                )}
                <h3 className="text-lg font-semibold">{plan.name}</h3>
                {plan.description && <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>}
                <p className="mt-5 text-3xl font-semibold tracking-tight">{formatMoney(price, currency)}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {plan.credits.toLocaleString("pt-BR")} créditos · {formatMoney(price / plan.credits, currency)} por crédito
                </p>
                <ul className="mt-6 flex-1 space-y-2.5 text-sm">
                  {features.map((f) => (
                    <li key={f} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-brand" />{f}</li>
                  ))}
                </ul>
                <div className="mt-6">
                  <CheckoutButton planId={plan.id} label={`Comprar ${plan.name}`} featured={plan.isFeatured} currency={currency} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="h-4 w-4" />
        Pagamento processado por {currency === "BRL" ? "Mercado Pago (Pix, cartão e boleto) ou Stripe" : "Stripe"}. Não armazenamos dados de cartão.
        Direito de arrependimento em até 7 dias para créditos não utilizados.
      </p>

      <section className="mt-12">
        <h2 className="mb-4 text-lg font-semibold tracking-tight">Histórico de compras</h2>
        {payments.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma compra ainda.</p>
        ) : (
          <div className="surface overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border text-left text-xs text-muted-foreground">
                <tr><th className="px-4 py-3 font-medium">Data</th><th className="px-4 py-3 font-medium">Pacote</th><th className="px-4 py-3 font-medium">Créditos</th><th className="px-4 py-3 font-medium">Valor</th><th className="px-4 py-3 font-medium">Via</th></tr>
              </thead>
              <tbody className="divide-y divide-border">
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td className="whitespace-nowrap px-4 py-3">{formatDateTime(p.createdAt)}</td>
                    <td className="px-4 py-3">{config.plans.find((x) => x.id === p.planId)?.name || p.planId || "—"}</td>
                    <td className="px-4 py-3 tabular-nums">+{p.credits}</td>
                    <td className="px-4 py-3 tabular-nums">{formatMoney(p.amount, p.currency)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.provider === "STRIPE" ? "Stripe" : "Mercado Pago"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
