import { NextResponse } from "next/server";
import { z } from "zod";
import { firstIssue } from "./validation";
import { rateLimit, clientIp } from "./rate-limit";

export class HttpError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
}

export function jsonError(status: number, message: string, code?: string) {
  return NextResponse.json({ error: message, code }, { status });
}

/** Lê o corpo JSON e valida com Zod; lança HttpError(400) com mensagem amigável. */
export async function parseBody<T extends z.ZodTypeAny>(request: Request, schema: T): Promise<z.infer<T>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new HttpError(400, "Corpo da requisição inválido");
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new HttpError(400, firstIssue(parsed.error), "VALIDATION");
  return parsed.data;
}

export async function enforceRateLimit(request: Request, bucket: string, limit: number, windowSeconds: number, identity?: string) {
  const key = `${bucket}:${identity || clientIp(request)}`;
  const result = await rateLimit(key, limit, windowSeconds);
  if (!result.ok) {
    throw new HttpError(429, "Muitas tentativas. Aguarde um pouco e tente novamente.", "RATE_LIMITED");
  }
}

/**
 * Envolve um route handler: converte HttpError em resposta JSON e esconde
 * detalhes de erros inesperados do cliente (eles vão só para o log).
 */
export function handler<Args extends unknown[]>(fn: (...args: Args) => Promise<Response>) {
  return async (...args: Args): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (error) {
      if (error instanceof HttpError) return jsonError(error.status, error.message, error.code);
      console.error("[api] erro inesperado", error);
      return jsonError(500, "Erro interno. Tente novamente em instantes.");
    }
  };
}
