import { db } from "./db";

/**
 * Rate limit de janela fixa armazenado no Postgres.
 * Funciona entre várias instâncias serverless (memória local não funcionaria na Vercel).
 * Uma única query atômica: incrementa ou reinicia a janela.
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number) {
  try {
    const rows = await db.$queryRaw<{ count: number; windowStart: Date }[]>`
      INSERT INTO "RateLimit" ("key", "count", "windowStart")
      VALUES (${key}, 1, NOW())
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE WHEN "RateLimit"."windowStart" < NOW() - make_interval(secs => ${windowSeconds}) THEN 1 ELSE "RateLimit"."count" + 1 END,
        "windowStart" = CASE WHEN "RateLimit"."windowStart" < NOW() - make_interval(secs => ${windowSeconds}) THEN NOW() ELSE "RateLimit"."windowStart" END
      RETURNING "count", "windowStart"
    `;
    const row = rows[0];
    const resetAt = new Date(row.windowStart.getTime() + windowSeconds * 1000);
    return { ok: row.count <= limit, remaining: Math.max(0, limit - row.count), resetAt };
  } catch (error) {
    // Falha aberta: um problema no limitador não deve derrubar o login inteiro.
    console.error("[rate-limit] erro", error);
    return { ok: true, remaining: limit, resetAt: new Date() };
  }
}

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "unknown";
}

/** Limpeza ocasional de janelas antigas (chamada pelo cron). */
export async function purgeOldRateLimits() {
  await db.$executeRaw`DELETE FROM "RateLimit" WHERE "windowStart" < NOW() - INTERVAL '1 day'`;
}
