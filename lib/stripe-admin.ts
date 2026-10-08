import { db } from "./db";
import { getAppConfig, invalidateConfigCache } from "./config";
import { stripeClient, stripeMode, syncPlansToStripe } from "./stripe-sync";
import type { Plan } from "./validation";

export interface StripeSyncStatus {
  /** false = Stripe não configurada (nada a sincronizar). */
  configured: boolean;
  mode: "test" | "live" | null;
  synced: number;
  errors: string[];
}

/**
 * Sincroniza os pacotes atuais (já salvos) com a Stripe e guarda os IDs criados.
 * `previous` = pacotes antes da edição (para arquivar os removidos).
 */
export async function syncStripePlans(previous: Plan[]): Promise<StripeSyncStatus> {
  const config = await getAppConfig();
  const key = config.secrets.stripeSecretKey;
  if (!key) return { configured: false, mode: null, synced: 0, errors: [] };

  const mode = stripeMode(key);
  let result;
  try {
    result = await syncPlansToStripe(stripeClient(key), mode, config.plans, previous);
  } catch (error) {
    return { configured: true, mode, synced: 0, errors: [(error as Error).message] };
  }
  await db.systemConfig.update({ where: { id: "global" }, data: { plansJson: JSON.stringify(result.plans) } });
  invalidateConfigCache();
  return {
    configured: true,
    mode,
    synced: result.plans.filter((p) => p.stripe?.mode === mode).length,
    errors: result.errors,
  };
}
