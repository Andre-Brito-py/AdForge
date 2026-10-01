import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handler, parseBody } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { profileSchema } from "@/lib/validation";

export const PATCH = handler(async (request: Request) => {
  const user = await requireApiUser();
  const data = await parseBody(request, profileSchema);
  const updated = await db.user.update({
    where: { id: user.id },
    data,
    select: { name: true, notifyOnComplete: true, marketingOptIn: true },
  });
  return NextResponse.json(updated);
});
