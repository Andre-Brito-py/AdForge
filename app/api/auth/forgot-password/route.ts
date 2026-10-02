import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { enforceRateLimit, handler, parseBody } from "@/lib/api";
import { forgotPasswordSchema } from "@/lib/validation";
import { issueAuthToken } from "@/lib/auth-tokens";
import { sendPasswordResetEmail } from "@/services/email";

export const POST = handler(async (request: Request) => {
  await enforceRateLimit(request, "forgot", 5, 15 * 60);
  const { email } = await parseBody(request, forgotPasswordSchema);
  await enforceRateLimit(request, "forgot-email", 3, 60 * 60, email);

  const user = await db.user.findUnique({ where: { email } });
  if (user) {
    const token = await issueAuthToken(user.id, "RESET_PASSWORD");
    await sendPasswordResetEmail(user.email, token, user.locale);
  }
  // Sempre a mesma resposta: não revelamos se o e-mail está cadastrado.
  return NextResponse.json({ success: true });
});
