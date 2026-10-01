import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handler, parseBody } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { onboardingSchema } from "@/lib/validation";

export const POST = handler(async (request: Request) => {
  const user = await requireApiUser();
  const { role, goal } = await parseBody(request, onboardingSchema);
  await db.user.update({
    where: { id: user.id },
    data: { onboardingCompleted: true, onboardingRole: role, onboardingGoal: goal },
  });
  return NextResponse.json({ success: true });
});
