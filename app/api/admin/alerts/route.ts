import { NextResponse } from "next/server";
import { z } from "zod";
import { handler, parseBody } from "@/lib/api";
import { requireApiAdmin } from "@/lib/auth";
import { billingUrl, openAlerts, PAUSE_MS, PROVIDER_LABEL, resolveAlert, type AlertProvider } from "@/lib/admin-alerts";

export const GET = handler(async () => {
  await requireApiAdmin();
  const now = Date.now();
  const alerts = await openAlerts();
  return NextResponse.json({
    alerts: alerts.map((a) => ({
      provider: a.provider,
      label: PROVIDER_LABEL[a.provider as AlertProvider] ?? a.provider,
      message: a.message,
      failures: a.failures,
      since: a.createdAt,
      lastFailureAt: a.lastFailureAt,
      paused: now - a.lastFailureAt.getTime() < PAUSE_MS,
      billingUrl: billingUrl(a.provider),
    })),
  });
});

const resolveSchema = z.object({ provider: z.string().min(1).max(30) });

// "Já recarreguei": encerra o alerta e libera o provedor na hora.
export const POST = handler(async (request: Request) => {
  await requireApiAdmin();
  const { provider } = await parseBody(request, resolveSchema);
  await resolveAlert(provider);
  return NextResponse.json({ success: true });
});
