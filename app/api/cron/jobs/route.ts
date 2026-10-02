import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { advanceAllPending } from "@/lib/generation";
import { advancePendingPublications } from "@/lib/publishing";
import { purgeOldRateLimits } from "@/lib/rate-limit";
import { db } from "@/lib/db";
import { imageRightsCutoff } from "@/lib/image-rights";

export const maxDuration = 300;

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const got = Buffer.from(request.headers.get("authorization") || "");
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

/**
 * Avança gerações que ficaram pendentes (ex.: o usuário fechou a aba enquanto o vídeo
 * era gerado) e faz limpezas. Chame a cada 1-5 minutos (Vercel Cron, GitHub Actions, cron-job.org).
 */
export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const advanced = await advanceAllPending();
  const publications = await advancePendingPublications();
  await purgeOldRateLimits();
  await db.authToken.deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } } });
  // Fim do prazo de guarda das declarações de autorização de imagem (LGPD art. 16: não guardar além do necessário).
  await db.imageRightsRecord.deleteMany({ where: { createdAt: { lt: imageRightsCutoff() } } });

  return NextResponse.json({ ok: true, advanced, publications });
}
