import type Stripe from "stripe";
import { db } from "./db";
import { recordPurchase } from "./payments";

/**
 * Assinaturas mensais (só pela Stripe). A cada fatura paga (inclusive a primeira), o workspace recebe
 * os créditos do plano. Os créditos não expiram: o que sobrar continua no saldo.
 * O cancelamento (com a taxa configurável no admin) é feito no Vysify; cartão e faturas ficam no Portal da Stripe.
 */

/** Situações em que a assinatura ainda vale (o cliente não pode assinar outra por cima). */
export const LIVE_STATUSES = ["active", "trialing", "past_due", "incomplete", "unpaid"];

export async function activeSubscription(workspaceId: string) {
  return db.subscription.findFirst({
    where: { workspaceId, status: { in: LIVE_STATUSES } },
    orderBy: { createdAt: "desc" },
  });
}

/** Cliente da Stripe do workspace (criado na primeira compra/assinatura e reaproveitado). */
export async function getOrCreateCustomer(stripe: Stripe, workspace: { id: string; stripeCustomerId: string | null }, user: { id: string; email: string; name: string | null }) {
  if (workspace.stripeCustomerId) {
    try {
      const existing = await stripe.customers.retrieve(workspace.stripeCustomerId);
      if (!("deleted" in existing && existing.deleted)) return workspace.stripeCustomerId;
    } catch (error) {
      // Cliente de outra conta (chave de teste trocada pela de produção): cria de novo.
      if ((error as { code?: string }).code !== "resource_missing") throw error;
    }
  }
  const customer = await stripe.customers.create({
    email: user.email,
    name: user.name || undefined,
    metadata: { workspaceId: workspace.id, userId: user.id },
  });
  await db.workspace.update({ where: { id: workspace.id }, data: { stripeCustomerId: customer.id } });
  return customer.id;
}

function periodEnd(sub: Stripe.Subscription): Date | null {
  const end = sub.items?.data?.[0]?.current_period_end;
  return end ? new Date(end * 1000) : null;
}

/** Cria/atualiza o registro local a partir da assinatura da Stripe (metadata gravada no checkout). */
export async function syncSubscription(sub: Stripe.Subscription) {
  const m = sub.metadata || {};
  const workspaceId = m.workspaceId;
  if (!workspaceId) return null;
  const price = sub.items?.data?.[0]?.price;
  const data = {
    workspaceId,
    userId: m.userId || null,
    stripeCustomerId: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
    planId: m.planId || "",
    planName: m.planName || m.planId || "Assinatura",
    creditsPerPeriod: parseInt(m.credits || "0", 10) || 0,
    status: sub.status,
    currency: (price?.currency || sub.currency || "usd").toUpperCase(),
    amount: (price?.unit_amount || 0) / 100,
    currentPeriodEnd: periodEnd(sub),
    cancelAtPeriodEnd: !!sub.cancel_at_period_end,
    ...(sub.status === "canceled" ? { canceledAt: sub.ended_at ? new Date(sub.ended_at * 1000) : new Date() } : {}),
  };
  return db.subscription.upsert({
    where: { stripeSubscriptionId: sub.id },
    update: data,
    create: { stripeSubscriptionId: sub.id, ...data },
  });
}

// ---------------- Cancelamento ----------------

/** Direito de arrependimento (CDC art. 49): nos primeiros 7 dias da contratação, nunca há taxa. */
export const WITHDRAWAL_DAYS = 7;

export interface CancellationQuote {
  fee: number;
  currency: string;
  percent: number;
  /** "withdrawal" = dentro dos 7 dias; "none" = taxa configurada em 0%. */
  waived: "withdrawal" | "none" | null;
  accessUntil: Date | null;
  /** Pagamento pendente: cancela na hora (para de tentar cobrar o cartão). */
  immediate: boolean;
}

export function cancellationQuote(sub: { amount: number; currency: string; createdAt: Date; currentPeriodEnd: Date | null; status: string }, percent: number, now = new Date()): CancellationQuote {
  const immediate = ["past_due", "unpaid", "incomplete"].includes(sub.status);
  const withinWithdrawal = now.getTime() - sub.createdAt.getTime() < WITHDRAWAL_DAYS * 86_400_000;
  const waived = percent <= 0 ? "none" : withinWithdrawal ? "withdrawal" : null;
  return {
    fee: waived ? 0 : Math.round(sub.amount * percent) / 100,
    currency: sub.currency,
    percent,
    waived,
    accessUntil: immediate ? now : sub.currentPeriodEnd,
    immediate,
  };
}

/**
 * Cancela a assinatura do workspace: nada mais é cobrado depois do período já pago (ou na hora, se havia
 * pagamento pendente). A taxa, se houver, é cobrada uma vez no cartão salvo — e o cancelamento acontece
 * mesmo se essa cobrança falhar (cancelar nunca depende de pagar a taxa).
 */
export async function cancelSubscription(stripe: Stripe, workspaceId: string, percent: number) {
  const local = await activeSubscription(workspaceId);
  if (!local) return null;
  if (local.cancelAtPeriodEnd) return local; // já cancelada (clique duplo)
  const quote = cancellationQuote(local, percent);

  const sub = quote.immediate
    ? await stripe.subscriptions.cancel(local.stripeSubscriptionId)
    : await stripe.subscriptions.update(local.stripeSubscriptionId, { cancel_at_period_end: true });
  await syncSubscription(sub);

  let feeStatus = quote.waived ? "WAIVED" : "NONE";
  let invoiceId: string | null = null;
  if (quote.fee > 0) {
    try {
      await stripe.invoiceItems.create({
        customer: local.stripeCustomerId,
        amount: Math.round(quote.fee * 100),
        currency: local.currency.toLowerCase(),
        description: `Taxa de cancelamento da assinatura ${local.planName} (${percent}% da mensalidade)`,
      });
      const pm = sub.default_payment_method;
      const invoice = await stripe.invoices.create({
        customer: local.stripeCustomerId,
        collection_method: "charge_automatically",
        auto_advance: false,
        pending_invoice_items_behavior: "include",
        ...(pm ? { default_payment_method: typeof pm === "string" ? pm : pm.id } : {}),
        metadata: { type: "cancellation_fee", subscriptionId: local.id },
      });
      invoiceId = invoice.id ?? null;
      await stripe.invoices.finalizeInvoice(invoice.id!);
      const paid = await stripe.invoices.pay(invoice.id!);
      feeStatus = paid.status === "paid" ? "PAID" : "FAILED";
    } catch (error) {
      console.error("[subscriptions] taxa de cancelamento não cobrada", error);
      feeStatus = "FAILED";
    }
  }

  return db.subscription.update({
    where: { id: local.id },
    data: {
      cancelRequestedAt: new Date(),
      cancelAtPeriodEnd: true,
      cancellationFee: quote.fee,
      cancellationFeeStatus: feeStatus,
      cancellationFeeInvoiceId: invoiceId,
    },
  });
}

/** Desfaz o cancelamento antes do fim do período (só quando nenhuma taxa foi cobrada). */
export async function resumeSubscription(stripe: Stripe, workspaceId: string) {
  const local = await activeSubscription(workspaceId);
  if (!local || !local.cancelAtPeriodEnd || local.status !== "active") return null;
  if (local.cancellationFeeStatus === "PAID") return null;
  const sub = await stripe.subscriptions.update(local.stripeSubscriptionId, { cancel_at_period_end: false });
  await syncSubscription(sub);
  return db.subscription.update({
    where: { id: local.id },
    data: { cancelRequestedAt: null, cancellationFee: 0, cancellationFeeStatus: null, cancellationFeeInvoiceId: null },
  });
}

/**
 * Configuração do Portal do cliente da Stripe usada pelo Vysify: atualizar cartão e ver faturas.
 * O cancelamento fica no próprio Vysify (onde a taxa e o direito de arrependimento são aplicados).
 */
export async function portalConfiguration(stripe: Stripe): Promise<string> {
  const list = await stripe.billingPortal.configurations.list({ active: true, limit: 50 });
  const existing = list.data.find((c) => c.metadata?.vysify === "v1");
  if (existing) return existing.id;
  const created = await stripe.billingPortal.configurations.create({
    business_profile: { headline: "Vysify" },
    features: {
      payment_method_update: { enabled: true },
      invoice_history: { enabled: true },
      customer_update: { enabled: true, allowed_updates: ["email", "address", "tax_id"] },
      subscription_cancel: { enabled: false },
    },
    metadata: { vysify: "v1" },
  });
  return created.id;
}

/** Fatura de assinatura paga: credita os créditos do mês (uma vez por fatura). */
export async function handleInvoicePaid(stripe: Stripe, invoice: Stripe.Invoice) {
  const subId = invoice.parent?.subscription_details?.subscription;
  const subscriptionId = typeof subId === "string" ? subId : subId?.id;
  if (!subscriptionId || !invoice.id) return "ignored";
  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  const local = await syncSubscription(sub);
  if (!local || local.creditsPerPeriod <= 0 || !local.userId) return "ignored";

  const taxId = invoice.customer_tax_ids?.[0]?.value || null;
  return recordPurchase({
    provider: "STRIPE",
    externalId: invoice.id,
    userId: local.userId,
    workspaceId: local.workspaceId,
    planId: local.planId,
    planName: local.planName,
    credits: local.creditsPerPeriod,
    amount: (invoice.amount_paid || 0) / 100,
    currency: invoice.currency || local.currency,
    discount: (invoice.total_discount_amounts || []).reduce((a, d) => a + d.amount, 0) / 100,
    customer: { name: invoice.customer_name, taxId, country: invoice.customer_address?.country || null },
    subscriptionId: local.id,
  });
}
