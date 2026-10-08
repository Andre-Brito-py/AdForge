import Stripe from "stripe";
import type { Plan } from "./validation";

/**
 * Espelha os pacotes do Admin na Stripe: um produto por pacote e um preço por moeda.
 * Preços na Stripe são imutáveis: quando o valor muda, criamos um preço novo e arquivamos o antigo
 * (quem já pagou não é afetado). Pacote oculto ou removido = produto arquivado.
 * Trocar a chave de teste pela de produção recria tudo na conta nova (os IDs de teste não existem lá).
 */

export type StripeMode = "test" | "live";
const CURRENCIES = [
  ["brl", "price_brl"],
  ["usd", "price_usd"],
  ["eur", "price_eur"],
] as const;

export function stripeMode(secretKey: string): StripeMode {
  return /^(sk|rk)_live_/.test(secretKey) ? "live" : "test";
}

export function stripeClient(secretKey: string) {
  return new Stripe(secretKey);
}

function isMissing(error: unknown) {
  return (error as { code?: string })?.code === "resource_missing";
}

function productFields(plan: Plan) {
  return {
    name: `Vysify · ${plan.name}`,
    description: `${plan.credits} créditos · ${plan.credits} credits`,
    active: !plan.isHidden,
    metadata: { planId: plan.id, credits: String(plan.credits) },
  };
}

export interface SyncResult {
  plans: Plan[];
  errors: string[];
}

export async function syncPlansToStripe(stripe: Stripe, mode: StripeMode, plans: Plan[], previous: Plan[]): Promise<SyncResult> {
  const errors: string[] = [];
  const out: Plan[] = [];

  for (const plan of plans) {
    try {
      out.push(await syncPlan(stripe, mode, plan));
    } catch (error) {
      errors.push(`${plan.name}: ${(error as Error).message}`);
      out.push(plan);
    }
  }

  // Pacotes removidos do Admin: o produto é arquivado (nunca apagado, há pagamentos ligados a ele).
  const kept = new Set(plans.map((p) => p.id));
  for (const old of previous) {
    if (kept.has(old.id) || !old.stripe?.productId || old.stripe.mode !== mode) continue;
    try {
      await stripe.products.update(old.stripe.productId, { active: false });
    } catch (error) {
      if (!isMissing(error)) errors.push(`${old.name}: ${(error as Error).message}`);
    }
  }
  return { plans: out, errors };
}

async function syncPlan(stripe: Stripe, mode: StripeMode, plan: Plan): Promise<Plan> {
  if (plan.isFree) return plan;
  const fields = productFields(plan);
  const same = plan.stripe?.mode === mode ? plan.stripe : null;

  let productId = same?.productId ?? null;
  if (productId) {
    try {
      await stripe.products.update(productId, fields);
    } catch (error) {
      if (!isMissing(error)) throw error;
      productId = null; // apagado no painel da Stripe: cria de novo
    }
  }
  const fresh = !productId;
  if (!productId) productId = (await stripe.products.create(fields)).id;

  const prices: NonNullable<NonNullable<Plan["stripe"]>["prices"]> = {};
  const toArchive: string[] = [];
  for (const [cur, field] of CURRENCIES) {
    const amount = Number(plan[field] || 0);
    const monthly = plan.interval === "month";
    const current = fresh ? undefined : same?.prices?.[cur];
    if (amount <= 0) {
      if (current) toArchive.push(current.id);
      continue;
    }
    // Preço da Stripe é imutável: mudou o valor ou o tipo (avulso/mensal), cria outro.
    if (current && current.amount === amount && !!current.monthly === monthly) {
      prices[cur] = current;
      continue;
    }
    const price = await stripe.prices.create({
      product: productId,
      currency: cur,
      unit_amount: Math.round(amount * 100),
      // "exclusive": com o Stripe Tax ligado, o imposto é somado no checkout; desligado, não muda nada.
      tax_behavior: "exclusive",
      ...(monthly ? { recurring: { interval: "month" as const } } : {}),
      metadata: { planId: plan.id },
    });
    if (current) toArchive.push(current.id);
    prices[cur] = { id: price.id, amount, ...(monthly ? { monthly: true } : {}) };
  }

  // Preço padrão do produto (informativo no painel da Stripe). Precisa trocar ANTES de arquivar o antigo:
  // a Stripe não deixa arquivar o preço padrão.
  const main = prices.brl ?? prices.usd ?? prices.eur;
  if (main) await stripe.products.update(productId, { default_price: main.id });
  for (const id of toArchive) {
    // Sem nenhum preço ativo, o antigo continua padrão; arquivar falharia, então é ignorado.
    await archivePrice(stripe, id).catch(() => undefined);
  }

  return { ...plan, stripe: { mode, productId, prices } };
}

async function archivePrice(stripe: Stripe, id: string) {
  try {
    await stripe.prices.update(id, { active: false });
  } catch (error) {
    if (!isMissing(error)) throw error;
  }
}

/** ID do preço na Stripe para esta moeda, se o pacote estiver sincronizado com a conta da chave atual. */
export function stripePriceFor(plan: Plan, currency: "BRL" | "USD" | "EUR", mode: StripeMode): string | null {
  if (plan.stripe?.mode !== mode) return null;
  const entry = plan.stripe.prices?.[currency.toLowerCase() as "brl" | "usd" | "eur"];
  const expected = currency === "BRL" ? plan.price_brl : currency === "EUR" ? plan.price_eur ?? 0 : plan.price_usd;
  // Se o preço no Admin mudou e a sincronização falhou, não cobra um valor desatualizado.
  return entry && entry.amount === expected && !!entry.monthly === (plan.interval === "month") ? entry.id : null;
}
