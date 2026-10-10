import { NextResponse } from "next/server";
import { z } from "zod";
import { enforceRateLimit, handler, parseBody } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { importProductForWorkspace } from "@/lib/product-import-service";

export const maxDuration = 60;

const bodySchema = z.object({ url: z.string().trim().min(4).max(2000) });

// Lê o produto do link da loja (nome, descrição, preço, foto e avaliações) para pré-preencher o cadastro.
export const POST = handler(async (request: Request) => {
  const user = await requireApiUser();
  await enforceRateLimit(request, "product-import", 20, 60 * 60, user.id);
  const { url } = await parseBody(request, bodySchema);
  return NextResponse.json(await importProductForWorkspace(user, url));
});
