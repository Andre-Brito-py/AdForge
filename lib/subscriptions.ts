import type Stripe from "stripe";
import { db } from "./db";
import { recordPurchase } from "./payments";

/**
 * Assinaturas mensais (só pela Stripe). A cada fatura paga (inclusive a primeira), o workspace recebe
 * os créditos do plano. Os créditos não expiram: o que sobrar continua no saldo.
 * Mudanças de plano, cancelamento e cartão ficam no Portal do cliente da Stripe.
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
  };
  return db.subscription.upsert({
    where: { stripeSubscriptionId: sub.id },
    update: data,
    create: { stripeSubscriptionId: sub.id, ...data },
  });
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
