import { NextResponse } from "next/server";
import { handler } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { cancelInvite } from "@/lib/members";

export const DELETE = handler(async (_request: Request, ctx: RouteContext<"/api/workspace/invites/[id]">) => {
  const user = await requireApiUser();
  const { id } = await ctx.params;
  await cancelInvite(user, id);
  return NextResponse.json({ success: true });
});
