import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import { db } from "@/lib/db";
import Stripe from "stripe";
import { MercadoPagoConfig, Preference } from "mercadopago";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { planId, currency = "BRL" } = await request.json();

    const config = await db.systemConfig.findUnique({ where: { id: "global" } });
    if (!config || !config.plansJson) {
      return NextResponse.json({ error: "No plans configured" }, { status: 400 });
    }

    const plans = JSON.parse(config.plansJson);
    const plan = plans.find((p: any) => p.id === planId);

    if (!plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    const member = await db.workspaceMember.findFirst({
      where: { userId: session.user.id }
    });

    if (!member) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    
    // MERCADO PAGO - If currency is BRL and MP is configured
    if (currency === "BRL" && config.mercadoPagoAccessToken) {
      const client = new MercadoPagoConfig({ accessToken: config.mercadoPagoAccessToken });
      const preference = new Preference(client);

      const price = plan.price_brl || 0;

      const response = await preference.create({
        body: {
          items: [
            {
              id: plan.id,
              title: `Vysify - Plano ${plan.name}`,
              quantity: 1,
              unit_price: Number(price),
              currency_id: "BRL"
            }
          ],
          metadata: {
            user_id: session.user.id,
            workspace_id: member.workspaceId,
            plan_id: plan.id,
            credits: plan.credits
          },
          back_urls: {
            success: `${appUrl}/billing?success=true`,
            pending: `${appUrl}/billing?pending=true`,
            failure: `${appUrl}/billing?canceled=true`
          },
          auto_return: "approved",
          external_reference: `${session.user.id}_${Date.now()}`
        }
      });

      return NextResponse.json({ url: response.init_point });
    }
    
    // STRIPE - Fallback or if currency is USD/EUR
    if (config.stripeSecretKey) {
      const stripe = new Stripe(config.stripeSecretKey, { apiVersion: "2024-10-28.acacia" });

      let priceValue = plan.price_usd || 0;
      let curr = "usd";

      if (currency === "EUR" && plan.price_eur) {
        priceValue = plan.price_eur;
        curr = "eur";
      } else if (currency === "BRL" && plan.price_brl) {
        priceValue = plan.price_brl;
        curr = "brl";
      }

      const stripeSession = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        mode: "payment", // "subscription" se for recorrente
        line_items: [
          {
            price_data: {
              currency: curr,
              product_data: {
                name: `Vysify - Plano ${plan.name}`,
                description: `${plan.credits} Créditos Inclusos`
              },
              unit_amount: Math.round(priceValue * 100), // Stripe expects cents
            },
            quantity: 1,
          }
        ],
        success_url: `${appUrl}/billing?success=true`,
        cancel_url: `${appUrl}/billing?canceled=true`,
        client_reference_id: session.user.id,
        metadata: {
          userId: session.user.id,
          workspaceId: member.workspaceId,
          planId: plan.id,
          credits: plan.credits.toString()
        }
      });

      return NextResponse.json({ url: stripeSession.url });
    }

    return NextResponse.json({ error: "No payment gateway configured for this currency" }, { status: 400 });

  } catch (error: any) {
    console.error("Checkout Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
