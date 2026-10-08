import { db } from "./db";
import { sendAdminAlertEmail } from "@/services/email";

/** E-mail para todos os super admins (falhas aqui nunca derrubam quem chamou). */
export async function notifyAdmins(subject: string, lines: string[]) {
  try {
    const admins = await db.user.findMany({ where: { role: "SUPERADMIN" }, select: { email: true } });
    await Promise.all(admins.map((a) => sendAdminAlertEmail(a.email, subject, lines)));
  } catch (error) {
    console.error("[admin-alerts] falha ao avisar os admins", error);
  }
}

// ---------- Provedores de IA sem saldo / chave recusada ----------

export type AlertProvider = "google" | "fal" | "openai" | "elevenlabs";
export const PROVIDER_LABEL: Record<AlertProvider, string> = {
  google: "Google (Gemini/Veo)",
  fal: "fal.ai (Wan e lip-sync)",
  openai: "OpenAI",
  elevenlabs: "ElevenLabs",
};
const BILLING_URL: Record<AlertProvider, string> = {
  google: "https://ai.studio/projects",
  fal: "https://fal.ai/dashboard/billing",
  openai: "https://platform.openai.com/settings/organization/billing",
  elevenlabs: "https://elevenlabs.io/app/subscription",
};

/**
 * Depois de uma recusa por saldo, o que depende do provedor fica pausado por este tempo
 * (o cliente vê "temporariamente indisponível" em vez de pagar e receber uma falha).
 * Passado o prazo, a próxima tentativa testa de novo; se falhar, a pausa recomeça.
 */
export const PAUSE_MS = 15 * 60_000;
/** No máximo um e-mail por provedor neste intervalo. */
const NOTIFY_EVERY_MS = 60 * 60_000;

// "quota" sozinho não entra: o Google usa a palavra também no limite por minuto, que passa sozinho.
const BILLING = /depleted|prepay|billing|exhausted balance|insufficient|exceeded your current quota|limit: 0|free_tier|credit balance|\((402|401)\)|"code":\s*(402|401)|User is locked|invalid api key|incorrect api key/i;

/** A mensagem indica falta de saldo ou chave recusada (tentar de novo não resolve)? */
export function isBillingMessage(message: string) {
  return BILLING.test(message);
}

/** Qual provedor uma mensagem de saldo/chave indica; null = erro comum (ou provedor não identificado). */
export function billingProblem(message: string): AlertProvider | null {
  if (!isBillingMessage(message)) return null;
  if (/fal\.ai|fal-ai|queue\.fal|User is locked/i.test(message)) return "fal";
  if (/Veo|Gemini|Google|generativelanguage|RESOURCE_EXHAUSTED|ai\.studio/i.test(message)) return "google";
  if (/OpenAI|openai/i.test(message)) return "openai";
  if (/ElevenLabs|elevenlabs/i.test(message)) return "elevenlabs";
  return null;
}

/** Registra a recusa, avisa os admins (com limite) e liga a pausa do provedor. */
export async function reportProviderProblem(provider: AlertProvider, message: string) {
  const now = new Date();
  const existing = await db.providerAlert.findUnique({ where: { provider } });
  const reopened = !existing || !!existing.resolvedAt;
  const alert = await db.providerAlert.upsert({
    where: { provider },
    create: { provider, message: message.slice(0, 500), lastFailureAt: now },
    update: {
      message: message.slice(0, 500),
      lastFailureAt: now,
      failures: reopened ? 1 : { increment: 1 },
      resolvedAt: null,
      ...(reopened ? { createdAt: now, notifiedAt: null } : {}),
    },
  });
  if (alert.notifiedAt && now.getTime() - alert.notifiedAt.getTime() < NOTIFY_EVERY_MS) return;
  await db.providerAlert.update({ where: { provider }, data: { notifiedAt: now } });
  await notifyAdmins(`${PROVIDER_LABEL[provider]} sem saldo ou com a chave recusada`, [
    `O provedor recusou um pedido de geração: ${message.slice(0, 300)}`,
    `Enquanto isso, o que depende dele fica pausado por ${PAUSE_MS / 60_000} minutos de cada vez (os clientes veem "temporariamente indisponível" e não são cobrados).`,
    `Recarregue em ${BILLING_URL[provider]} e depois marque o alerta como resolvido no painel admin.`,
  ]);
}

/** Lê o erro e, se for falta de saldo/chave, registra o alerta. Nunca lança. */
export async function reportIfBillingProblem(error: unknown, fallback?: AlertProvider | null) {
  const message = error instanceof Error ? error.message : String(error);
  // Pelo texto do erro; se ele não disser qual é o provedor, vale o de quem fez o pedido.
  const provider = billingProblem(message) ?? (isBillingMessage(message) ? fallback ?? null : null);
  if (!provider) return;
  await reportProviderProblem(provider, message).catch((e) => console.error("[admin-alerts] registro falhou", e));
}

/** Provedores com recusa recente (dentro da pausa) e ainda não resolvidos. */
/** Provedor de um criativo (campo `provider`: "google-veo", "fal.ai", "openai", "gemini"). */
export function providerOfCreative(provider: string | null | undefined): AlertProvider | null {
  if (!provider) return null;
  if (/veo|gemini|google/i.test(provider)) return "google";
  if (/fal/i.test(provider)) return "fal";
  if (/openai/i.test(provider)) return "openai";
  return null;
}

export async function pausedProviders(now = Date.now()): Promise<Set<AlertProvider>> {
  const alerts = await db.providerAlert.findMany({
    where: { resolvedAt: null, lastFailureAt: { gt: new Date(now - PAUSE_MS) } },
    select: { provider: true },
  });
  return new Set(alerts.map((a) => a.provider as AlertProvider));
}

export async function openAlerts() {
  return db.providerAlert.findMany({ where: { resolvedAt: null }, orderBy: { lastFailureAt: "desc" } });
}

export async function resolveAlert(provider: string) {
  await db.providerAlert.updateMany({ where: { provider, resolvedAt: null }, data: { resolvedAt: new Date() } });
}

export function billingUrl(provider: string) {
  return BILLING_URL[provider as AlertProvider] ?? null;
}
