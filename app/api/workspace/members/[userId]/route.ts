import { NextResponse } from "next/server";
import { z } from "zod";
import { handler, parseBody } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { changeRole, removeMember } from "@/lib/members";

const patchSchema = z.object({ role: z.enum(["ADMIN", "MEMBER"]) });

// Muda o papel (só o dono).
export const PATCH = handler(async (request: Request, ctx: RouteContext<"/api/workspace/members/[userId]">) => {
  const user = await requireApiUser();
  const { userId } = await ctx.params;
  const { role } = await parseBody(request, patchSchema);
  await changeRole(user, userId, role);
  return NextResponse.json({ success: true });
});

// Remove alguém, ou sai do workspace (o próprio id).
export const DELETE = handler(async (_request: Request, ctx: RouteContext<"/api/workspace/members/[userId]">) => {
  const user = await requireApiUser();
  const { userId } = await ctx.params;
  await removeMember(user, userId);
  return NextResponse.json({ success: true });
});
