import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handler } from "@/lib/api";
import { requireApiAdmin } from "@/lib/auth";
import { toCsv } from "@/lib/csv";
import { monthlyReport } from "@/lib/fiscal";

/**
 * GET ?year=2026 → notas emitidas/na fila + resumo mensal de vendas.
 * GET ?year=2026&format=csv → planilha de vendas do ano (para o carnê-leão ou o contador).
 */
export const GET = handler(async (request: Request) => {
  await requireApiAdmin();
  const params = new URL(request.url).searchParams;
  const year = Math.min(2100, Math.max(2020, parseInt(params.get("year") || String(new Date().getUTCFullYear()), 10) || new Date().getUTCFullYear()));
  const report = await monthlyReport(year);

  if (params.get("format") === "csv") {
    const csv = toCsv(
      ["Data", "Gateway", "ID do pagamento", "Pacote", "Créditos", "Moeda", "Valor pago", "Desconto", "Cupom", "Estornado", "Situação", "Cliente", "CPF/CNPJ", "País"],
      report.payments.map((p) => [
        p.createdAt.toISOString(), p.provider, p.externalId, p.planId || "", p.credits, p.currency, p.amount.toFixed(2), p.discount.toFixed(2),
        p.couponCode || "", p.refundedAmount.toFixed(2), p.status, p.customerName || "", p.customerTaxId || "", p.customerCountry || "",
      ])
    );
    return new NextResponse(csv, {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="vysify-vendas-${year}.csv"` },
    });
  }

  const invoices = await db.fiscalInvoice.findMany({ orderBy: { createdAt: "desc" }, take: 50 });
  const payments = await db.payment.findMany({ where: { id: { in: invoices.map((i) => i.paymentId) } }, select: { id: true, amount: true, currency: true, customerName: true, createdAt: true } });
  return NextResponse.json({
    year,
    months: report.rows,
    invoices: invoices.map((i) => ({ ...i, payment: payments.find((p) => p.id === i.paymentId) || null })),
  });
});
