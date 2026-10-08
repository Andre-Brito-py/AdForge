import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handler, HttpError } from "@/lib/api";
import { requireApiManager, requireApiUser } from "@/lib/auth";
import { searchStoreItems, storeAdapter } from "@/lib/stores";

// Anúncios/produtos da loja conectada (?q= filtra pelo título).
export const GET = handler(async (request: Request, ctx: RouteContext<"/api/integrations/stores/[slug]">) => {
  const user = await requireApiUser();
  const { slug } = await ctx.params;
  const q = (new URL(request.url).searchParams.get("q") || "").slice(0, 100);
  return NextResponse.json(await searchStoreItems(user, slug, q));
});

// Desconecta a loja (o token é apagado; o lojista também pode desinstalar o app no painel da loja).
export const DELETE = handler(async (_request: Request, ctx: RouteContext<"/api/integrations/stores/[slug]">) => {
  const user = await requireApiManager();
  const { slug } = await ctx.params;
  const adapter = storeAdapter(slug);
  if (!adapter) throw new HttpError(404, "errors.storeUnknown");
  await db.connection.deleteMany({ where: { workspaceId: user.workspaceId, provider: adapter.provider } });
  return NextResponse.json({ success: true });
});
