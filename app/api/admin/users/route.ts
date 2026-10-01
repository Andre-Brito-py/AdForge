import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handler } from "@/lib/api";
import { requireApiAdmin } from "@/lib/auth";

export const GET = handler(async (request: Request) => {
  await requireApiAdmin();
  const q = new URL(request.url).searchParams.get("q")?.trim().slice(0, 100) || "";

  const users = await db.user.findMany({
    where: q ? { OR: [{ email: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }] } : {},
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true, email: true, name: true, role: true, createdAt: true, emailVerified: true, twoFactorEnabled: true,
      workspaces: { take: 1, select: { workspace: { select: { id: true, creditBalance: { select: { balance: true } }, _count: { select: { campaigns: true } } } } } },
    },
  });

  return NextResponse.json(
    users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      createdAt: u.createdAt,
      emailVerified: !!u.emailVerified,
      twoFactorEnabled: u.twoFactorEnabled,
      workspaceId: u.workspaces[0]?.workspace.id || null,
      balance: u.workspaces[0]?.workspace.creditBalance?.balance ?? 0,
      campaigns: u.workspaces[0]?.workspace._count.campaigns ?? 0,
    }))
  );
});
