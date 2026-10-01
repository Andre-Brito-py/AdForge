import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

type Tx = Prisma.TransactionClient;

export class InsufficientCreditsError extends Error {
  constructor(message = "Saldo de créditos insuficiente para esta operação.") {
    super(message);
    this.name = "InsufficientCreditsError";
  }
}

function assertPositiveInt(amount: number) {
  if (!Number.isInteger(amount) || amount <= 0) {
    // Nunca permitir valores negativos/fracionados: seria uma forma de "gerar" créditos.
    throw new Error(`Quantidade de créditos inválida: ${amount}`);
  }
}

interface ConsumeInput {
  workspaceId: string;
  userId: string;
  amount: number;
  description: string;
  referenceId?: string;
  usage?: { operation: string; provider: string; model: string; estimatedCostUsd: number };
}

/**
 * Debita créditos de forma atômica. O UPDATE condicional (balance >= amount) é
 * resolvido pelo próprio Postgres, então duas requisições simultâneas não conseguem
 * gastar o mesmo saldo.
 */
export async function consumeCredits(input: ConsumeInput, tx?: Tx) {
  assertPositiveInt(input.amount);
  const run = async (client: Tx) => {
    const updated = await client.creditBalance.updateMany({
      where: { workspaceId: input.workspaceId, balance: { gte: input.amount } },
      data: { balance: { decrement: input.amount } },
    });
    if (updated.count === 0) throw new InsufficientCreditsError();

    await client.creditTransaction.create({
      data: {
        userId: input.userId,
        workspaceId: input.workspaceId,
        amount: -input.amount,
        type: "CONSUME",
        description: input.description,
        referenceId: input.referenceId,
      },
    });
    if (input.usage) {
      await client.usageRecord.create({
        data: {
          userId: input.userId,
          operation: input.usage.operation,
          provider: input.usage.provider,
          model: input.usage.model,
          credits: input.amount,
          estimatedCost: input.usage.estimatedCostUsd,
        },
      });
    }
  };
  return tx ? run(tx) : db.$transaction(run);
}

interface GrantInput {
  workspaceId: string;
  userId: string;
  amount: number;
  type: "PURCHASE" | "REFUND" | "BONUS" | "ADJUSTMENT";
  description: string;
  referenceId?: string;
}

export async function grantCredits(input: GrantInput, tx?: Tx) {
  assertPositiveInt(input.amount);
  const run = async (client: Tx) => {
    await client.creditBalance.upsert({
      where: { workspaceId: input.workspaceId },
      update: { balance: { increment: input.amount } },
      create: { workspaceId: input.workspaceId, userId: input.userId, balance: input.amount },
    });
    await client.creditTransaction.create({
      data: {
        userId: input.userId,
        workspaceId: input.workspaceId,
        amount: input.amount,
        type: input.type,
        description: input.description,
        referenceId: input.referenceId,
      },
    });
  };
  return tx ? run(tx) : db.$transaction(run);
}

/** Remove créditos por ajuste administrativo (nunca deixa o saldo negativo). */
export async function deductForAdjustment(workspaceId: string, userId: string, amount: number, description: string) {
  assertPositiveInt(amount);
  return db.$transaction(async (tx) => {
    const updated = await tx.creditBalance.updateMany({
      where: { workspaceId, balance: { gte: amount } },
      data: { balance: { decrement: amount } },
    });
    if (updated.count === 0) throw new InsufficientCreditsError("O saldo do usuário é menor que o valor a remover.");
    await tx.creditTransaction.create({
      data: { userId, workspaceId, amount: -amount, type: "ADJUSTMENT", description },
    });
  });
}

export async function getWorkspaceBalance(workspaceId: string): Promise<number> {
  const record = await db.creditBalance.findUnique({ where: { workspaceId } });
  return record?.balance ?? 0;
}
