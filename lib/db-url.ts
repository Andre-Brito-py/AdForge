/**
 * Conexão do Prisma com o Postgres (Neon em produção).
 *  - Pooler do Neon (host "-pooler"): o PgBouncer roda em modo transação, então o Prisma precisa de
 *    `pgbouncer=true` (desliga prepared statements).
 *  - Neon com "scale to zero": o primeiro acesso depois de um tempo parado acorda o banco em alguns segundos;
 *    `connect_timeout=15` evita erro nesse primeiro pedido. SSL é obrigatório.
 *  - A integração Neon da Vercel cria DATABASE_URL (com pooler) e DATABASE_URL_UNPOOLED; as migrations usam
 *    DIRECT_URL, que cai para a versão sem pooler quando não for definida.
 */

export function prismaDatabaseUrl(raw: string | undefined): string | undefined {
  if (!raw) return raw;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return raw;
  }
  const neon = /\.neon\.tech$/i.test(url.hostname);
  const pooled = /-pooler\./i.test(url.hostname);
  if (pooled && !url.searchParams.has("pgbouncer")) url.searchParams.set("pgbouncer", "true");
  if (neon) {
    if (!url.searchParams.has("sslmode")) url.searchParams.set("sslmode", "require");
    if (!url.searchParams.has("connect_timeout")) url.searchParams.set("connect_timeout", "15");
  }
  return url.toString();
}

/** URL sem pooler para as migrations (DIRECT_URL, ou a que a integração Neon da Vercel cria). */
export function directDatabaseUrl(env: Record<string, string | undefined> = process.env): string | undefined {
  return env.DIRECT_URL || env.DATABASE_URL_UNPOOLED || env.POSTGRES_URL_NON_POOLING || undefined;
}
