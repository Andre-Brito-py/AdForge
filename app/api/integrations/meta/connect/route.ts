import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { createOAuthState } from "@/lib/oauth-state";
import { buildAuthUrl } from "@/lib/meta/graph";
import { getMetaApp, metaRedirectUri, NONCE_COOKIE } from "@/lib/meta/connection";
import { rateLimit } from "@/lib/rate-limit";
import { appUrl } from "@/services/email";

// Inicia o login da Meta (o navegador é redirecionado para o Facebook).
export async function GET() {
  const base = appUrl();
  const user = await getSessionUser();
  if (!user) return NextResponse.redirect(`${base}/login?from=/integrations`);

  const app = await getMetaApp();
  if (!app) return NextResponse.redirect(`${base}/integrations?error=not_configured`);

  const limited = await rateLimit(`meta-connect:${user.id}`, 10, 15 * 60);
  if (!limited.ok) return NextResponse.redirect(`${base}/integrations?error=rate_limited`);

  const { state, nonce } = createOAuthState(user.id, user.workspaceId);
  const res = NextResponse.redirect(buildAuthUrl({ appId: app.appId, redirectUri: metaRedirectUri(), state }));
  res.cookies.set(NONCE_COOKIE, nonce, {
    httpOnly: true,
    secure: base.startsWith("https://"),
    sameSite: "lax",
    path: "/api/integrations/meta",
    maxAge: 600,
  });
  return res;
}
