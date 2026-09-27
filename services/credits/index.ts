import { db } from "@/lib/db";

export class InsufficientCreditsError extends Error {
  constructor(message = "Saldo de créditos insuficiente para esta operação.") {
    super(message);
    this.name = "InsufficientCreditsError";
  }
}

/**
 * Deduz créditos do workspace e registra a transação.
 * Joga um erro caso o saldo seja insuficiente.
 */
export async function consumeCredits(
  workspaceId: string,
  userId: string,
  amount: number,
  operation: string,
  provider: string,
  model: string,
  estimatedCostUsd: number
) {
  return await db.$transaction(async (tx) => {
    // 1. Pegar o saldo atual com lock para evitar race conditions
    const balanceRecord = await tx.creditBalance.findUnique({
      where: { workspaceId },
    });

    if (!balanceRecord || balanceRecord.balance < amount) {
      throw new InsufficientCreditsError();
    }

    // 2. Deduzir o saldo
    await tx.creditBalance.update({
      where: { workspaceId },
      data: { balance: { decrement: amount } },
    });

    // 3. Registrar a Transação Financeira (Histórico de carteira)
    await tx.creditTransaction.create({
      data: {
        userId,
        workspaceId,
        amount: -amount,
        type: "CONSUME",
        description: `Consumo gerado por: ${operation}`,
      },
    });

    // 4. Registrar o Uso Detalhado da IA (Analytics / Custo real)
    await tx.usageRecord.create({
      data: {
        userId,
        operation,
        provider,
        model,
        credits: amount,
        estimatedCost: estimatedCostUsd,
      },
    });

    return true;
  });
}

/**
 * Consulta o saldo atual de um workspace
 */
export async function getWorkspaceBalance(workspaceId: string): Promise<number> {
  const record = await db.creditBalance.findUnique({
    where: { workspaceId }
  });
  return record?.balance || 0;
}
