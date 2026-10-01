import { NextResponse } from "next/server";
import { MercadoPagoConfig, Payment } from "mercadopago";
import { getAppConfig } from "@/lib/config";
import { recordPurchase } from "@/lib/payments";
import { verifyMercadoPagoSignature } from "@/lib/mercadopago-signature";

export async function POST(request: Request) {
  const config = await getAppConfig();
  const { mercadoPagoAccessToken, mercadoPagoWebhookSecret } = config.secrets;
  if (!mercadoPagoAccessToken) return NextResponse.json({ error: "Mercado Pago não configurado" }, { status: 503 });

  const url = new URL(request.url);
  const body = await request.json().catch(() => ({}));
  const type = body?.type || url.searchParams.get("type") || url.searchParams.get("topic");
  const paymentId = String(url.searchParams.get("data.id") || body?.data?.id || "");

  if (mercadoPagoWebhookSecret) {
    const valid = verifyMercadoPagoSignature({
      secret: mercadoPagoWebhookSecret,
      signatureHeader: request.headers.get("x-signature"),
      requestId: request.headers.get("x-request-id"),
      dataId: paymentId,
      maxAgeSeconds: 60 * 60,
    });
    if (!valid) return NextResponse.json({ error: "Assinatura inválida" }, { status: 401 });
  } else if (process.env.NODE_ENV === "production") {
    console.warn("[mercadopago] MERCADOPAGO_WEBHOOK_SECRET não configurado: assinatura não verificada.");
  }

  if (type !== "payment" || !paymentId) return NextResponse.json({ received: true });

  try {
    // Sempre buscamos o pagamento na API do MP: nunca confiamos no corpo da notificação.
    const payment = await new Payment(new MercadoPagoConfig({ accessToken: mercadoPagoAccessToken })).get({ id: paymentId });
    if (payment.status !== "approved") return NextResponse.json({ received: true, status: payment.status });

    const m = (payment.metadata || {}) as Record<string, unknown>;
    const credits = Number(m.credits || 0);
    const userId = typeof m.user_id === "string" ? m.user_id : null;
    const workspaceId = typeof m.workspace_id === "string" ? m.workspace_id : null;
    if (!userId || !workspaceId || !Number.isInteger(credits) || credits <= 0) {
      console.error("[mercadopago] pagamento sem metadata esperada", paymentId);
      return NextResponse.json({ received: true, ignored: true });
    }

    const result = await recordPurchase({
      provider: "MERCADOPAGO",
      externalId: String(payment.id),
      userId,
      workspaceId,
      planId: typeof m.plan_id === "string" ? m.plan_id : null,
      planName: typeof m.plan_name === "string" ? m.plan_name : "Créditos",
      credits,
      amount: payment.transaction_amount || 0,
      currency: payment.currency_id || "BRL",
    });
    return NextResponse.json({ received: true, result });
  } catch (error) {
    console.error("[mercadopago] falha ao processar", error);
    // 500 faz o MP tentar de novo; o crédito é idempotente.
    return NextResponse.json({ error: "Falha ao processar" }, { status: 500 });
  }
}
