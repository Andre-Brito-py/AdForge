import { Prisma } from "@prisma/client";
import { db } from "./db";
import { grantCredits } from "@/services/credits";
import { sendPurchaseReceipt } from "@/services/email";
import { formatMoney } from "./format";

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
