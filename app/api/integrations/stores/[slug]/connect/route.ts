import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { createOAuthState } from "@/lib/oauth-state";
import { rateLimit } from "@/lib/rate-limit";
import { canManageSettings } from "@/lib/workspaces";
import { pkcePair, storeAdapter, storeRedirectUri, type StoreSlug } from "@/lib/stores";
import { normalizeShopDomain } from "@/lib/stores/shopify";
import { appUrl } from "@/services/email";

// Mesmo nome usado no callback.
const STORE_COOKIE = "store_oauth";

// Inicia a autorização da loja (o navegador vai para o Mercado Livre, a Nuvemshop ou a Shopify).
export async function GET(request: NextRequest, ctx: RouteContext<"/api/integrations/stores/[slug]/connect">) {
  const base = appUrl();
  const { slug } = await ctx.params;
  const adapter = storeAdapter(slug);
  const user = await getSessionUser();
  if (!user) return NextResponse.redirect(`${base}/login?from=/integrations`);
  if (!adapter) return NextResponse.redirect(`${base}/integrations?error=not_configured`);
  if (!canManageSettings(user.workspaceRole)) return NextResponse.redirect(`${base}/integrations?error=managers_only`);

  const app = await adapter.getApp();
  if (!app) return NextResponse.redirect(`${base}/integrations?error=not_configured&store=${slug}`);
  const limited = await rateLimit(`store-connect:${user.id}`, 10, 15 * 60);
  if (!limited.ok) return NextResponse.redirect(`${base}/integrations?error=rate_limited`);

  const shop = slug === "shopify" ? normalizeShopDomain(request.nextUrl.searchParams.get("shop")) : null;
  if (slug === "shopify" && !shop) return NextResponse.redirect(`${base}/integrations?error=invalid_shop&store=shopify`);

  const { state, nonce } = createOAuthState(user.id, user.workspaceId);
  const { verifier, challenge } = pkcePair();
  const url = adapter.buildAuthUrl({ appId: app.appId, redirectUri: storeRedirectUri(slug as StoreSlug), state, codeChallenge: challenge, shop });
  const res = NextResponse.redirect(url);
  res.cookies.set(STORE_COOKIE, JSON.stringify({ nonce, verifier, shop, slug }), {
    httpOnly: true,
    secure: base.startsWith("https://"),
    sameSite: "lax",
    path: "/api/integrations/stores",
    maxAge: 600,
  });
  return res;
}
