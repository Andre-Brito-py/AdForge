import { NextResponse } from "next/server";
import { z } from "zod";
import { handler, parseBody } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { renameWorkspace, switchWorkspace } from "@/lib/members";
import { listUserWorkspaces } from "@/lib/workspaces";

// Workspaces da pessoa (seletor do menu).
export const GET = handler(async () => {
  const user = await requireApiUser();
  return NextResponse.json({ current: user.workspaceId, workspaces: await listUserWorkspaces(user.id) });
});

const patchSchema = z.union([
  z.object({ switchTo: z.uuid() }),
  z.object({ name: z.string().trim().min(2, "validation.nameMin").max(80) }),
]);

// Troca o workspace em uso, ou renomeia o atual (dono/admin).
export const PATCH = handler(async (request: Request) => {
  const user = await requireApiUser();
  const body = await parseBody(request, patchSchema);
  if ("switchTo" in body) await switchWorkspace(user.id, body.switchTo);
  else await renameWorkspace(user, body.name);
  return NextResponse.json({ success: true });
});
