import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { handler, HttpError, parseBody } from "@/lib/api";
import { requireApiAdmin } from "@/lib/auth";
import { getAppConfig } from "@/lib/config";
import { deleteCoupon, setCouponActive } from "@/lib/coupons";

const patchSchema = z.object({ active: z.boolean() });

// Ativar/desativar. Desconto, validade e limite não mudam depois de criado (a Stripe não permite):
// para mudar, desative e crie outro código.
export const PATCH = handler(async (request: Request, ctx: RouteContext<"/api/admin/coupons/[id]">) => {
  await requireApiAdmin();
  const { id } = await ctx.params;
  const { active } = await parseBody(request, patchSchema);
  if (!(await db.coupon.findUnique({ where: { id } }))) throw new HttpError(404, "Cupom não encontrado");
  const config = await getAppConfig();
  await setCouponActive(id, active, config.secrets.stripeSecretKey);
  return NextResponse.json({ success: true });
});

export const DELETE = handler(async (_request: Request, ctx: RouteContext<"/api/admin/coupons/[id]">) => {
  await requireApiAdmin();
  const { id } = await ctx.params;
  if (!(await db.coupon.findUnique({ where: { id } }))) throw new HttpError(404, "Cupom não encontrado");
  const config = await getAppConfig();
  const result = await deleteCoupon(id, config.secrets.stripeSecretKey);
  return NextResponse.json({ success: true, result });
});
