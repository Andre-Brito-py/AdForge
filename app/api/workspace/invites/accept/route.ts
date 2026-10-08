import { NextResponse } from "next/server";
import { z } from "zod";
import { enforceRateLimit, handler, parseBody } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { acceptInvite } from "@/lib/members";

const bodySchema = z.object({ token: z.string().min(20).max(100) });

export const POST = handler(async (request: Request) => {
  const user = await requireApiUser();
  await enforceRateLimit(request, "invite-accept", 20, 60 * 60, user.id);
  const { token } = await parseBody(request, bodySchema);
  const workspace = await acceptInvite(user, token);
  return NextResponse.json({ success: true, workspace });
});
