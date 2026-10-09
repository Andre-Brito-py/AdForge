import { NextResponse } from "next/server";
import Stripe from "stripe";
import { z } from "zod";
import { enforceRateLimit, handler, HttpError, parseBody } from "@/lib/api";
import { requireApiManager } from "@/lib/auth";
import { getAppConfig } from "@/lib/config";
import { activeSubscription, cancellationQuote, cancelSubscription, resumeSubscription } from "@/lib/subscriptions";

// Quanto custaria cancelar agora (para a tela de confirmação).
export const GET = handler(async () => {
  const user = await requireApiManager();
  const config = await getAppConfig();
  const sub = await activeSubscription(user.workspaceId);
  if (!sub) throw new HttpError(404, "errors.noSubscription");
  return NextResponse.json({
    subscription: { planName: sub.planName, amount: sub.amount, currency: sub.currency, cancelAtPeriodEnd: sub.cancelAtPeriodEnd },
    quote: cancellationQuote(sub, config.settings.cancellationFeePercent),
  });
});

const bodySchema = z.object({ action: z.enum(["cancel", "resume"]) });

// Cancelar (sem cobranças futuras) ou desfazer o cancelamento antes do fim do período.
export const POST = handler(async (request: Request) => {
  const user = await requireApiManager();
  await enforceRateLimit(request, "subscription-cancel", 10, 60 * 60, user.workspaceId);
  const { action } = await parseBody(request, bodySchema);
  const config = await getAppConfig();
  if (!config.secrets.stripeSecretKey) throw new HttpError(503, "errors.paymentsUnavailable");
  const stripe = new Stripe(config.secrets.stripeSecretKey);

  if (action === "resume") {
    const resumed = await resumeSubscription(stripe, user.workspaceId);
    if (!resumed) throw new HttpError(400, "errors.cannotResume", "CANNOT_RESUME");
    return NextResponse.json({ success: true });
  }
  const canceled = await cancelSubscription(stripe, user.workspaceId, config.settings.cancellationFeePercent);
  if (!canceled) throw new HttpError(404, "errors.noSubscription");
  return NextResponse.json({
    success: true,
    accessUntil: canceled.currentPeriodEnd,
    fee: canceled.cancellationFee,
    feeStatus: canceled.cancellationFeeStatus,
  });
});
