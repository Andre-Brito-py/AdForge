import { db } from "./db";
import { getAppConfig } from "./config";
import { notifyAdmins } from "./admin-alerts";

/**
 * Nota fiscal de serviço (NFS-e) pelas vendas em reais, emitida pela NFE.io.
 * Fica DESLIGADA até o admin ter CNPJ, cadastrar a empresa na NFE.io e preencher Admin › Fiscal.
 * Enquanto isso, o relatório mensal (monthlyReport) ajuda na declaração (carnê-leão / contador).
 */
const NFEIO_BASE = (process.env.NFEIO_BASE_URL || "https://api.nfe.io/v1").replace(/\/$/, "");
const MAX_ATTEMPTS = 5;

async function fiscalConfig() {
  const config = await getAppConfig();
  const f = config.settings.fiscal;
  const apiKey = config.secrets.nfeioApiKey;
  const ready = f.enabled && !!apiKey && !!f.companyId && !!f.cityServiceCode;
  return { ...f, apiKey, ready };
}

async function nfeio<T>(apiKey: string, path: string, init: { method?: string; json?: unknown } = {}): Promise<{ status: number; data: T }> {
  const res = await fetch(`${NFEIO_BASE}${path}`, {
    method: init.method || "GET",
    headers: { Authorization: apiKey, "Content-Type": "application/json", Accept: "application/json" },
    body: init.json !== undefined ? JSON.stringify(init.json) : undefined,
    signal: AbortSignal.timeout(30_000),
  });
  const data = (await res.json().catch(() => ({}))) as T & { message?: string; errors?: { message?: string }[] };
  if (!res.ok) {
    const msg = data?.message || data?.errors?.map((e) => e.message).join("; ") || `NFE.io ${res.status}`;
    throw new Error(String(msg).slice(0, 400));
  }
  return { status: res.status, data };
}

/** Pagamento aprovado: entra na fila de emissão (só reais, só com a emissão ligada). */
export async function queueInvoice(payment: { id: string; currency: string }) {
  const f = await fiscalConfig();
  if (!f.ready || payment.currency.toUpperCase() !== "BRL") return null;
  return db.fiscalInvoice.upsert({ where: { paymentId: payment.id }, update: {}, create: { paymentId: payment.id, provider: "NFEIO" } });
}

function borrowerFor(payment: { customerName: string | null; customerTaxId: string | null }, user: { name: string | null; email: string } | null) {
  const digits = (payment.customerTaxId || "").replace(/\D/g, "");
  return {
    name: (payment.customerName || user?.name || user?.email || "Consumidor").slice(0, 115),
    ...(digits.length === 11 || digits.length === 14 ? { federalTaxNumber: Number(digits) } : {}),
    ...(user?.email ? { email: user.email } : {}),
  };
}

/** Cron: emite as notas na fila e acompanha as que a prefeitura ainda está processando. */
export async function processInvoices(limit = 10) {
  const f = await fiscalConfig();
  if (!f.ready || !f.apiKey || !f.companyId) return 0;
  const pending = await db.fiscalInvoice.findMany({
    where: { status: { in: ["PENDING", "PROCESSING"] }, attempts: { lt: MAX_ATTEMPTS } },
    orderBy: { updatedAt: "asc" },
    take: limit,
  });
  for (const inv of pending) {
    try {
      if (inv.status === "PENDING") {
        const payment = await db.payment.findUnique({ where: { id: inv.paymentId } });
        if (!payment || payment.status === "REFUNDED") {
          await db.fiscalInvoice.update({ where: { id: inv.id }, data: { status: "CANCELED", error: "Pagamento estornado antes da emissão" } });
          continue;
        }
        const user = payment.userId ? await db.user.findUnique({ where: { id: payment.userId }, select: { name: true, email: true } }) : null;
        const { data } = await nfeio<{ id?: string; flowStatus?: string; number?: number }>(f.apiKey, `/companies/${f.companyId}/serviceinvoices`, {
          method: "POST",
          json: {
            cityServiceCode: f.cityServiceCode,
            description: `${f.description} Pedido ${payment.provider}:${payment.externalId}.`.slice(0, 2000),
            servicesAmount: Math.round(payment.amount * 100) / 100,
            borrower: borrowerFor(payment, user),
          },
        });
        await db.fiscalInvoice.update({
          where: { id: inv.id },
          data: { status: data.flowStatus === "Issued" ? "ISSUED" : "PROCESSING", externalId: data.id || null, number: data.number ? String(data.number) : null, attempts: { increment: 1 }, error: null },
        });
      } else if (inv.externalId) {
        const { data } = await nfeio<{ flowStatus?: string; flowMessage?: string; number?: number }>(f.apiKey, `/companies/${f.companyId}/serviceinvoices/${inv.externalId}`);
        if (data.flowStatus === "Issued") {
          await db.fiscalInvoice.update({ where: { id: inv.id }, data: { status: "ISSUED", number: data.number ? String(data.number) : inv.number } });
        } else if (data.flowStatus === "IssueFailed") {
          await failInvoice(inv.id, data.flowMessage || "A prefeitura recusou a nota");
        } else {
          await db.fiscalInvoice.update({ where: { id: inv.id }, data: { attempts: { increment: 1 } } });
        }
      }
    } catch (error) {
      const message = (error as Error).message;
      const updated = await db.fiscalInvoice.update({ where: { id: inv.id }, data: { attempts: { increment: 1 }, error: message.slice(0, 500) } });
      if (updated.attempts >= MAX_ATTEMPTS) await failInvoice(inv.id, message);
    }
  }
  return pending.length;
}

async function failInvoice(id: string, message: string) {
  await db.fiscalInvoice.update({ where: { id }, data: { status: "FAILED", error: message.slice(0, 500) } });
  await notifyAdmins("Nota fiscal não emitida", [
    `A emissão de uma NFS-e falhou: ${message.slice(0, 300)}`,
    "Confira em Admin › Fiscal e emita de novo (ou manualmente no portal da prefeitura).",
  ]);
}

/** Estorno total: cancela a nota já emitida (melhor esforço; falhas aparecem no Admin). */
export async function cancelInvoiceForPayment(paymentId: string) {
  const inv = await db.fiscalInvoice.findUnique({ where: { paymentId } });
  if (!inv) return;
  if (inv.status === "PENDING") {
    await db.fiscalInvoice.update({ where: { id: inv.id }, data: { status: "CANCELED", error: "Pagamento estornado antes da emissão" } });
    return;
  }
  const f = await fiscalConfig();
  if (inv.status !== "ISSUED" || !inv.externalId || !f.apiKey || !f.companyId) return;
  try {
    await nfeio(f.apiKey, `/companies/${f.companyId}/serviceinvoices/${inv.externalId}`, { method: "DELETE" });
    await db.fiscalInvoice.update({ where: { id: inv.id }, data: { status: "CANCELED", error: null } });
  } catch (error) {
    await db.fiscalInvoice.update({ where: { id: inv.id }, data: { error: `Cancelamento falhou: ${(error as Error).message}`.slice(0, 500) } });
  }
}

/** PDF da nota (para o admin baixar). */
export async function invoicePdf(invoiceId: string): Promise<Response | null> {
  const inv = await db.fiscalInvoice.findUnique({ where: { id: invoiceId } });
  const f = await fiscalConfig();
  if (!inv?.externalId || !f.apiKey || !f.companyId) return null;
  return fetch(`${NFEIO_BASE}/companies/${f.companyId}/serviceinvoices/${inv.externalId}/pdf`, {
    headers: { Authorization: f.apiKey },
    redirect: "follow",
    signal: AbortSignal.timeout(30_000),
  });
}

/**
 * Relatório mensal de vendas (por moeda): bruto, descontos, estornos e líquido.
 * Serve para o carnê-leão (pessoa física) ou para o contador, inclusive antes de ter CNPJ.
 */
export async function monthlyReport(year: number) {
  const payments = await db.payment.findMany({
    where: { createdAt: { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) } },
    orderBy: { createdAt: "asc" },
  });
  const months = new Map<string, { month: string; currency: string; count: number; gross: number; discounts: number; refunds: number }>();
  for (const p of payments) {
    const month = p.createdAt.toISOString().slice(0, 7);
    const key = `${month}|${p.currency}`;
    const row = months.get(key) || { month, currency: p.currency, count: 0, gross: 0, discounts: 0, refunds: 0 };
    row.count += 1;
    row.gross += p.amount;
    row.discounts += p.discount;
    row.refunds += p.refundedAmount;
    months.set(key, row);
  }
  return {
    rows: [...months.values()].map((r) => ({ ...r, net: Math.round((r.gross - r.refunds) * 100) / 100 })),
    payments,
  };
}
