import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handler, HttpError, parseBody } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { brandKitSchema } from "@/lib/validation";
import { isOwnStorageUrl } from "@/lib/storage";

export const GET = handler(async () => {
  const user = await requireApiUser();
  const brand = await db.brandKit.findUnique({ where: { workspaceId: user.workspaceId } });
  return NextResponse.json(brand || {});
});

export const PUT = handler(async (request: Request) => {
  const user = await requireApiUser();
  const data = await parseBody(request, brandKitSchema);
  if (data.logoUrl && !isOwnStorageUrl(data.logoUrl)) throw new HttpError(400, "Logo inválido. Envie o arquivo novamente.");

  const brand = await db.brandKit.upsert({
    where: { workspaceId: user.workspaceId },
    update: data,
    create: { workspaceId: user.workspaceId, ...data },
  });
  return NextResponse.json(brand);
});
