import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { handler, HttpError, parseBody } from "@/lib/api";
import { requireApiAdmin } from "@/lib/auth";
import { getWorkspaceIdForUser } from "@/lib/users";
import { deductForAdjustment, getWorkspaceBalance, grantCredits, InsufficientCreditsError } from "@/services/credits";

const bodySchema = z.object({
  amount: z.number().int().refine((v) => v !== 0 && Math.abs(v) <= 100_000, "Valor inválido"),
  reason: z.string().trim().min(3, "Informe o motivo").max(200),
});

// Ajuste manual de créditos (bônus, compensação de suporte, correção).
export const POST = handler(async (request: Request, ctx: RouteContext<"/api/admin/users/[id]/credits">) => {
  const admin = await requireApiAdmin();
  const { id } = await ctx.params;
  const { amount, reason } = await parseBody(request, bodySchema);

  const target = await db.user.findUnique({ where: { id } });
  if (!target) throw new HttpError(404, "Usuário não encontrado");
  const workspaceId = await getWorkspaceIdForUser(id);
  if (!workspaceId) throw new HttpError(404, "Workspace não encontrado");

  const description = `${reason} (ajuste por ${admin.email})`;
  try {
    if (amount > 0) {
      await grantCredits({ workspaceId, userId: id, amount, type: "BONUS", description });
    } else {
      await deductForAdjustment(workspaceId, id, -amount, description);
    }
  } catch (error) {
    if (error instanceof InsufficientCreditsError) throw new HttpError(400, error.message);
    throw error;
  }
  return NextResponse.json({ success: true, balance: await getWorkspaceBalance(workspaceId) });
});
