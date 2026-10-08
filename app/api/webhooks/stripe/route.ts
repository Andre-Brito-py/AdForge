import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getAppConfig } from "@/lib/config";
import { recordPurchase, recordRefund } from "@/lib/payments";

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
      // Boleto/Pix via Stripe chegam primeiro como "unpaid"; só creditamos quando pago.
      if (session.payment_status !== "paid") return NextResponse.json({ received: true, pending: true });

      const m = session.metadata || {};
      const credits = parseInt(m.credits || "0", 10);
      if (!m.userId || !m.workspaceId || !credits) {
        console.error("[stripe] sessão sem metadata esperada", session.id);
        return NextResponse.json({ received: true, ignored: true });
      }

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
      });
      return NextResponse.json({ received: true, result });
    }

    // Estorno feito no painel da Stripe (total ou parcial) ou contestação (chargeback): retira os créditos.
    if (event.type === "charge.refunded" || event.type === "charge.dispute.created") {
      const obj = event.data.object as Stripe.Charge | Stripe.Dispute;
      const paymentIntent = typeof obj.payment_intent === "string" ? obj.payment_intent : obj.payment_intent?.id;
      if (!paymentIntent) return NextResponse.json({ received: true, ignored: true });
      const sessions = await stripe.checkout.sessions.list({ payment_intent: paymentIntent, limit: 1 });
      const session = sessions.data[0];
      if (!session) return NextResponse.json({ received: true, ignored: true });
      const refundedTotal = event.type === "charge.refunded" ? (obj as Stripe.Charge).amount_refunded / 100 : (obj as Stripe.Dispute).amount / 100;
      const result = await recordRefund({
        provider: "STRIPE",
        externalId: session.id,
        refundedTotal,
        reason: event.type === "charge.dispute.created" ? "contestação/chargeback" : "estorno",
      });
      return NextResponse.json({ received: true, result });
    }
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[stripe] falha ao processar webhook", error);
    // 500 faz a Stripe reenviar mais tarde (o processamento é idempotente).
    return NextResponse.json({ error: "Falha ao processar" }, { status: 500 });
  }
}
