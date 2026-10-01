import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import { isLocale, pickLocale } from "./lib/locale";

const AUTH_PAGES = ["/login", "/signup", "/forgot-password", "/reset-password"];
const APP_PREFIXES = ["/dashboard", "/campaigns", "/products", "/billing", "/credits", "/brand", "/settings", "/admin", "/onboarding", "/integrations"];

/**
 * Redirecionamentos rápidos baseados no JWT. A autorização "de verdade" acontece no
 * servidor (layout do dashboard e cada rota de API validam a sessão no banco).
 */
export default withAuth(
  function proxy(req) {
    const { pathname } = req.nextUrl;
    const token = req.nextauth.token;
    const isAuthPage = AUTH_PAGES.some((p) => pathname.startsWith(p));
    const isAppPage = APP_PREFIXES.some((p) => pathname.startsWith(p));

    let response: NextResponse;

    const expired = req.nextUrl.searchParams.has("expired");

    if (isAuthPage && token && !expired && !pathname.startsWith("/reset-password")) {
      response = NextResponse.redirect(new URL(token.onboardingCompleted ? "/dashboard" : "/onboarding", req.url));
    } else if (isAppPage && !token) {
      const from = pathname + req.nextUrl.search;
      response = NextResponse.redirect(new URL(`/login?from=${encodeURIComponent(from)}`, req.url));
    } else if (isAppPage && token && !token.onboardingCompleted && !pathname.startsWith("/onboarding")) {
      response = NextResponse.redirect(new URL("/onboarding", req.url));
    } else if (pathname.startsWith("/onboarding") && token?.onboardingCompleted) {
      response = NextResponse.redirect(new URL("/dashboard", req.url));
    } else if (pathname.startsWith("/admin") && token?.role !== "SUPERADMIN") {
      response = NextResponse.redirect(new URL("/dashboard", req.url));
    } else {
      response = NextResponse.next();
    }

    if (!isLocale(req.cookies.get("NEXT_LOCALE")?.value)) {
      response.cookies.set("NEXT_LOCALE", pickLocale(req.headers.get("accept-language")), {
        path: "/",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 365,
      });
    }
    return response;
  },
  { callbacks: { authorized: () => true } }
);

export const config = {
  matcher: [
    "/",
    "/dashboard/:path*",
    "/campaigns/:path*",
    "/products/:path*",
    "/billing/:path*",
    "/credits/:path*",
    "/brand/:path*",
    "/settings/:path*",
    "/integrations/:path*",
    "/admin/:path*",
    "/onboarding",
    "/login",
    "/signup",
    "/forgot-password",
    "/reset-password",
  ],
};
