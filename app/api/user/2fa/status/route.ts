import { NextResponse } from "next/server";
import { handler } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";

export const GET = handler(async () => {
  const user = await requireApiUser();
  return NextResponse.json({ enabled: user.twoFactorEnabled });
});
