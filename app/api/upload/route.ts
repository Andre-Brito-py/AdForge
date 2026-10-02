import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { enforceRateLimit, handler, HttpError } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { detectImageType, IMAGE_TYPES, saveFile } from "@/lib/storage";
import { reviewImage } from "@/services/ai/moderation";

export const maxDuration = 60;

const MAX_BYTES = 8 * 1024 * 1024;

export const POST = handler(async (request: Request) => {
  const user = await requireApiUser();
  await enforceRateLimit(request, "upload", 30, 60 * 60, user.id);

  const length = Number(request.headers.get("content-length") || 0);
  if (length > MAX_BYTES + 64 * 1024) throw new HttpError(413, "errors.imageTooLarge", undefined, { mb: 8 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || typeof file === "string") throw new HttpError(400, "errors.sendImageFile");
  if (file.size > MAX_BYTES) throw new HttpError(413, "errors.imageTooLarge", undefined, { mb: 8 });

  const buffer = Buffer.from(await file.arrayBuffer());
  // Valida pelo conteúdo real do arquivo, não pela extensão ou pelo Content-Type enviado.
  const mime = detectImageType(buffer);
  if (!mime) throw new HttpError(415, "errors.unsupportedFormat");

  // Moderação ANTES de gravar: imagem proibida (nudez, violência, menor em contexto sensual...) nem é armazenada.
  // Se a IA estiver fora do ar, segue (a revisão obrigatória acontece de novo na criação da campanha).
  try {
    const review = await reviewImage({ buffer, mimeType: mime }, user.locale === "en" ? "en" : "pt");
    if (review && !review.allowed) {
      console.warn(`[upload] imagem recusada (${review.category}) workspace=${user.workspaceId}`);
      throw new HttpError(422, "errors.imageBlocked", "IMAGE_BLOCKED", { reason: review.reason });
    }
  } catch (error) {
    if (error instanceof HttpError) throw error;
    console.error("[upload] moderação indisponível, seguindo", error);
  }

  const url = await saveFile(buffer, `uploads/${user.workspaceId}/${randomUUID()}.${IMAGE_TYPES[mime]}`, mime);
  return NextResponse.json({ success: true, url });
});
