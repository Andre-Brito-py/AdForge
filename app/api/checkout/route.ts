import { NextResponse } from "next/server";
import Stripe from "stripe";
import { MercadoPagoConfig, Preference } from "mercadopago";
import { z } from "zod";
import { enforceRateLimit, handler, HttpError, parseBody } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { getAppConfig, purchasablePlans } from "@/lib/config";
import { appUrl } from "@/services/email";
import { refundWindowDays } from "@/lib/locale";
import { applyCoupon, CouponError, type AppliedCoupon } from "@/lib/coupons";
import { stripeMode, stripePriceFor } from "@/lib/stripe-sync";
import { assertCurrentTerms } from "@/lib/terms";

const bodySchema = z.object({
  planId: z.string().min(1).max(60),
  currency: z.enum(["BRL", "USD", "EUR"]).default("BRL"),
  coupon: z.string().trim().max(40).optional().nullable(),
});

export const POST = handler(async (request: Request) => {
  const user = await requireApiUser();
  assertCurrentTerms(user);
  await enforceRateLimit(request, "checkout", 10, 15 * 60, user.id);
  const { planId, currency, coupon: couponCode } = await parseBody(request, bodySchema);

  const config = await getAppConfig();
  const plan = purchasablePlans(config.plans).find((p) => p.id === planId);
  if (!plan) throw new HttpError(404, "errors.packNotFound");

  const price = currency === "BRL" ? plan.price_brl : currency === "EUR" ? plan.price_eur ?? 0 : plan.price_usd;
  if (!price || price <= 0) throw new HttpError(400, "errors.packUnavailableCurrency");

  const stripeKey = config.secrets.stripeSecretKey;
  const mode = stripeKey ? stripeMode(stripeKey) : null;
  let coupon: AppliedCoupon | null = null;
  if (couponCode) {
    try {
      coupon = await applyCoupon(couponCode, plan, currency, price, mode);
    } catch (error) {
      if (error instanceof CouponError) throw new HttpError(400, `errors.coupon.${error.key}`, "COUPON_INVALID");
      throw error;
    }
  }
  const charged = coupon ? coupon.finalPrice : price;

  const base = appUrl();
  const metadata = {
    userId: user.id, workspaceId: user.workspaceId, planId: plan.id, planName: plan.name, credits: String(plan.credits),
    ...(coupon ? { coupon: coupon.code, discount: String(coupon.discount) } : {}),
  };

  // Mercado Pago para BRL (Pix, boleto, cartão nacional). O MP não tem cupom próprio: o desconto vai no preço.
  if (currency === "BRL" && config.secrets.mercadoPagoAccessToken) {
    const client = new MercadoPagoConfig({ accessToken: config.secrets.mercadoPagoAccessToken });
    const preference = await new Preference(client).create({
      body: {
        items: [{
          id: plan.id,
          title: `Vysify · Pacote ${plan.name} (${plan.credits} créditos)${coupon ? ` · cupom ${coupon.code}` : ""}`,
          quantity: 1, unit_price: Number(charged), currency_id: "BRL",
        }],
        payer: { email: user.email },
        metadata: {
          user_id: user.id, workspace_id: user.workspaceId, plan_id: plan.id, plan_name: plan.name, credits: plan.credits,
          ...(coupon ? { coupon: coupon.code, discount: coupon.discount } : {}),
        },
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

  if (stripeKey && mode) {
    const stripe = new Stripe(stripeKey);
    const en = user.locale === "en";
    // Impostos automáticos (VAT/GST/sales tax) exigem o Stripe Tax ativado no painel da Stripe.
    const automaticTax = config.settings.stripeAutomaticTax;
    const refundDays = refundWindowDays(currency);

    // Pacote sincronizado com a Stripe (Admin › Pacotes): usa o preço cadastrado lá e o cupom dela.
    // Sem sincronização, monta o preço na hora e já aplica o desconto nele.
    const priceId = stripePriceFor(plan, currency, mode);
    const useStripeCoupon = !!(priceId && coupon?.stripePromotionCodeId);
    const lineItem: Stripe.Checkout.SessionCreateParams.LineItem =
      priceId && (!coupon || useStripeCoupon)
        ? { price: priceId, quantity: 1 }
        : {
            // Sem preço sincronizado, ou cupom sem espelho na Stripe: o valor (já com desconto) vai direto.
            price_data: {
              currency: currency.toLowerCase(),
              ...(priceId
                ? { product: plan.stripe!.productId }
                : {
                    product_data: {
                      name: en ? `Vysify · ${plan.name} pack` : `Vysify · Pacote ${plan.name}`,
                      description: en ? `${plan.credits} credits (never expire)` : `${plan.credits} créditos (não expiram)`,
                    },
                  }),
              unit_amount: Math.round(charged * 100),
              ...(automaticTax ? { tax_behavior: "exclusive" as const } : {}),
            },
            quantity: 1,
          };

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: user.email,
      locale: "auto",
      line_items: [lineItem],
      ...(useStripeCoupon ? { discounts: [{ promotion_code: coupon!.stripePromotionCodeId! }] } : {}),
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
