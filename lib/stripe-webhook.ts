/** Eventos da Stripe que o Vysify trata (o webhook criado pelo painel assina exatamente estes). */
export const STRIPE_WEBHOOK_EVENTS = [
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "charge.refunded",
  "charge.dispute.created",
  // Assinaturas: créditos de cada mês pago, mudanças de plano e cancelamentos.
  "invoice.paid",
  "customer.subscription.updated",
  "customer.subscription.deleted",
] as const;

export function stripeWebhookUrl(base: string) {
  return `${base.replace(/\/$/, "")}/api/webhooks/stripe`;
}
