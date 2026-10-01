import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { verifyOAuthState } from "@/lib/oauth-state";
import { exchangeCodeForToken, fetchAssets, fetchGrantedScopes, fetchMe } from "@/lib/meta/graph";
import { getMetaApp, metaRedirectUri, NONCE_COOKIE, saveMetaConnection } from "@/lib/meta/connection";
import { appUrl } from "@/services/email";

// Retorno do login da Meta: valida o state, troca o code pelo token e salva a conexão.
export async function GET(request: NextRequest) {
  const base = appUrl();
  const done = (query: string) => {
    const res = NextResponse.redirect(`${base}/integrations?${query}`);
    res.cookies.delete({ name: NONCE_COOKIE, path: "/api/integrations/meta" });
    return res;
  };

  const params = request.nextUrl.searchParams;
  if (params.get("error")) return done("error=denied");

  const payload = verifyOAuthState(params.get("state"), request.cookies.get(NONCE_COOKIE)?.value);
  const user = await getSessionUser();
  // O state precisa ter sido emitido para ESTE usuário e workspace.
  if (!payload || !user || payload.uid !== user.id || payload.ws !== user.workspaceId) return done("error=invalid_state");

  const code = params.get("code");
  const app = await getMetaApp();
  if (!code || !app) return done("error=not_configured");

  try {
    const { accessToken, expiresAt } = await exchangeCodeForToken({ appId: app.appId, appSecret: app.appSecret, redirectUri: metaRedirectUri(), code });
    const [me, scopes, assets] = await Promise.all([fetchMe(accessToken), fetchGrantedScopes(accessToken), fetchAssets(accessToken)]);

    await saveMetaConnection({
      workspaceId: user.workspaceId,
      userId: user.id,
      externalUserId: me.id,
      displayName: me.name || null,
      accessToken,
      expiresAt,
      scopes,
      assets,
    });

    const missing = ["pages_show_list", "pages_manage_posts", "instagram_content_publish"].filter((s) => !scopes.includes(s));
    if (missing.length) return done(`connected=meta&warning=missing_scopes`);
    if (assets.length === 0) return done(`connected=meta&warning=no_pages`);
    return done("connected=meta");
  } catch (error) {
    console.error("[meta] callback falhou", error);
    return done("error=exchange_failed");
  }
}
