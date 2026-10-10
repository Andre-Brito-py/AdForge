import { NextResponse } from "next/server";
import { z } from "zod";
import { enforceRateLimit, handler, parseBody } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { generateFromWinner, MAX_WINNER_VARIATIONS } from "@/lib/generation";

export const maxDuration = 300;

const bodySchema = z.object({
  creativeId: z.uuid(),
  count: z.number().int().min(1).max(MAX_WINNER_VARIATIONS).default(2),
});

// "Gerar mais como este": novas variações a partir do criativo campeão (cobra créditos; estorna o que falhar).
export const POST = handler(async (request: Request, ctx: RouteContext<"/api/campaigns/[id]/winner">) => {
  const { id } = await ctx.params;
  const user = await requireApiUser({ verified: true });
  await enforceRateLimit(request, "regenerate", 30, 60 * 60, user.id);
  const { creativeId, count } = await parseBody(request, bodySchema);
  const result = await generateFromWinner(user, id, creativeId, count);
  return NextResponse.json({ success: true, ...result }, { status: 201 });
});
