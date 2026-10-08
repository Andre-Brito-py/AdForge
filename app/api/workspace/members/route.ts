import { NextResponse } from "next/server";
import { z } from "zod";
import { enforceRateLimit, handler, parseBody } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { inviteMember, listTeam } from "@/lib/members";

export const GET = handler(async () => {
  const user = await requireApiUser();
  return NextResponse.json({ ...(await listTeam(user.workspaceId)), me: { id: user.id, role: user.workspaceRole } });
});

const inviteSchema = z.object({
  email: z.email("validation.emailInvalid"),
  role: z.enum(["ADMIN", "MEMBER"]).default("MEMBER"),
});

// Convida por e-mail (dono e admins).
export const POST = handler(async (request: Request) => {
  const user = await requireApiUser({ verified: true });
  await enforceRateLimit(request, "invite", 20, 60 * 60, user.id);
  const { email, role } = await parseBody(request, inviteSchema);
  const invite = await inviteMember(user, email, role);
  return NextResponse.json({ id: invite.id }, { status: 201 });
});
