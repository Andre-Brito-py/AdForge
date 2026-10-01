import { NextResponse } from "next/server";
import { MercadoPagoConfig, Payment } from "mercadopago";
import { db } from "@/lib/db";
import crypto from "crypto";

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const action = url.searchParams.get("topic") || url.searchParams.get("type");
    
    // MP envia notificações de várias formas, a mais comum hoje é com data.id no body para payments
    const body = await request.json();

    const config = await db.systemConfig.findUnique({ where: { id: "global" } });
    if (!config?.mercadoPagoAccessToken) {
      return NextResponse.json({ error: "Mercado Pago not configured" }, { status: 400 });
    }

    // Opcional: Validar assinatura se MP Webhook Secret estiver configurado (x-signature)
    // Para MVP, vamos confiar no fetch direto da API usando o ID recebido (seguro contra spoofing)

    const paymentId = body?.data?.id || body?.id;
    const type = body?.type || action;

    if (type === "payment" && paymentId) {
      const client = new MercadoPagoConfig({ accessToken: config.mercadoPagoAccessToken });
      const paymentClient = new Payment(client);
      
      const payment = await paymentClient.get({ id: paymentId });

      if (payment.status === "approved") {
        const metadata = payment.metadata; // MP converte metadata snake_case ou ignora
        // Algumas vezes a metadata não vem tipada, vamos extrair do external_reference ou metadata original
        // No checkout enviamos metadata = { user_id, workspace_id, credits, plan_id }
        
        const userId = metadata?.user_id;
        const workspaceId = metadata?.workspace_id;
        const credits = parseInt(metadata?.credits || "0", 10);
        const planId = metadata?.plan_id;

        if (userId && workspaceId && credits > 0) {
          // Verificar se já processamos (evitar duplicação do MP)
          const txName = `MP_${paymentId}`;
          const existing = await db.creditTransaction.findFirst({
            where: { description: { contains: txName } }
          });

          if (!existing) {
            // 1. Criar transação de crédito
            await db.creditTransaction.create({
              data: {
                userId,
                workspaceId,
                amount: credits,
                type: "PURCHASE",
                description: `Compra do Plano ${planId} via Mercado Pago [${txName}]`
              }
            });

            // 2. Atualizar saldo
            await db.creditBalance.upsert({
              where: { workspaceId },
              update: { balance: { increment: credits } },
              create: { workspaceId, userId, balance: credits }
            });

            // 3. Enviar E-mail de Recibo
            const user = await db.user.findUnique({ where: { id: userId }});
            if (user && user.email) {
              import("@/services/email").then(({ sendPurchaseReceipt }) => {
                sendPurchaseReceipt(user.email, user.name || "", planId || "Premium", credits);
              }).catch(console.error);
            }
          }
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error("Mercado Pago Webhook Failed:", error);
    // Sempre retornar 200 pro MP parar de enviar
    return NextResponse.json({ received: true, error: error.message }, { status: 200 });
  }
}
