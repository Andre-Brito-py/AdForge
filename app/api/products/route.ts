import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handler, HttpError, parseBody } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { productSchema } from "@/lib/validation";
import { isOwnStorageUrl } from "@/lib/storage";

export const POST = handler(async (request: Request) => {
  const user = await requireApiUser();
  const data = await parseBody(request, productSchema);

  // Só aceitamos imagens que foram enviadas pelo nosso upload, e do próprio workspace.
  if (!isOwnStorageUrl(data.imageUrl) || !data.imageUrl.includes(`/uploads/${user.workspaceId}/`)) {
    throw new HttpError(400, "Imagem inválida. Envie a foto novamente.");
  }

  const product = await db.product.create({
    data: {
      workspaceId: user.workspaceId,
      name: data.name,
      description: data.description,
      originalImageUrl: data.imageUrl,
      category: data.category,
      brandName: data.brandName,
      targetAudience: data.targetAudience,
      price: data.price ?? null,
    },
  });
  return NextResponse.json(product, { status: 201 });
});

export const GET = handler(async () => {
  const user = await requireApiUser();
  const products = await db.product.findMany({
    where: { workspaceId: user.workspaceId },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, originalImageUrl: true, category: true, createdAt: true },
  });
  return NextResponse.json(products);
});
