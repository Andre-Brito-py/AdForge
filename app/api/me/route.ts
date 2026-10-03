import { NextResponse } from "next/server";
import { handler } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { getAppConfig } from "@/lib/config";
import { getWorkspaceBalance } from "@/services/credits";
import { PLATFORMS } from "@/lib/catalog";

// Dados que as telas cliente precisam: saldo, custos atuais e status da conta.
export const GET = handler(async () => {
  const user = await requireApiUser();
  const config = await getAppConfig();
  const balance = await getWorkspaceBalance(user.workspaceId);

  const availability = {
    IMAGE: !!config.secrets.geminiKey || !!config.secrets.openAiKey,
    VIDEO: !!config.secrets.wanKey && (!!config.secrets.geminiKey || !!config.secrets.openAiKey),
  };

  return NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: !!user.emailVerified,
      twoFactorEnabled: user.twoFactorEnabled,
      hasPassword: user.hasPassword,
      notifyOnComplete: user.notifyOnComplete,
      marketingOptIn: user.marketingOptIn,
    },
    balance,
    costs: config.costs,
    platforms: Object.fromEntries(
      Object.entries(PLATFORMS).map(([k, v]) => [k, { available: availability[v.media] }])
    ),
  });
});
