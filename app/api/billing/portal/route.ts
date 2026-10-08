import { NextResponse } from "next/server";
import Stripe from "stripe";
import { db } from "@/lib/db";
import { enforceRateLimit, handler, HttpError } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { getAppConfig } from "@/lib/config";
import { canManageBilling } from "@/lib/workspaces";
import { appUrl } from "@/services/email";

/**
 * Portal do cliente da Stripe: trocar de plano, atualizar o cartão, ver faturas e cancelar a assinatura.
 * (Ative as opções em Stripe › Configurações › Portal do cliente.)
 */
export const POST = handler(async (request: Request) => {
  const user = await requireApiUser();
  if (!canManageBilling(user.workspaceRole)) throw new HttpError(403, "errors.forbidden", "FORBIDDEN");
  await enforceRateLimit(request, "billing-portal", 10, 15 * 60, user.id);
  const config = await getAppConfig();
  if (!config.secrets.stripeSecretKey) throw new HttpError(503, "errors.paymentsUnavailable");
  const workspace = await db.workspace.findUnique({ where: { id: user.workspaceId }, select: { stripeCustomerId: true } });
  if (!workspace?.stripeCustomerId) throw new HttpError(404, "errors.noSubscription");
  const stripe = new Stripe(config.secrets.stripeSecretKey);
  const session = await stripe.billingPortal.sessions.create({
    customer: workspace.stripeCustomerId,
    return_url: `${appUrl()}/billing`,
    locale: user.locale === "en" ? "en" : "pt-BR",
  });
  return NextResponse.json({ url: session.url });
});
