import type { NextRequest } from "next/server";
import NextAuth from "next-auth";
import { getAuthOptions } from "@/lib/auth";

// As opções são lidas a cada requisição: o login com Google pode ser ligado,
// desligado ou ter as credenciais trocadas no painel Admin sem redeploy.
async function handler(req: NextRequest, ctx: RouteContext<"/api/auth/[...nextauth]">) {
  return NextAuth(req, ctx, await getAuthOptions());
}

export { handler as GET, handler as POST };
