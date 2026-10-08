import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handler, HttpError, parseBody } from "@/lib/api";
import { requireApiAdmin } from "@/lib/auth";
import { getAppConfig } from "@/lib/config";
import { couponInputSchema, couponPlanIds, createCoupon } from "@/lib/coupons";
import { stripeMode } from "@/lib/stripe-sync";

export const GET = handler(async () => {
  await requireApiAdmin();
  const config = await getAppConfig();
  const mode = config.secrets.stripeSecretKey ? stripeMode(config.secrets.stripeSecretKey) : null;
  const [coupons, uses] = await Promise.all([
    db.coupon.findMany({ orderBy: { createdAt: "desc" } }),
    db.payment.groupBy({ by: ["couponCode"], where: { couponCode: { not: null } }, _count: { _all: true }, _sum: { discount: true } }),
  ]);
  const byCode = new Map(uses.map((u) => [u.couponCode, u]));
  return NextResponse.json({
    stripeMode: mode,
    coupons: coupons.map((c) => ({
      id: c.id,
      code: c.code,
      percentOff: c.percentOff,
      amountOff: c.amountOff,
      currency: c.currency,
      planIds: couponPlanIds(c),
      maxRedemptions: c.maxRedemptions,
      expiresAt: c.expiresAt,
      expired: !!c.expiresAt && c.expiresAt.getTime() < Date.now(),
      active: c.active,
      createdAt: c.createdAt,
      redemptions: byCode.get(c.code)?._count._all ?? 0,
      // Soma em moedas diferentes vira um número só aproximado; o painel mostra como "descontos dados".
      totalDiscount: byCode.get(c.code)?._sum.discount ?? 0,
      // Espelho na Stripe da mesma conta (teste/produção) da chave atual?
      inStripe: !!c.stripePromotionCodeId && !!mode && c.stripeMode === mode,
    })),
  });
});

export const POST = handler(async (request: Request) => {
  await requireApiAdmin();
  const input = await parseBody(request, couponInputSchema);
  const config = await getAppConfig();
  const unknown = input.planIds.filter((id) => !config.plans.some((p) => p.id === id));
  if (unknown.length) throw new HttpError(400, `Pacote inexistente: ${unknown.join(", ")}`);
  try {
    const coupon = await createCoupon(input, config.plans, config.secrets.stripeSecretKey);
    return NextResponse.json({ success: true, id: coupon.id });
  } catch (error) {
    const message = (error as Error).message;
    // Erros da Stripe (ex.: código já usado lá) aparecem para o admin como estão.
    throw new HttpError(400, message.startsWith("Já existe") ? message : `Não foi possível criar o cupom: ${message}`);
  }
});
