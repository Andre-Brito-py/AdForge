import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { parseSignedRequest } from "@/lib/meta/graph";
import { getMetaApp } from "@/lib/meta/connection";
import { appUrl } from "@/services/email";

/**
 * "Data Deletion Request URL" exigida pela Meta. Apaga tokens e a lista de páginas
 * daquele usuário do Facebook e devolve um código de confirmação, como a Meta pede.
 * (Os criativos são do cliente na Vysify e seguem a exclusão de conta normal, em Configurações.)
 */
export async function POST(request: Request) {
  const app = await getMetaApp();
  if (!app) return NextResponse.json({ error: "not configured" }, { status: 503 });

  const form = await request.formData().catch(() => null);
  const data = parseSignedRequest(String(form?.get("signed_request") || ""), app.appSecret);
  if (!data?.user_id) return NextResponse.json({ error: "invalid signed_request" }, { status: 400 });

  await db.connection.deleteMany({ where: { provider: "META", externalUserId: data.user_id } });

  const code = randomBytes(8).toString("hex");
  return NextResponse.json({
    url: `${appUrl()}/meta-data-deletion?code=${code}`,
    confirmation_code: code,
  });
}
