import { NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { z } from "zod";
import { isCronAuthorized } from "@/lib/cron-auth";
import { runJob } from "@/lib/generation";

// Cada geração roda na própria execução, com o próprio limite de tempo
// (antes, todas as variações de uma campanha dividiam os 300 s de uma única requisição).
export const maxDuration = 300;

const bodySchema = z.object({ jobId: z.string().uuid() });

export async function POST(request: Request) {
  if (!isCronAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "jobId inválido" }, { status: 400 });

  // Responde na hora; o trabalho segue em segundo plano nesta execução. runJob é idempotente (só pega job PENDING).
  waitUntil(runJob(parsed.data.jobId).catch((e) => console.error("[jobs/run]", e)));
  return NextResponse.json({ accepted: true }, { status: 202 });
}
