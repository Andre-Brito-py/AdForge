import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { handler, HttpError, parseBody } from "@/lib/api";
import { requireApiAdmin } from "@/lib/auth";
import { encryptSecret } from "@/lib/crypto";
import { getAppConfig, invalidateConfigCache } from "@/lib/config";
import { stripeClient, stripeMode } from "@/lib/stripe-sync";
import { STRIPE_WEBHOOK_EVENTS, stripeWebhookUrl } from "@/lib/stripe-webhook";
import { appUrl } from "@/services/email";

/** Situação da conta da Stripe da chave salva: conta, modo, se já pode cobrar e se o webhook existe. */
export const GET = handler(async () => {
  await requireApiAdmin();
  const config = await getAppConfig();
  const key = config.secrets.stripeSecretKey;
  if (!key) return NextResponse.json({ configured: false });
  const stripe = stripeClient(key);
  const url = stripeWebhookUrl(appUrl());
  try {
    const [account, hooks] = await Promise.all([
      stripe.accounts.retrieveCurrent(),
      stripe.webhookEndpoints.list({ limit: 100 }),
    ]);
    const hook = hooks.data.find((h) => h.url === url);
    const missing = hook ? STRIPE_WEBHOOK_EVENTS.filter((e) => !hook.enabled_events.includes(e) && !hook.enabled_events.includes("*")) : [...STRIPE_WEBHOOK_EVENTS];
    return NextResponse.json({
      configured: true,
      ok: true,
      mode: stripeMode(key),
      account: {
        name: account.settings?.dashboard?.display_name || account.business_profile?.name || account.email || account.id,
        country: account.country,
        currency: account.default_currency,
        chargesEnabled: account.charges_enabled,
        payoutsEnabled: account.payouts_enabled,
      },
      webhook: {
        url,
        exists: !!hook,
        enabled: hook?.status === "enabled",
        missingEvents: missing,
        secretSaved: !!config.secrets.stripeWebhookSecret,
      },
    });
  } catch (error) {
    return NextResponse.json({ configured: true, ok: false, mode: stripeMode(key), error: (error as Error).message.slice(0, 300) });
  }
});

const postSchema = z.object({ action: z.literal("webhook") });

/**
 * Cria (ou recria) o webhook do Vysify na conta da Stripe e salva o segredo de assinatura sozinho.
 * A Stripe só mostra o segredo na criação, por isso um webhook antigo com a mesma URL é substituído.
 */
export const POST = handler(async (request: Request) => {
  await requireApiAdmin();
  await parseBody(request, postSchema);
  const config = await getAppConfig();
  const key = config.secrets.stripeSecretKey;
  if (!key) throw new HttpError(400, "Salve a Secret key da Stripe primeiro");
  const base = appUrl();
  if (!/^https:\/\//.test(base)) {
    throw new HttpError(400, `A Stripe só envia webhooks para endereços https. O endereço atual é ${base}: configure o domínio (NEXT_PUBLIC_APP_URL) ou use a Stripe CLI para testes locais.`);
  }
  const stripe = stripeClient(key);
  const url = stripeWebhookUrl(base);
  try {
    const existing = await stripe.webhookEndpoints.list({ limit: 100 });
    for (const hook of existing.data.filter((h) => h.url === url)) await stripe.webhookEndpoints.del(hook.id);
    const created = await stripe.webhookEndpoints.create({
      url,
      enabled_events: [...STRIPE_WEBHOOK_EVENTS],
      description: "Vysify (criado pelo painel admin)",
    });
    if (!created.secret) throw new Error("A Stripe não devolveu o segredo do webhook");
    await db.systemConfig.upsert({
      where: { id: "global" },
      update: { stripeWebhookSecret: encryptSecret(created.secret) },
      create: { id: "global", stripeWebhookSecret: encryptSecret(created.secret) },
    });
    invalidateConfigCache();
    return NextResponse.json({ success: true, url, events: STRIPE_WEBHOOK_EVENTS.length });
  } catch (error) {
    throw new HttpError(400, `A Stripe recusou: ${(error as Error).message.slice(0, 300)}`);
  }
});
