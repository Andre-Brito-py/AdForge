import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { enforceRateLimit, handler, HttpError } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { detectImageType, IMAGE_TYPES, saveFile } from "@/lib/storage";

const MAX_BYTES = 8 * 1024 * 1024;

export const POST = handler(async (request: Request) => {
  const user = await requireApiUser();
  await enforceRateLimit(request, "upload", 30, 60 * 60, user.id);

  const length = Number(request.headers.get("content-length") || 0);
  if (length > MAX_BYTES + 64 * 1024) throw new HttpError(413, "A imagem pode ter no máximo 8 MB");

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || typeof file === "string") throw new HttpError(400, "Envie um arquivo de imagem");
  if (file.size > MAX_BYTES) throw new HttpError(413, "A imagem pode ter no máximo 8 MB");

  const buffer = Buffer.from(await file.arrayBuffer());
  // Valida pelo conteúdo real do arquivo, não pela extensão ou pelo Content-Type enviado.
  const mime = detectImageType(buffer);
  if (!mime) throw new HttpError(415, "Formato não suportado. Use PNG, JPG ou WEBP.");

  const url = await saveFile(buffer, `uploads/${user.workspaceId}/${randomUUID()}.${IMAGE_TYPES[mime]}`, mime);
  return NextResponse.json({ success: true, url });
});
