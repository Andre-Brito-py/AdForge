import type { Coupon } from "@prisma/client";
import { z } from "zod";
import { db } from "./db";
import type { Plan } from "./validation";
import type { Currency } from "./locale";
import { stripeClient, stripeMode, type StripeMode } from "./stripe-sync";

/**
 * Cupons de desconto. A fonte da verdade é a tabela Coupon (vale no Mercado Pago e na Stripe);
 * na Stripe, cada cupom também vira um cupom + código promocional, para o desconto sair na fatura dela.
 */

export const COUPON_CODE = /^[A-Z0-9_-]{3,40}$/;
/** O cliente sempre paga algo: Mercado Pago e Stripe não processam cobranças de valor zero. */
export const MAX_PERCENT_OFF = 95;
const MIN_CHARGE: Record<Currency, number> = { BRL: 2, USD: 0.5, EUR: 0.5 };

export function normalizeCode(code: string) {
  return code.trim().toUpperCase();
}

export const couponInputSchema = z
  .object({
    code: z.string().transform(normalizeCode).pipe(z.string().regex(COUPON_CODE, "Use de 3 a 40 letras, números, - ou _")),
    kind: z.enum(["percent", "amount"]),
    percentOff: z.number().int().min(1).max(MAX_PERCENT_OFF).optional().nullable(),
    amountOff: z.number().positive().max(100_000).optional().nullable(),
    currency: z.enum(["BRL", "USD", "EUR"]).optional().nullable(),
    planIds: z.array(z.string().max(60)).max(10).default([]),
    maxRedemptions: z.number().int().positive().max(1_000_000).optional().nullable(),
    expiresAt: z.coerce.date().optional().nullable(),
  })
  .refine((c) => (c.kind === "percent" ? !!c.percentOff : !!c.amountOff && !!c.currency), {
    message: "Informe a porcentagem, ou o valor e a moeda do desconto",
  })
  .refine((c) => !c.expiresAt || c.expiresAt.getTime() > Date.now() + 60_000, { message: "A validade precisa ser no futuro" });
export type CouponInput = z.infer<typeof couponInputSchema>;

export function couponPlanIds(c: Pick<Coupon, "planIdsJson">): string[] {
  try {
    const list = JSON.parse(c.planIdsJson || "[]");
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export async function couponRedemptions(code: string) {
  return db.payment.count({ where: { couponCode: code } });
}

export class CouponError extends Error {
  constructor(public key: "notFound" | "expired" | "exhausted" | "plan" | "currency" | "tooLow") {
    super(key);
  }
}

export interface AppliedCoupon {
  code: string;
  discount: number;
  finalPrice: number;
  stripePromotionCodeId: string | null;
}

/** Desconto que um cupom dá neste pacote/moeda (erro com motivo se não puder ser usado). */
export async function applyCoupon(rawCode: string, plan: Plan, currency: Currency, price: number, mode: StripeMode | null): Promise<AppliedCoupon> {
  const code = normalizeCode(rawCode);
  const coupon = COUPON_CODE.test(code) ? await db.coupon.findUnique({ where: { code } }) : null;
  if (!coupon || !coupon.active) throw new CouponError("notFound");
  if (coupon.expiresAt && coupon.expiresAt.getTime() < Date.now()) throw new CouponError("expired");
  if (coupon.maxRedemptions && (await couponRedemptions(code)) >= coupon.maxRedemptions) throw new CouponError("exhausted");
  const plans = couponPlanIds(coupon);
  if (plans.length && !plans.includes(plan.id)) throw new CouponError("plan");

  let discount: number;
  if (coupon.percentOff) {
    discount = Math.round(price * coupon.percentOff) / 100;
  } else {
    if (coupon.currency !== currency) throw new CouponError("currency");
    discount = coupon.amountOff || 0;
  }
  const finalPrice = Math.round((price - discount) * 100) / 100;
  if (finalPrice < MIN_CHARGE[currency]) throw new CouponError("tooLow");
  return {
    code,
    discount: Math.round(discount * 100) / 100,
    finalPrice,
    // Só usa o código da Stripe se ele foi criado na mesma conta (teste/produção) da chave atual.
    stripePromotionCodeId: mode && coupon.stripeMode === mode ? coupon.stripePromotionCodeId : null,
  };
}

/** Cria o cupom no banco e, se a Stripe estiver configurada, o cupom + código promocional nela. */
export async function createCoupon(input: CouponInput, plans: Plan[], stripeKey: string | null) {
  if (await db.coupon.findUnique({ where: { code: input.code } })) throw new Error("Já existe um cupom com esse código");

  let stripeIds: { stripeCouponId: string; stripePromotionCodeId: string; stripeMode: StripeMode } | null = null;
  if (stripeKey) {
    const stripe = stripeClient(stripeKey);
    const mode = stripeMode(stripeKey);
    const products = input.planIds
      .map((id) => plans.find((p) => p.id === id)?.stripe)
      .filter((s) => s?.mode === mode)
      .map((s) => s!.productId);
    const coupon = await stripe.coupons.create({
      name: input.code,
      duration: "once",
      ...(input.kind === "percent"
        ? { percent_off: input.percentOff! }
        : { amount_off: Math.round(input.amountOff! * 100), currency: input.currency!.toLowerCase() }),
      ...(products.length ? { applies_to: { products } } : {}),
      ...(input.maxRedemptions ? { max_redemptions: input.maxRedemptions } : {}),
      ...(input.expiresAt ? { redeem_by: Math.floor(input.expiresAt.getTime() / 1000) } : {}),
      metadata: { source: "vysify-admin" },
    });
    const promo = await stripe.promotionCodes.create({
      promotion: { type: "coupon", coupon: coupon.id },
      code: input.code,
      ...(input.maxRedemptions ? { max_redemptions: input.maxRedemptions } : {}),
      ...(input.expiresAt ? { expires_at: Math.floor(input.expiresAt.getTime() / 1000) } : {}),
    });
    stripeIds = { stripeCouponId: coupon.id, stripePromotionCodeId: promo.id, stripeMode: mode };
  }

  return db.coupon.create({
    data: {
      code: input.code,
      percentOff: input.kind === "percent" ? input.percentOff : null,
      amountOff: input.kind === "amount" ? input.amountOff : null,
      currency: input.kind === "amount" ? input.currency : null,
      planIdsJson: input.planIds.length ? JSON.stringify(input.planIds) : null,
      maxRedemptions: input.maxRedemptions ?? null,
      expiresAt: input.expiresAt ?? null,
      ...(stripeIds || {}),
    },
  });
}

/** Ativa/desativa (o código promocional da Stripe acompanha). */
export async function setCouponActive(id: string, active: boolean, stripeKey: string | null) {
  const coupon = await db.coupon.findUniqueOrThrow({ where: { id } });
  if (stripeKey && coupon.stripePromotionCodeId && coupon.stripeMode === stripeMode(stripeKey)) {
    await stripeClient(stripeKey).promotionCodes.update(coupon.stripePromotionCodeId, { active });
  }
  return db.coupon.update({ where: { id }, data: { active } });
}

/** Apaga um cupom nunca usado; um cupom já usado só é desativado (fica no histórico dos pagamentos). */
export async function deleteCoupon(id: string, stripeKey: string | null): Promise<"deleted" | "deactivated"> {
  const coupon = await db.coupon.findUniqueOrThrow({ where: { id } });
  if ((await couponRedemptions(coupon.code)) > 0) {
    await setCouponActive(id, false, stripeKey);
    return "deactivated";
  }
  if (stripeKey && coupon.stripeCouponId && coupon.stripeMode === stripeMode(stripeKey)) {
    await stripeClient(stripeKey).coupons.del(coupon.stripeCouponId).catch((e) => {
      if ((e as { code?: string }).code !== "resource_missing") throw e;
    });
  }
  await db.coupon.delete({ where: { id } });
  return "deleted";
}
