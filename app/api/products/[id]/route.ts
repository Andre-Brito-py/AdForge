import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handler, HttpError } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";

export const DELETE = handler(async (_request: Request, ctx: RouteContext<"/api/products/[id]">) => {
  const { id } = await ctx.params;
  const user = await requireApiUser();

  const product = await db.product.findFirst({
    where: { id, workspaceId: user.workspaceId },
    include: { campaigns: { where: { status: "GENERATING" }, select: { id: true } } },
  });
  if (!product) throw new HttpError(404, "errors.productNotFound");
  if (product.campaigns.length > 0) throw new HttpError(409, "errors.waitCampaignsDelete");

  await db.product.delete({ where: { id } });
  return NextResponse.json({ success: true });
});
