import { NextResponse } from "next/server";
import { headers } from "next/headers";
import Stripe from "stripe";
import { db } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const body = await request.text();
    const headersList = await headers();
    const signature = headersList.get("stripe-signature");

    if (!signature) {
      return NextResponse.json({ error: "No signature" }, { status: 400 });
    }

    const config = await db.systemConfig.findUnique({ where: { id: "global" } });
    if (!config?.stripeSecretKey || !config?.stripeWebhookSecret) {
      return NextResponse.json({ error: "Stripe not configured" }, { status: 400 });
    }

    const stripe = new Stripe(config.stripeSecretKey, { apiVersion: "2024-10-28.acacia" });

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, config.stripeWebhookSecret);
    } catch (error: any) {
      console.error("Webhook Error:", error.message);
      return NextResponse.json({ error: `Webhook Error: ${error.message}` }, { status: 400 });
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      
      const userId = session.metadata?.userId;
      const workspaceId = session.metadata?.workspaceId;
      const credits = parseInt(session.metadata?.credits || "0", 10);
      const planId = session.metadata?.planId;

      if (userId && workspaceId && credits > 0) {
        // 1. Criar transação de crédito
        await db.creditTransaction.create({
          data: {
            userId,
            workspaceId,
            amount: credits,
            type: "PURCHASE",
            description: `Compra do Plano ${planId} via Stripe`
          }
        });

        // 2. Atualizar saldo (Upsert)
        await db.creditBalance.upsert({
          where: { workspaceId },
          update: { balance: { increment: credits } },
          create: { workspaceId, userId, balance: credits }
        });
      }
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error("Stripe Webhook Failed:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
