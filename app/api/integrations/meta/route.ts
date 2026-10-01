import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { enforceRateLimit, handler, HttpError } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { fetchAssets, MetaApiError, revokePermissions } from "@/lib/meta/graph";
import { getMetaConnection, markConnectionExpired } from "@/lib/meta/connection";

// Atualiza a lista de Páginas/contas do Instagram (ex.: o cliente criou uma Página nova).
export const POST = handler(async (request: Request) => {
  const user = await requireApiUser();
  await enforceRateLimit(request, "meta-refresh", 20, 15 * 60, user.id);
  const conn = await getMetaConnection(user.workspaceId);
  if (!conn?.token) throw new HttpError(404, "Nenhuma conta da Meta conectada");
  try {
    const assets = await fetchAssets(conn.token);
    await db.connection.update({ where: { id: conn.id }, data: { assetsJson: JSON.stringify(assets), status: "ACTIVE" } });
    return NextResponse.json({ success: true, assets });
  } catch (error) {
    if (error instanceof MetaApiError && error.isAuthError) {
      await markConnectionExpired(conn.id);
      throw new HttpError(409, "A conexão expirou. Conecte novamente.", "META_EXPIRED");
    }
    throw error;
  }
});

// Desconecta: revoga as permissões na Meta e apaga o token.
export const DELETE = handler(async () => {
  const user = await requireApiUser();
  const conn = await getMetaConnection(user.workspaceId);
  if (!conn) return NextResponse.json({ success: true });
  if (conn.token) await revokePermissions(conn.token);
  await db.connection.delete({ where: { id: conn.id } });
  return NextResponse.json({ success: true });
});
