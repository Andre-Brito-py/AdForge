import { NextResponse } from "next/server";
import { handler } from "@/lib/api";
import { requireApiAdmin } from "@/lib/auth";
import { getAppConfig } from "@/lib/config";
import { syncStripePlans } from "@/lib/stripe-admin";

// "Sincronizar agora": recria/atualiza na Stripe o que estiver faltando (ex.: depois de trocar a chave de teste pela de produção).
export const POST = handler(async () => {
  await requireApiAdmin();
  const config = await getAppConfig();
  return NextResponse.json(await syncStripePlans(config.plans));
});
