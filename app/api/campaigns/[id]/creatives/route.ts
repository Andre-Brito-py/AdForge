import { NextResponse } from "next/server";
import { z } from "zod";
import { enforceRateLimit, handler, parseBody } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { regenerateCreative } from "@/lib/generation";

export const maxDuration = 300;

const bodySchema = z.object({
  baseCreativeId: z.uuid().optional().nullable(),
  instructions: z.string().trim().max(500).optional().nullable(),
});

// Gera uma nova variação visual (cobra créditos; estorna automaticamente se falhar).
export const POST = handler(async (request: Request, ctx: RouteContext<"/api/campaigns/[id]/creatives">) => {
  const { id } = await ctx.params;
  const user = await requireApiUser({ verified: true });
  await enforceRateLimit(request, "regenerate", 30, 60 * 60, user.id);
  const body = await parseBody(request, bodySchema);
  const result = await regenerateCreative(user, id, body.baseCreativeId ?? null, body.instructions || null);
  return NextResponse.json({ success: true, ...result }, { status: 201 });
});
