import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { enforceRateLimit, handler, HttpError, parseBody } from "@/lib/api";
import { resetPasswordSchema } from "@/lib/validation";
import { consumeAuthToken } from "@/lib/auth-tokens";
import { hashPassword } from "@/lib/password";

export const POST = handler(async (request: Request) => {
  await enforceRateLimit(request, "reset", 10, 15 * 60);
  const { token, password } = await parseBody(request, resetPasswordSchema);

  const userId = await consumeAuthToken(token, "RESET_PASSWORD");
  if (!userId) throw new HttpError(400, "errors.resetLinkInvalid", "INVALID_TOKEN");

  await db.user.update({
    where: { id: userId },
    data: {
      passwordHash: await hashPassword(password),
      // Quem recebeu o link provou ter acesso ao e-mail.
      emailVerified: new Date(),
      failedLoginAttempts: 0,
      lockedUntil: null,
      // Derruba todas as sessões abertas com a senha antiga.
      sessionVersion: { increment: 1 },
    },
  });
  return NextResponse.json({ success: true });
});
