import { Prisma } from "@prisma/client";
import { db } from "./db";
import { grantCredits } from "@/services/credits";
import { sendPurchaseReceipt } from "@/services/email";
import { formatMoney } from "./format";
import { notifyAdmins } from "./admin-alerts";

export interface PurchaseInput {
  provider: "STRIPE" | "MERCADOPAGO";
  externalId: string;
  userId: string;
  workspaceId: string;
  planId: string | null;
  planName: string;
  credits: number;
  amount: number;
  currency: string;
  couponCode?: string | null;
  discount?: number;
}

/**
 * Registra a compra e credita o saldo numa transação.
 * A constraint única (provider, externalId) garante que reenvios do webhook
 * nunca creditem duas vezes.
 */
export async function recordPurchase(input: PurchaseInput): Promise<"credited" | "duplicate"> {
  if (!Number.isInteger(input.credits) || input.credits <= 0) throw new Error("Créditos inválidos no pagamento");
  const user = await db.user.findUnique({ where: { id: input.userId } });
  const en = user?.locale === "en";

  try {
    await db.$transaction(async (tx) => {
      await tx.payment.create({
        data: {
          provider: input.provider,
          externalId: input.externalId,
          userId: input.userId,
          workspaceId: input.workspaceId,
          planId: input.planId,
          credits: input.credits,
          amount: input.amount,
          currency: input.currency.toUpperCase(),
          couponCode: input.couponCode || null,
          discount: input.discount && input.discount > 0 ? input.discount : 0,
        },
      });
      await grantCredits(
        {
          workspaceId: input.workspaceId,
          userId: input.userId,
          amount: input.credits,
          type: "PURCHASE",
          description: en ? `${input.planName} pack purchase` : `Compra do pacote ${input.planName}`,
          referenceId: `${input.provider}:${input.externalId}`,
        },
        tx
      );
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return "duplicate";
    throw error;
  }

  if (user) {
    await sendPurchaseReceipt(user.email, user.name || "", input.planName, input.credits, formatMoney(input.amount, input.currency.toUpperCase(), user.locale), user.locale).catch(console.error);
  }
  return "credited";
}

/** Créditos a retirar por um estorno: proporcionais ao valor devolvido (estorno total = todos). */
export function creditsToClawBack(credits: number, amount: number, refundedTotal: number) {
  if (amount <= 0 || refundedTotal >= amount - 0.005) return credits;
  return Math.min(credits, Math.round((credits * refundedTotal) / amount));
}

export type RefundResult = "unknown" | "unchanged" | { removed: number; shortfall: number };

/**
 * Estorno (ou chargeback) feito no gateway: retira os créditos correspondentes.
 * `refundedTotal` é o total já devolvido desse pagamento (não só o deste aviso), então reenvios do
 * webhook e estornos parciais em sequência nunca retiram créditos a mais.
 * Créditos que o cliente já gastou não podem ser retirados (o saldo nunca fica negativo): o admin é avisado.
 */
export async function recordRefund(input: { provider: PurchaseInput["provider"]; externalId: string; refundedTotal: number; reason?: string }): Promise<RefundResult> {
  const payment = await db.payment.findUnique({ where: { provider_externalId: { provider: input.provider, externalId: input.externalId } } });
  if (!payment) return "unknown";

  const target = creditsToClawBack(payment.credits, payment.amount, input.refundedTotal);
  const pending = target - payment.refundedCredits;
  const full = target >= payment.credits;
  if (pending <= 0 && input.refundedTotal <= payment.refundedAmount) return "unchanged";

  const result = await db.$transaction(async (tx) => {
    // Trava a linha do pagamento: dois avisos simultâneos não retiram os mesmos créditos.
    const fresh = await tx.$queryRaw<{ refundedCredits: number }[]>`SELECT "refundedCredits" FROM "Payment" WHERE id = ${payment.id} FOR UPDATE`;
    const toRemove = target - (fresh[0]?.refundedCredits ?? 0);
    let removed = 0;
    // Conta já excluída (userId nulo): não há saldo a retirar.
    if (toRemove > 0 && payment.userId) {
      const balance = await tx.creditBalance.findUnique({ where: { workspaceId: payment.workspaceId } });
      removed = Math.min(toRemove, Math.max(0, balance?.balance ?? 0));
      if (removed > 0) {
        await tx.creditBalance.update({ where: { workspaceId: payment.workspaceId }, data: { balance: { decrement: removed } } });
        await tx.creditTransaction.create({
          data: {
            userId: payment.userId,
            workspaceId: payment.workspaceId,
            amount: -removed,
            type: "ADJUSTMENT",
            description: `Estorno do pagamento (${input.provider === "STRIPE" ? "Stripe" : "Mercado Pago"})`,
            referenceId: `${input.provider}:${input.externalId}`,
          },
        });
      }
    }
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        refundedAmount: Math.max(payment.refundedAmount, input.refundedTotal),
        refundedCredits: Math.max(target, fresh[0]?.refundedCredits ?? 0),
        status: full ? "REFUNDED" : "PARTIALLY_REFUNDED",
      },
    });
    return { removed, shortfall: payment.userId ? Math.max(0, toRemove - removed) : 0 };
  });

  if (result.shortfall > 0) {
    const owner = payment.userId ? await db.user.findUnique({ where: { id: payment.userId }, select: { email: true } }) : null;
    await notifyAdmins("Estorno com créditos já usados", [
      `O pagamento ${input.externalId} (${input.provider}) de ${owner?.email || payment.workspaceId} foi estornado${input.reason ? ` (${input.reason})` : ""}.`,
      `Retiramos ${result.removed} créditos; ${result.shortfall} já tinham sido usados e não puderam ser retirados.`,
      "Avalie se é preciso alguma ação (ex.: contestação no gateway ou bloqueio da conta).",
    ]);
  }
  return result;
}
