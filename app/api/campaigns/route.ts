import { NextResponse } from "next/server";
import { enforceRateLimit, handler, parseBody } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { campaignSchema } from "@/lib/validation";
import { createCampaign } from "@/lib/generation";
import { requestFingerprint } from "@/lib/image-rights";

export const maxDuration = 300;

export const POST = handler(async (request: Request) => {
  const user = await requireApiUser({ verified: true });
  await enforceRateLimit(request, "campaign", 20, 60 * 60, user.id);
  const input = await parseBody(request, campaignSchema);
  const result = await createCampaign(user, input, requestFingerprint(request));
  return NextResponse.json({ success: true, ...result }, { status: 201 });
});
