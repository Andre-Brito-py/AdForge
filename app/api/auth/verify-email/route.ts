import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { enforceRateLimit, handler, HttpError, parseBody } from "@/lib/api";
import { consumeAuthToken, issueAuthToken } from "@/lib/auth-tokens";
import { requireApiUser } from "@/lib/auth";
import { sendVerificationEmail } from "@/services/email";

// Confirma o e-mail a partir do link recebido.
export const POST = handler(async (request: Request) => {
  await enforceRateLimit(request, "verify-email", 20, 15 * 60);
  const { token } = await parseBody(request, z.object({ token: z.string().min(20).max(200) }));
  const userId = await consumeAuthToken(token, "VERIFY_EMAIL");
  if (!userId) throw new HttpError(400, "Link inválido ou expirado. Peça um novo no seu painel.", "INVALID_TOKEN");
  await db.user.update({ where: { id: userId }, data: { emailVerified: new Date() } });
  return NextResponse.json({ success: true });
});

// Reenvia o e-mail de confirmação para o usuário logado.
export const PUT = handler(async (request: Request) => {
  const user = await requireApiUser();
  if (user.emailVerified) return NextResponse.json({ success: true, alreadyVerified: true });
  await enforceRateLimit(request, "verify-resend", 3, 15 * 60, user.id);
  const token = await issueAuthToken(user.id, "VERIFY_EMAIL");
  await sendVerificationEmail(user.email, user.name || "", token);
  return NextResponse.json({ success: true });
});
