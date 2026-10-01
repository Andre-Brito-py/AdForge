import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { enforceRateLimit, handler, HttpError, parseBody } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { changePasswordSchema } from "@/lib/validation";
import { hashPassword, verifyPassword } from "@/lib/password";

// Troca (ou cria, para contas Google) a senha. Encerra as outras sessões.
export const POST = handler(async (request: Request) => {
  const user = await requireApiUser();
  await enforceRateLimit(request, "change-password", 5, 15 * 60, user.id);
  const { currentPassword, newPassword } = await parseBody(request, changePasswordSchema);

  const record = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { passwordHash: true } });
  if (record.passwordHash && !(await verifyPassword(currentPassword || "", record.passwordHash))) {
    throw new HttpError(400, "Senha atual incorreta", "WRONG_PASSWORD");
  }

  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(newPassword), sessionVersion: { increment: 1 } },
  });
  return NextResponse.json({ success: true, reloginRequired: true });
});
