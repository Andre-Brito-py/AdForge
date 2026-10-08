import { cookies } from "next/headers";
import { Check, ShieldCheck } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getAppConfig, purchasablePlans } from "@/lib/config";
import { getWorkspaceBalance } from "@/services/credits";
import { PageHeader } from "@/components/app/ui-bits";
import { CheckoutButton } from "@/components/checkout-button";
import { CurrencySwitcher } from "@/components/currency-switcher";
import { CheckoutStatusToast } from "./status-toast";
import { CouponBox } from "./coupon-box";
import { applyCoupon, CouponError, type AppliedCoupon } from "@/lib/coupons";
import { stripeMode } from "@/lib/stripe-sync";
import { isCurrency, refundWindowDays, type Currency } from "@/lib/locale";

export async function generateMetadata() {
  return { title: (await getTranslations("nav"))("billing") };
}

export default async function BillingPage(props: PageProps<"/billing">) {
  const user = await requireUser();
  const t = await getTranslations("billing");
  const tErrors = await getTranslations("errors");
  const rawCoupon = (await props.searchParams).coupon;
  const couponCode = typeof rawCoupon === "string" && rawCoupon.trim() ? rawCoupon.trim().slice(0, 40) : null;
  const format = await getFormatter();
  const [config, balance, payments] = await Promise.all([
    getAppConfig(),
    getWorkspaceBalance(user.workspaceId),
    db.payment.findMany({ where: { workspaceId: user.workspaceId }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);

  const cookieCurrency = (await cookies()).get("CURRENCY")?.value;
  const preferred: Currency = isCurrency(cookieCurrency) ? cookieCurrency : user.locale === "en" ? "USD" : "BRL";
  const priceOf = (p: (typeof config.plans)[number], c: Currency) => (c === "BRL" ? p.price_brl : c === "EUR" ? p.price_eur ?? 0 : p.price_usd);
  const all = purchasablePlans(config.plans);
  // Sem preço em euro configurado, mostramos em dólar (a Stripe cobra no cartão em qualquer país).
  const currency: Currency = all.some((p) => priceOf(p, preferred) > 0) ? preferred : "USD";
  const plans = all.filter((p) => priceOf(p, currency) > 0);
  const available = (["BRL", "USD", "EUR"] as Currency[]).filter((c) => all.some((p) => priceOf(p, c) > 0));
  const money = (v: number, c: string) => format.number(v, { style: "currency", currency: c });
  const en = user.locale === "en";

  // Cupom na URL: calcula o desconto de cada pacote (o checkout valida de novo antes de cobrar).
  const stripeKey = config.secrets.stripeSecretKey;
  const discounts = new Map<string, AppliedCoupon>();
  let couponError: string | null = null;
  if (couponCode) {
    const errors: CouponError["key"][] = [];
    for (const plan of plans) {
      try {
        discounts.set(plan.id, await applyCoupon(couponCode, plan, currency, priceOf(plan, currency), stripeKey ? stripeMode(stripeKey) : null));
      } catch (error) {
        if (!(error instanceof CouponError)) throw error;
        errors.push(error.key);
      }
    }
    // Vale para algum pacote: mostra o desconto neles; não vale para nenhum: explica o motivo.
    if (discounts.size === 0) couponError = tErrors(`coupon.${errors[0] ?? "notFound"}`);
  }
  const appliedCode = discounts.size > 0 ? [...discounts.values()][0].code : null;

  return (
    <>
      <CheckoutStatusToast />
      <PageHeader
        title={t("title")}
        description={t.rich("subtitle", { count: balance, b: (chunks) => <strong className="text-foreground">{chunks}</strong> })}
        actions={available.length > 1 ? <CurrencySwitcher value={currency} options={available} label={t("currency")} /> : undefined}
      />

      {plans.length > 0 && <CouponBox applied={appliedCode} error={couponError} />}

      {plans.length === 0 ? (
        <div className="surface p-8 text-center text-muted-foreground">{t("noPlans")}</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {plans.map((plan) => {
            const fullPrice = priceOf(plan, currency);
            const discount = discounts.get(plan.id);
            const price = discount ? discount.finalPrice : fullPrice;
            const features = (en ? plan.features_en : plan.features_pt).filter((f) => f.trim());
            return (
              <div key={plan.id} className={`surface relative flex flex-col p-6 ${plan.isFeatured ? "border-brand ring-1 ring-brand" : ""}`}>
                {plan.isFeatured && (
                  <span className="absolute -top-3 left-6 rounded-full bg-brand px-3 py-1 text-xs font-semibold text-brand-foreground">{t("popular")}</span>
                )}
                <h3 className="text-lg font-semibold">{plan.name}</h3>
                {(en ? plan.description_en || plan.description : plan.description) && <p className="mt-1 text-sm text-muted-foreground">{en ? plan.description_en || plan.description : plan.description}</p>}
                <p className="mt-5 flex flex-wrap items-baseline gap-x-2 text-3xl font-semibold tracking-tight">
                  {money(price, currency)}
                  {discount && <s className="text-base font-normal text-muted-foreground">{money(fullPrice, currency)}</s>}
                </p>
                {discount && <p className="mt-1 text-sm font-medium text-brand">{t("couponOff", { off: money(discount.discount, currency) })}</p>}
                {appliedCode && !discount && <p className="mt-1 text-sm text-muted-foreground">{appliedCode}: {t("couponNotFor")}</p>}
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("perCredit", { credits: format.number(plan.credits), price: money(price / plan.credits, currency) })}
                </p>
                <ul className="mt-6 flex-1 space-y-2.5 text-sm">
                  {features.map((f) => (
                    <li key={f} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-brand" />{f}</li>
                  ))}
                </ul>
                <div className="mt-6">
                  <CheckoutButton planId={plan.id} label={t("buy", { name: plan.name })} featured={plan.isFeatured} currency={currency} coupon={discount?.code ?? null} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-6 flex items-start gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="h-4 w-4 shrink-0" />
        <span>{currency === "BRL" ? t("secureBR") : t("secureIntl")} {t("refund", { days: refundWindowDays(currency) })}</span>
      </p>

      <section className="mt-12">
        <h2 className="mb-4 text-lg font-semibold tracking-tight">{t("history")}</h2>
        {payments.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noHistory")}</p>
        ) : (
          <div className="surface overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">{t("cols.date")}</th>
                  <th className="px-4 py-3 font-medium">{t("cols.pack")}</th>
                  <th className="px-4 py-3 font-medium">{t("cols.credits")}</th>
                  <th className="px-4 py-3 font-medium">{t("cols.amount")}</th>
                  <th className="px-4 py-3 font-medium">{t("cols.via")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td className="whitespace-nowrap px-4 py-3">{format.dateTime(p.createdAt, "short")}</td>
                    <td className="px-4 py-3">{config.plans.find((x) => x.id === p.planId)?.name || p.planId || "—"}</td>
                    <td className="px-4 py-3 tabular-nums">+{format.number(p.credits)}</td>
                    <td className="px-4 py-3 tabular-nums">{money(p.amount, p.currency)}</td>
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
