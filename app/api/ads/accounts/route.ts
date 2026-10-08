import { NextResponse } from "next/server";
import { handler } from "@/lib/api";
import { requireApiManager } from "@/lib/auth";
import { listAdAccounts } from "@/lib/meta/ads";

// Contas de anúncio da pessoa conectada à Meta.
export const GET = handler(async () => {
  const user = await requireApiManager();
  return NextResponse.json(await listAdAccounts(user.workspaceId));
});
