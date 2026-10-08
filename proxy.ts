import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import { countryFromHeaders, currencyForCountry, isCurrency, isLocale, pickLocale } from "./lib/locale";

const AUTH_PAGES = ["/login", "/signup", "/forgot-password", "/reset-password"];
const APP_PREFIXES = ["/dashboard", "/campaigns", "/products", "/billing", "/credits", "/brand", "/settings", "/admin", "/onboarding", "/integrations", "/team"];

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

    // Primeira visita: idioma pelo navegador e moeda pelo país (geolocalização da CDN).
    const country = countryFromHeaders(req.headers);
    const cookieOpts = { path: "/", sameSite: "lax" as const, maxAge: 60 * 60 * 24 * 365 };
    let locale = req.cookies.get("NEXT_LOCALE")?.value;
    if (!isLocale(locale)) {
      locale = pickLocale(req.headers.get("accept-language"), country);
      response.cookies.set("NEXT_LOCALE", locale, cookieOpts);
    }
    if (!isCurrency(req.cookies.get("CURRENCY")?.value)) {
      response.cookies.set("CURRENCY", currencyForCountry(country, isLocale(locale) ? locale : "pt"), cookieOpts);
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
    "/team/:path*",
    "/admin/:path*",
    "/onboarding",
    "/login",
    "/signup",
    "/forgot-password",
    "/reset-password",
    "/legal/:path*",
  ],
};
