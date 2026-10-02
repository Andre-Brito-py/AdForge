import { NextResponse } from "next/server";
import Stripe from "stripe";
import { MercadoPagoConfig, Preference } from "mercadopago";
import { z } from "zod";
import { enforceRateLimit, handler, HttpError, parseBody } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { getAppConfig, purchasablePlans } from "@/lib/config";
import { appUrl } from "@/services/email";
import { refundWindowDays } from "@/lib/locale";

const bodySchema = z.object({
  planId: z.string().min(1).max(60),
  currency: z.enum(["BRL", "USD", "EUR"]).default("BRL"),
});

export const POST = handler(async (request: Request) => {
  const user = await requireApiUser();
  await enforceRateLimit(request, "checkout", 10, 15 * 60, user.id);
  const { planId, currency } = await parseBody(request, bodySchema);

  const config = await getAppConfig();
  const plan = purchasablePlans(config.plans).find((p) => p.id === planId);
  if (!plan) throw new HttpError(404, "errors.packNotFound");

  const price = currency === "BRL" ? plan.price_brl : currency === "EUR" ? plan.price_eur ?? 0 : plan.price_usd;
  if (!price || price <= 0) throw new HttpError(400, "errors.packUnavailableCurrency");

  const base = appUrl();
  const metadata = { userId: user.id, workspaceId: user.workspaceId, planId: plan.id, planName: plan.name, credits: String(plan.credits) };

  // Mercado Pago para BRL (Pix, boleto, cartão nacional).
  if (currency === "BRL" && config.secrets.mercadoPagoAccessToken) {
    const client = new MercadoPagoConfig({ accessToken: config.secrets.mercadoPagoAccessToken });
    const preference = await new Preference(client).create({
      body: {
        items: [{ id: plan.id, title: `Vysify · Pacote ${plan.name} (${plan.credits} créditos)`, quantity: 1, unit_price: Number(price), currency_id: "BRL" }],
        payer: { email: user.email },
        metadata: { user_id: user.id, workspace_id: user.workspaceId, plan_id: plan.id, plan_name: plan.name, credits: plan.credits },
        back_urls: {
          success: `${base}/billing?status=success`,
          pending: `${base}/billing?status=pending`,
          failure: `${base}/billing?status=canceled`,
        },
        auto_return: "approved",
        notification_url: `${base}/api/webhooks/mercadopago`,
        external_reference: `${user.id}:${plan.id}:${Date.now()}`,
        statement_descriptor: "VYSIFY",
      },
    });
    if (!preference.init_point) throw new HttpError(502, "errors.checkoutFailed");
    return NextResponse.json({ url: preference.init_point });
  }

  if (config.secrets.stripeSecretKey) {
    const stripe = new Stripe(config.secrets.stripeSecretKey);
    const en = user.locale === "en";
    // Impostos automáticos (VAT/GST/sales tax) exigem o Stripe Tax ativado no painel da Stripe.
    const automaticTax = process.env.STRIPE_AUTOMATIC_TAX === "true";
    const refundDays = refundWindowDays(currency);
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: user.email,
      locale: "auto",
      line_items: [
        {
          price_data: {
            currency: currency.toLowerCase(),
            product_data: {
              name: en ? `Vysify · ${plan.name} pack` : `Vysify · Pacote ${plan.name}`,
              description: en ? `${plan.credits} credits (never expire)` : `${plan.credits} créditos (não expiram)`,
            },
            unit_amount: Math.round(price * 100),
            ...(automaticTax ? { tax_behavior: "exclusive" as const } : {}),
          },
          quantity: 1,
        },
      ],
      automatic_tax: { enabled: automaticTax },
      billing_address_collection: automaticTax ? "required" : "auto",
      // Empresas podem informar VAT/CNPJ/EIN; a Stripe emite a invoice com esses dados.
      tax_id_collection: { enabled: true },
      invoice_creation: { enabled: true },
      custom_text: {
        submit: {
          message: en
            ? `Credits are added right after payment and never expire. Unused credits can be refunded within ${refundDays} days.`
            : `Os créditos entram logo após o pagamento e não expiram. Créditos não utilizados podem ser reembolsados em até ${refundDays} dias.`,
        },
      },
      success_url: `${base}/billing?status=success`,
      cancel_url: `${base}/billing?status=canceled`,
      client_reference_id: user.id,
      metadata,
      payment_intent_data: { metadata },
    });
    if (!session.url) throw new HttpError(502, "errors.checkoutFailed");
    return NextResponse.json({ url: session.url });
  }

  throw new HttpError(503, "errors.paymentsUnavailable", "PAYMENTS_NOT_CONFIGURED");
});
