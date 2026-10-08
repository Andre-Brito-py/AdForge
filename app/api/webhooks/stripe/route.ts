import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getAppConfig } from "@/lib/config";
import { recordPurchase, recordRefund } from "@/lib/payments";
import { handleInvoicePaid, syncSubscription } from "@/lib/subscriptions";

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Assinatura ausente" }, { status: 400 });

  const config = await getAppConfig();
  const { stripeSecretKey, stripeWebhookSecret } = config.secrets;
  if (!stripeSecretKey || !stripeWebhookSecret) {
    return NextResponse.json({ error: "Stripe não configurado" }, { status: 503 });
  }

  const stripe = new Stripe(stripeSecretKey);
  const body = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, stripeWebhookSecret);
  } catch {
    return NextResponse.json({ error: "Assinatura inválida" }, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
      const session = event.data.object as Stripe.Checkout.Session;

      // Assinatura: só registra a assinatura; os créditos entram pela fatura paga (invoice.paid), todo mês.
      if (session.mode === "subscription") {
        const subId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
        if (subId) await syncSubscription(await stripe.subscriptions.retrieve(subId));
        return NextResponse.json({ received: true, subscription: true });
      }

      // Boleto/Pix via Stripe chegam primeiro como "unpaid"; só creditamos quando pago.
      if (session.payment_status !== "paid") return NextResponse.json({ received: true, pending: true });

      const m = session.metadata || {};
      const credits = parseInt(m.credits || "0", 10);
      if (!m.userId || !m.workspaceId || !credits) {
        console.error("[stripe] sessão sem metadata esperada", session.id);
        return NextResponse.json({ received: true, ignored: true });
      }

      const details = session.customer_details;
      const result = await recordPurchase({
        provider: "STRIPE",
        externalId: session.id,
        userId: m.userId,
        workspaceId: m.workspaceId,
        planId: m.planId || null,
        planName: m.planName || m.planId || "Créditos",
        credits,
        amount: (session.amount_total || 0) / 100,
        currency: session.currency || "usd",
        couponCode: m.coupon || null,
        discount: (session.total_details?.amount_discount ?? 0) / 100 || Number(m.discount || 0),
        customer: { name: details?.name, taxId: details?.tax_ids?.[0]?.value || null, country: details?.address?.country || null },
      });
      return NextResponse.json({ received: true, result });
    }

    // Mensalidade de assinatura paga (inclusive a primeira): credita os créditos do mês.
    if (event.type === "invoice.paid") {
      const result = await handleInvoicePaid(stripe, event.data.object as Stripe.Invoice);
      return NextResponse.json({ received: true, result });
    }

    // Plano trocado, cancelamento agendado, pagamento atrasado ou assinatura encerrada.
    if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
      await syncSubscription(event.data.object as Stripe.Subscription);
      return NextResponse.json({ received: true });
    }

    // Estorno feito no painel da Stripe (total ou parcial) ou contestação (chargeback): retira os créditos.
    if (event.type === "charge.refunded" || event.type === "charge.dispute.created") {
      const obj = event.data.object as Stripe.Charge | Stripe.Dispute;
      const paymentIntent = typeof obj.payment_intent === "string" ? obj.payment_intent : obj.payment_intent?.id;
      if (!paymentIntent) return NextResponse.json({ received: true, ignored: true });
      const refundedTotal = event.type === "charge.refunded" ? (obj as Stripe.Charge).amount_refunded / 100 : (obj as Stripe.Dispute).amount / 100;
      const reason = event.type === "charge.dispute.created" ? "contestação/chargeback" : "estorno";

      // Pacote avulso: o pagamento foi registrado pelo id da sessão do checkout.
      const sessions = await stripe.checkout.sessions.list({ payment_intent: paymentIntent, limit: 1 });
      const session = sessions.data[0];
      if (session && session.mode === "payment") {
        const result = await recordRefund({ provider: "STRIPE", externalId: session.id, refundedTotal, reason });
        return NextResponse.json({ received: true, result });
      }
      // Mensalidade: registrada pelo id da fatura.
      const invoicePayments = await stripe.invoicePayments.list({ payment: { type: "payment_intent", payment_intent: paymentIntent }, limit: 1 });
      const invoice = invoicePayments.data[0]?.invoice;
      const invoiceId = typeof invoice === "string" ? invoice : invoice?.id;
      if (!invoiceId) return NextResponse.json({ received: true, ignored: true });
      const result = await recordRefund({ provider: "STRIPE", externalId: invoiceId, refundedTotal, reason });
      return NextResponse.json({ received: true, result });
    }
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[stripe] falha ao processar webhook", error);
    // 500 faz a Stripe reenviar mais tarde (o processamento é idempotente).
    return NextResponse.json({ error: "Falha ao processar" }, { status: 500 });
  }
}
