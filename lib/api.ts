import { NextResponse } from "next/server";
import { z } from "zod";
import { getLocale, getTranslations } from "next-intl/server";
import { rateLimit, clientIp } from "./rate-limit";

/**
 * Erro HTTP com mensagem traduzível. Use uma chave "errors.xxx" ou "validation.xxx"
 * (de messages/*.json); textos livres (ex.: painel admin) são devolvidos como estão.
 */
export class HttpError extends Error {
  constructor(public status: number, message: string, public code?: string, public values?: Record<string, string | number>) {
    super(message);
  }
}

export function jsonError(status: number, message: string, code?: string) {
  return NextResponse.json({ error: message, code }, { status });
}

/** Traduz uma chave "errors.*"/"validation.*" para o idioma da requisição. */
export async function translateMessage(message: string, values?: Record<string, string | number>) {
  const match = /^(errors|validation)\.([A-Za-z0-9_]+)$/.exec(message);
  if (!match) return message;
  try {
    const t = await getTranslations(match[1]);
    return t(match[2], values);
  } catch {
    return message;
  }
}

/** Lê o corpo JSON e valida com Zod; mensagens no idioma de quem chamou. */
export async function parseBody<T extends z.ZodTypeAny>(request: Request, schema: T): Promise<z.infer<T>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new HttpError(400, "errors.badBody");
  }
  const locale = await getLocale().catch(() => "pt");
  const localeError = (locale === "en" ? z.locales.en() : z.locales.pt()).localeError;
  const parsed = schema.safeParse(raw, { error: localeError });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new HttpError(400, issue?.message || "errors.badBody", "VALIDATION");
  }
  return parsed.data;
}

export async function enforceRateLimit(request: Request, bucket: string, limit: number, windowSeconds: number, identity?: string) {
  const key = `${bucket}:${identity || clientIp(request)}`;
  const result = await rateLimit(key, limit, windowSeconds);
  if (!result.ok) throw new HttpError(429, "errors.rateLimited", "RATE_LIMITED");
}

/**
 * Envolve um route handler: converte HttpError em resposta JSON traduzida e esconde
 * detalhes de erros inesperados do cliente (eles vão só para o log).
 */
export function handler<Args extends unknown[]>(fn: (...args: Args) => Promise<Response>) {
  return async (...args: Args): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (error) {
      if (error instanceof HttpError) {
        return jsonError(error.status, await translateMessage(error.message, error.values), error.code);
      }
      console.error("[api] erro inesperado", error);
      return jsonError(500, await translateMessage("errors.internal"));
    }
  };
}
