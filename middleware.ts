import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const isAuth = !!req.nextauth.token;
    const isAuthPage = req.nextUrl.pathname.startsWith("/login");
    const onboardingCompleted = req.nextauth.token?.onboardingCompleted;

    if (isAuthPage) {
      if (isAuth) {
        if (!onboardingCompleted) {
          return NextResponse.redirect(new URL("/onboarding", req.url));
        }
        return NextResponse.redirect(new URL("/dashboard", req.url));
      }
      return null;
    }

    if (!isAuth) {
      let from = req.nextUrl.pathname;
      if (req.nextUrl.search) {
        from += req.nextUrl.search;
      }
      return NextResponse.redirect(new URL(`/login?from=${encodeURIComponent(from)}`, req.url));
    }

    // Se estiver logado, indo para rotas de dashboard, e não completou onboarding
    if (
      !onboardingCompleted && 
      !req.nextUrl.pathname.startsWith("/onboarding") &&
      !req.nextUrl.pathname.startsWith("/api")
    ) {
      return NextResponse.redirect(new URL("/onboarding", req.url));
    }

    // Se estiver logado, já completou onboarding e tenta acessar a página de onboarding
    if (onboardingCompleted && req.nextUrl.pathname.startsWith("/onboarding")) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    // Proteger rota /admin
    if (req.nextUrl.pathname.startsWith("/admin")) {
      if (req.nextauth.token?.role !== "SUPERADMIN") {
        return NextResponse.redirect(new URL("/dashboard", req.url));
      }
    }

    const response = NextResponse.next();
    
    // Set locale se não existir
    if (!req.cookies.has('NEXT_LOCALE')) {
      const acceptLang = req.headers.get('accept-language');
      let locale = 'pt';
      if (acceptLang?.includes('en')) locale = 'en';
      if (acceptLang?.includes('es')) locale = 'es';
      response.cookies.set('NEXT_LOCALE', locale, { path: '/' });
    }

    return response;
  },
  {
    callbacks: {
      authorized: ({ token }) => true, // O middleware lida com a lógica de redirecionamento, então retornamos true aqui para não bloquear e sim redirecionar
    },
  }
);

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/campaigns/:path*",
    "/products/:path*",
    "/billing/:path*",
    "/admin/:path*",
    "/onboarding",
    "/login",
  ],
};
