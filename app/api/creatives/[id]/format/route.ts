import { NextResponse } from "next/server";
import { z } from "zod";
import { enforceRateLimit, handler, parseBody } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { VIDEO_ASPECTS } from "@/lib/video-aspects";
import { videoFormatUrl } from "@/lib/video-formats";

// Renderizar um formato leva de alguns segundos a ~1 min (ffmpeg).
export const maxDuration = 300;

const bodySchema = z.object({ aspect: z.enum(VIDEO_ASPECTS) });

// Vídeo no formato pedido (9:16, 4:5, 1:1, 16:9), com as mesmas legendas e tela final; gerado na primeira vez.
export const POST = handler(async (request: Request, ctx: RouteContext<"/api/creatives/[id]/format">) => {
  const { id } = await ctx.params;
  const user = await requireApiUser();
  await enforceRateLimit(request, "video-format", 30, 60 * 60, user.id);
  const { aspect } = await parseBody(request, bodySchema);
  const url = await videoFormatUrl(user.workspaceId, id, aspect);
  return NextResponse.json({ url });
});
