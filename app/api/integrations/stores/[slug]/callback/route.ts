import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { verifyOAuthState } from "@/lib/oauth-state";
import { saveStoreConnection, storeAdapter, storeRedirectUri, type StoreSlug } from "@/lib/stores";
import { normalizeShopDomain, verifyShopifyHmac } from "@/lib/stores/shopify";
import { appUrl } from "@/services/email";

const STORE_COOKIE = "store_oauth";

// Retorno da autorização da loja: valida o state (e o hmac, na Shopify), troca o code e salva a conexão.
export async function GET(request: NextRequest, ctx: RouteContext<"/api/integrations/stores/[slug]/callback">) {
  const base = appUrl();
  const { slug } = await ctx.params;
  const done = (query: string) => {
    const res = NextResponse.redirect(`${base}/integrations?${query}&store=${encodeURIComponent(slug)}`);
    res.cookies.delete({ name: STORE_COOKIE, path: "/api/integrations/stores" });
    return res;
  };

  const adapter = storeAdapter(slug);
  const params = request.nextUrl.searchParams;
  if (!adapter) return done("error=not_configured");
  if (params.get("error")) return done("error=denied");

  let cookie: { nonce?: string; verifier?: string; shop?: string | null; slug?: string } = {};
  try {
    cookie = JSON.parse(request.cookies.get(STORE_COOKIE)?.value || "{}");
  } catch {
    /* sem cookie: o state falha abaixo */
  }
  const payload = verifyOAuthState(params.get("state"), cookie.nonce);
  const user = await getSessionUser();
  if (!payload || !user || payload.uid !== user.id || payload.ws !== user.workspaceId || cookie.slug !== slug) return done("error=invalid_state");

  const app = await adapter.getApp();
  const code = params.get("code");
  if (!app || !code) return done("error=not_configured");

  // Shopify: a resposta vem assinada e precisa ser da mesma loja que o lojista informou.
  let shop: string | null = null;
  if (slug === "shopify") {
    shop = normalizeShopDomain(params.get("shop"));
    if (!shop || shop !== cookie.shop || !verifyShopifyHmac(params, app.secret)) return done("error=invalid_state");
  }

  try {
    const account = await adapter.exchangeCode({
      appId: app.appId, secret: app.secret, redirectUri: storeRedirectUri(slug as StoreSlug), code, codeVerifier: cookie.verifier || "", shop,
    });
    await saveStoreConnection(adapter, user.workspaceId, user.id, account);
    return done(`connected=${slug}`);
  } catch (error) {
    console.error(`[stores] callback ${slug} falhou`, error);
    return done("error=exchange_failed");
  }
}
