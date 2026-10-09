/**
 * Aquece o servidor de desenvolvimento antes dos testes: em `next dev`, cada rota compila no primeiro acesso
 * e isso pode estourar o tempo de um passo do teste (ex.: login logo depois do cadastro).
 */
export default async function globalSetup() {
  const base = `http://localhost:${process.env.E2E_PORT || 3200}`;
  const paths = [
    "/signup", "/login", "/onboarding", "/dashboard", "/products/new", "/campaigns/new", "/billing", "/team",
    "/api/auth/csrf", "/api/auth/session", "/api/auth/providers",
  ];
  for (const path of paths) {
    await fetch(`${base}${path}`, { redirect: "manual" }).catch(() => undefined);
  }
}
