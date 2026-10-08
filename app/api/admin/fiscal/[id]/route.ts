import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handler, HttpError } from "@/lib/api";
import { requireApiAdmin } from "@/lib/auth";
import { invoicePdf } from "@/lib/fiscal";

// PDF da nota emitida.
export const GET = handler(async (_request: Request, ctx: RouteContext<"/api/admin/fiscal/[id]">) => {
  await requireApiAdmin();
  const { id } = await ctx.params;
  const res = await invoicePdf(id);
  if (!res || !res.ok) throw new HttpError(404, "PDF indisponível");
  return new NextResponse(await res.arrayBuffer(), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="nfse-${id.slice(0, 8)}.pdf"` },
  });
});

// Tentar emitir de novo (nota que falhou).
export const POST = handler(async (_request: Request, ctx: RouteContext<"/api/admin/fiscal/[id]">) => {
  await requireApiAdmin();
  const { id } = await ctx.params;
  const updated = await db.fiscalInvoice.updateMany({ where: { id, status: "FAILED" }, data: { status: "PENDING", attempts: 0, error: null, externalId: null } });
  if (updated.count === 0) throw new HttpError(400, "Só notas com falha podem ser reenviadas");
  return NextResponse.json({ success: true });
});
