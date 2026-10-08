import { NextResponse } from "next/server";
import { advanceAllPending } from "@/lib/generation";
import { isCronAuthorized } from "@/lib/cron-auth";
import { advancePendingPublications } from "@/lib/publishing";
import { advancePendingAds } from "@/lib/meta/ads";
import { purgeOldRateLimits } from "@/lib/rate-limit";
import { db } from "@/lib/db";
import { imageRightsCutoff } from "@/lib/image-rights";
import { consentCutoff } from "@/lib/terms";

export const maxDuration = 300;

/**
 * Avança gerações que ficaram pendentes (ex.: o usuário fechou a aba enquanto o vídeo
 * era gerado) e faz limpezas. Chame a cada 1-5 minutos (Vercel Cron, GitHub Actions, cron-job.org).
 */
export async function GET(request: Request) {
  if (!isCronAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const advanced = await advanceAllPending();
  const publications = await advancePendingPublications();
  const ads = await advancePendingAds();
  await purgeOldRateLimits();
  await db.authToken.deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } } });
  // Fim do prazo de guarda das declarações de autorização de imagem (LGPD art. 16: não guardar além do necessário).
  await db.imageRightsRecord.deleteMany({ where: { createdAt: { lt: imageRightsCutoff() } } });
  // Provas de aceite dos Termos: guardadas 5 anos depois que a conta deixa de existir (contas ativas mantêm todas).
  await db.$executeRaw`DELETE FROM "ConsentRecord" c WHERE c."createdAt" < ${consentCutoff()} AND NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = c."userId")`;

  return NextResponse.json({ ok: true, advanced, publications, ads });
}
