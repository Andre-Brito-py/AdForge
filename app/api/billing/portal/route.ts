import { NextResponse } from "next/server";
import Stripe from "stripe";
import { db } from "@/lib/db";
import { enforceRateLimit, handler, HttpError } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { getAppConfig } from "@/lib/config";
import { canManageBilling } from "@/lib/workspaces";
import { portalConfiguration } from "@/lib/subscriptions";
import { appUrl } from "@/services/email";

/**
 * Portal do cliente da Stripe: atualizar o cartão e ver as faturas (o cancelamento fica no próprio Vysify).
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
    // Cartão e faturas; o cancelamento é feito no Vysify (taxa e direito de arrependimento aplicados).
    configuration: await portalConfiguration(stripe),
    return_url: `${appUrl()}/billing`,
    locale: user.locale === "en" ? "en" : "pt-BR",
  });
  return NextResponse.json({ url: session.url });
});
