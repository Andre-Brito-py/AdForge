import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseSignedRequest } from "@/lib/meta/graph";
import { getMetaApp } from "@/lib/meta/connection";

/**
 * "Deauthorize Callback URL" do app na Meta: chamado quando o usuário remove o app
 * nas configurações do Facebook. Marcamos as conexões como revogadas.
 */
export async function POST(request: Request) {
  const app = await getMetaApp();
  if (!app) return NextResponse.json({ error: "not configured" }, { status: 503 });

  const form = await request.formData().catch(() => null);
  const data = parseSignedRequest(String(form?.get("signed_request") || ""), app.appSecret);
  if (!data?.user_id) return NextResponse.json({ error: "invalid signed_request" }, { status: 400 });

  await db.connection.updateMany({
    where: { provider: "META", externalUserId: data.user_id },
    data: { status: "REVOKED", accessToken: "" },
  });
  return NextResponse.json({ success: true });
}
