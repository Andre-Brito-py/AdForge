import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { handler, HttpError, parseBody } from "@/lib/api";
import { requireApiAdmin } from "@/lib/auth";
import { encryptSecret, maskSecret, decryptSecret } from "@/lib/crypto";
import { DEFAULT_MODELS, getAppConfig, invalidateConfigCache, SECRET_FIELDS } from "@/lib/config";
import { costsSchema, modelsSchema, plansSchema } from "@/lib/validation";
import { settingsSchema } from "@/lib/settings";

// Nunca devolvemos os segredos: só se estão configurados e os 4 últimos caracteres.
export const GET = handler(async () => {
  await requireApiAdmin();
  const row = await db.systemConfig.findUnique({ where: { id: "global" } });
  const config = await getAppConfig();

  const secrets = Object.fromEntries(
    SECRET_FIELDS.map((f) => {
      const fromDb = decryptSecret(row?.[f]);
      return [f, { ...maskSecret(config.secrets[f]), source: fromDb ? "painel" : config.secrets[f] ? "env" : null }];
    })
  );

  return NextResponse.json({
    secrets,
    costs: config.costs,
    models: config.models,
    defaultModels: DEFAULT_MODELS,
    plans: config.plans.filter((p) => !p.isFree),
    freeTrial: {
      enabled: config.freeTrial.enabled,
      credits: config.freeTrial.credits,
      planVisible: !!row?.freePlanVisible,
    },
    googleLogin: config.googleLogin,
    signupsEnabled: config.signupsEnabled,
    // O que está salvo no painel e o valor em uso (painel, variável de ambiente ou padrão).
    settings: config.storedSettings,
    effectiveSettings: config.settings,
  });
});

const secretValue = z.union([z.string().trim().min(1).max(500), z.null()]).optional();

const putSchema = z.object({
  // string = novo valor; null = remover; ausente = manter o atual
  secrets: z.object(Object.fromEntries(SECRET_FIELDS.map((f) => [f, secretValue])) as Record<(typeof SECRET_FIELDS)[number], typeof secretValue>).partial().optional(),
  costs: costsSchema.optional(),
  models: modelsSchema.optional(),
  plans: plansSchema.optional(),
  freeTrial: z
    .object({
      enabled: z.boolean(),
      credits: z.number().int().min(1, "Informe ao menos 1 crédito").max(10_000),
      planVisible: z.boolean(),
    })
    .optional(),
  googleLogin: z.object({ enabled: z.boolean() }).optional(),
  signupsEnabled: z.boolean().optional(),
  settings: settingsSchema.optional(),
});

export const PUT = handler(async (request: Request) => {
  await requireApiAdmin();
  const body = await parseBody(request, putSchema);

  if (body.plans) {
    const ids = new Set(body.plans.map((p) => p.id));
    if (ids.size !== body.plans.length) throw new HttpError(400, "Cada pacote precisa de um ID único");
  }

  const data: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(body.secrets || {})) {
    if (value === undefined) continue;
    data[field] = value === null ? null : encryptSecret(value);
  }
  if (body.costs) data.aiCostsJson = JSON.stringify(body.costs);
  if (body.models) data.modelsJson = JSON.stringify(body.models);
  if (body.plans) data.plansJson = JSON.stringify(body.plans);
  if (body.freeTrial) {
    data.freeTrialEnabled = body.freeTrial.enabled;
    data.signupCredits = body.freeTrial.credits;
    // Sem créditos grátis não existe "plano grátis" para mostrar.
    data.freePlanVisible = body.freeTrial.enabled && body.freeTrial.planVisible;
  }
  if (body.googleLogin) data.googleLoginEnabled = body.googleLogin.enabled;
  if (body.signupsEnabled !== undefined) data.signupsEnabled = body.signupsEnabled;
  if (body.settings) {
    // Campos vazios não são guardados: voltam a usar a variável de ambiente / padrão.
    const clean = Object.fromEntries(Object.entries(body.settings).filter(([, v]) => v !== "" && v !== undefined));
    data.settingsJson = JSON.stringify(clean);
  }

  await db.systemConfig.upsert({ where: { id: "global" }, update: data, create: { id: "global", ...data } });
  invalidateConfigCache();
  return NextResponse.json({ success: true });
});
