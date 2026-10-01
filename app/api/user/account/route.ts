import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { enforceRateLimit, handler, HttpError, parseBody } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { verifyPassword } from "@/lib/password";
import { deletePrefix } from "@/lib/storage";
import { getMetaConnection } from "@/lib/meta/connection";
import { revokePermissions } from "@/lib/meta/graph";

// LGPD (art. 18, V): portabilidade. Exporta os dados pessoais e de uso da conta em JSON.
export const GET = handler(async () => {
  const user = await requireApiUser();
  const [profile, products, campaigns, transactions, payments, brand] = await Promise.all([
    db.user.findUnique({
      where: { id: user.id },
      select: { email: true, name: true, createdAt: true, emailVerified: true, onboardingRole: true, onboardingGoal: true, notifyOnComplete: true, marketingOptIn: true },
    }),
    db.product.findMany({ where: { workspaceId: user.workspaceId } }),
    db.campaign.findMany({ where: { workspaceId: user.workspaceId }, include: { creatives: true } }),
    db.creditTransaction.findMany({ where: { workspaceId: user.workspaceId }, orderBy: { createdAt: "desc" } }),
    db.payment.findMany({ where: { userId: user.id } }),
    db.brandKit.findUnique({ where: { workspaceId: user.workspaceId } }),
  ]);

  const body = JSON.stringify({ exportedAt: new Date().toISOString(), profile, brand, products, campaigns, transactions, payments }, null, 2);
  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="vysify-meus-dados.json"`,
    },
  });
});

const deleteSchema = z.object({
  password: z.string().max(128).optional(),
  confirmation: z.literal("EXCLUIR", { message: 'Digite EXCLUIR para confirmar' }),
});

// LGPD (art. 18, VI): eliminação. Apaga a conta, os workspaces em que é o único membro e os arquivos.
export const DELETE = handler(async (request: Request) => {
  const user = await requireApiUser();
  await enforceRateLimit(request, "delete-account", 5, 60 * 60, user.id);
  const { password } = await parseBody(request, deleteSchema);

  const record = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { passwordHash: true } });
  if (record.passwordHash && !(await verifyPassword(password || "", record.passwordHash))) {
    throw new HttpError(400, "Senha incorreta", "WRONG_PASSWORD");
  }

  const memberships = await db.workspaceMember.findMany({
    where: { userId: user.id },
    include: { workspace: { include: { _count: { select: { members: true } } } } },
  });
  const soloWorkspaces = memberships.filter((m) => m.workspace._count.members === 1).map((m) => m.workspaceId);

  // Revoga o acesso da Vysify às contas da Meta antes de apagar os tokens.
  for (const ws of soloWorkspaces) {
    const conn = await getMetaConnection(ws);
    if (conn?.token) await revokePermissions(conn.token);
  }

  await db.$transaction([
    db.workspace.deleteMany({ where: { id: { in: soloWorkspaces } } }),
    db.user.delete({ where: { id: user.id } }),
  ]);

  for (const ws of soloWorkspaces) {
    for (const folder of ["uploads", "creatives", "audio", "published"]) {
      await deletePrefix(`${folder}/${ws}/`).catch((e) => console.error("[account] falha ao apagar arquivos", e));
    }
  }
  return NextResponse.json({ success: true });
});
