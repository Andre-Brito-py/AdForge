/**
 * Build na Vercel: confere as variáveis essenciais, gera o Prisma Client, aplica as migrations no banco (Neon)
 * e compila o Next.
 *
 * Migrations (MIGRATE_ON_BUILD):
 *   "production" (padrão) — só nos deploys de produção (VERCEL_ENV=production);
 *   "always"              — também nos previews (use com a integração Neon, que cria um banco por preview);
 *   "never"               — nunca (rode `npm run db:deploy` à mão).
 */
import { execSync } from "node:child_process";

const env = { ...process.env };
// A integração Neon da Vercel cria DATABASE_URL_UNPOOLED; o Prisma usa DIRECT_URL para as migrations.
env.DIRECT_URL ||= env.DATABASE_URL_UNPOOLED || env.POSTGRES_URL_NON_POOLING || "";

const production = env.VERCEL_ENV === "production";

function fail(message) {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

// Sem estas, o site sobe quebrado (login, chaves salvas no Admin, arquivos): melhor falhar o deploy.
if (production) {
  const required = ["DATABASE_URL", "NEXTAUTH_SECRET", "ENCRYPTION_KEY", "CRON_SECRET", "NEXT_PUBLIC_APP_URL", "S3_BUCKET", "S3_ENDPOINT", "S3_PUBLIC_URL", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"];
  const missing = required.filter((k) => !env[k]);
  if (!env.DIRECT_URL) missing.push("DIRECT_URL (ou DATABASE_URL_UNPOOLED)");
  if (missing.length) fail(`Variáveis de ambiente faltando na Vercel (Production): ${missing.join(", ")}. Veja docs/DEPLOY_VERCEL_NEON.md.`);
  if ((env.ENCRYPTION_KEY || "").length < 32) fail("ENCRYPTION_KEY precisa ter pelo menos 32 caracteres (gere com: openssl rand -base64 32).");
  if (!/^https:\/\//.test(env.NEXT_PUBLIC_APP_URL || "")) fail("NEXT_PUBLIC_APP_URL precisa ser o endereço https do site (ex.: https://vysify.com.br).");
}

const run = (cmd) => execSync(cmd, { stdio: "inherit", env });

run("npx prisma generate");

const mode = (env.MIGRATE_ON_BUILD || "production").toLowerCase();
const migrate = mode === "always" || (mode === "production" && production);
if (migrate) {
  if (!env.DIRECT_URL) fail("Defina DIRECT_URL (conexão SEM pooler do Neon) para aplicar as migrations.");
  console.log("→ Aplicando migrations no banco…");
  run("npx prisma migrate deploy");
} else {
  console.log(`→ Migrations não aplicadas neste build (VERCEL_ENV=${env.VERCEL_ENV || "local"}, MIGRATE_ON_BUILD=${mode}).`);
}

run("npx next build");
