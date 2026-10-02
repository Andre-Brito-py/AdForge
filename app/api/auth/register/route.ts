import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAppConfig } from "@/lib/config";
import { enforceRateLimit, handler, HttpError, parseBody } from "@/lib/api";
import { registerSchema } from "@/lib/validation";
import { hashPassword } from "@/lib/password";
import { createUserWithWorkspace } from "@/lib/users";
import { requestOrigin } from "@/lib/auth";
import { issueAuthToken } from "@/lib/auth-tokens";
import { sendVerificationEmail, sendWelcomeEmail } from "@/services/email";

export const POST = handler(async (request: Request) => {
  await enforceRateLimit(request, "register", 5, 60 * 60);
  if (!(await getAppConfig()).signupsEnabled) throw new HttpError(403, "errors.signupsClosed", "SIGNUPS_CLOSED");
  const data = await parseBody(request, registerSchema);

  const existing = await db.user.findUnique({ where: { email: data.email } });
  if (existing) {
    throw new HttpError(409, "errors.emailTaken", "EMAIL_TAKEN");
  }

  const { user } = await createUserWithWorkspace({
    email: data.email,
    name: data.name,
    passwordHash: await hashPassword(data.password),
    ...(await requestOrigin()),
  });

  const token = await issueAuthToken(user.id, "VERIFY_EMAIL");
  await Promise.all([
    sendVerificationEmail(user.email, user.name || "", token, user.locale),
    sendWelcomeEmail(user.email, user.name || "", user.locale),
  ]);

  return NextResponse.json({ success: true }, { status: 201 });
});
