import { NextResponse } from "next/server";
import { z } from "zod";
import { enforceRateLimit, handler, parseBody } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { publishToStore, STORE_SLUGS } from "@/lib/stores";

export const maxDuration = 120;

const bodySchema = z.object({
  creativeId: z.uuid(),
  slug: z.enum(STORE_SLUGS as [string, ...string[]]),
  itemId: z.string().min(1).max(120),
  asCover: z.boolean().default(false),
});

// Coloca a imagem do criativo num anúncio do Mercado Livre ou num produto da Nuvemshop/Shopify.
export const POST = handler(async (request: Request) => {
  const user = await requireApiUser({ verified: true });
  await enforceRateLimit(request, "publish-store", 30, 60 * 60, user.workspaceId);
  const body = await parseBody(request, bodySchema);
  const publication = await publishToStore(user, body);
  return NextResponse.json(publication, { status: 201 });
});
