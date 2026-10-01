import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { enforceRateLimit, handler, HttpError, parseBody } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { advancePublication, createPublication, IG_CAPTION_LIMIT, PUBLISH_TARGET_KEYS } from "@/lib/publishing";

export const maxDuration = 120;

const bodySchema = z.object({
  creativeId: z.uuid(),
  target: z.enum(PUBLISH_TARGET_KEYS),
  accountId: z.string().min(1).max(64).regex(/^\d+$/, "Conta inválida"),
  caption: z.string().max(IG_CAPTION_LIMIT, `A legenda pode ter até ${IG_CAPTION_LIMIT} caracteres`).optional().nullable(),
});

export const POST = handler(async (request: Request) => {
  const user = await requireApiUser({ verified: true });
  await enforceRateLimit(request, "publish", 30, 60 * 60, user.workspaceId);
  const body = await parseBody(request, bodySchema);
  const publication = await createPublication(user, { ...body, caption: body.caption?.trim() || null });
  return NextResponse.json(publication, { status: 201 });
});

// Publicações de uma campanha. Avança as que ainda estão em processamento (vídeos).
export const GET = handler(async (request: Request) => {
  const user = await requireApiUser();
  const campaignId = new URL(request.url).searchParams.get("campaignId");
  if (!campaignId) throw new HttpError(400, "Informe a campanha");

  const where = { workspaceId: user.workspaceId, creative: { campaignId } };
  const inFlight = await db.publication.findMany({ where: { ...where, status: { in: ["PENDING", "PROCESSING"] } }, select: { id: true } });
  for (const p of inFlight) await advancePublication(p.id);

  const publications = await db.publication.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: { id: true, creativeId: true, target: true, accountName: true, status: true, permalink: true, error: true, createdAt: true },
  });
  return NextResponse.json(publications);
});
