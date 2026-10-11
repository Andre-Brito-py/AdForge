import { PrismaClient } from "@prisma/client";

/**
 * Prepara a rodada:
 *  - zera os limites de tentativas do banco de teste (todos os testes entram do mesmo IP; sem isso, a segunda
 *    rodada seguida bate no limite de login);
 *  - aquece o servidor de desenvolvimento: em `next dev`, cada rota compila no primeiro acesso e isso pode estourar
 *    o tempo de um passo do teste (ex.: login logo depois do cadastro).
 */
export default async function globalSetup() {
  const url = process.env.E2E_DATABASE_URL;
  if (url) {
    const db = new PrismaClient({ datasources: { db: { url } } });
    try {
      await db.rateLimit.deleteMany({});
    } finally {
      await db.$disconnect();
    }
  }

  const base = `http://localhost:${process.env.E2E_PORT || 3200}`;
  const paths = [
    "/signup", "/login", "/onboarding", "/dashboard", "/products/new", "/campaigns/new", "/billing", "/team",
    "/api/auth/csrf", "/api/auth/session", "/api/auth/providers",
  ];
  for (const path of paths) {
    await fetch(`${base}${path}`, { redirect: "manual" }).catch(() => undefined);
  }
}
