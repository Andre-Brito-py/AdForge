import { timingSafeEqual } from "crypto";

/** Chamadas internas (cron e disparo de jobs) trazem `Authorization: Bearer <CRON_SECRET>`. */
export function isCronAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const got = Buffer.from(request.headers.get("authorization") || "");
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}
