import { GoogleGenAI, type GenerateContentParameters, type GenerateContentResponse } from "@google/genai";

/**
 * Cliente Gemini. GEMINI_BASE_URL permite apontar para um gateway/proxy
 * (ou um servidor simulado nos testes) sem mudar código.
 */
export function geminiClient(apiKey: string) {
  const baseUrl = process.env.GEMINI_BASE_URL;
  return new GoogleGenAI({ apiKey, ...(baseUrl ? { httpOptions: { baseUrl } } : {}) });
}

/** Alias que o Google mantém apontando para o Flash mais recente. */
export const TEXT_FALLBACK_MODEL = "gemini-flash-latest";

/** O Google aposentou o modelo (ou ele não está liberado para esta conta)? */
export function isModelUnavailable(error: unknown): boolean {
  const e = error as { status?: number; message?: string };
  return e?.status === 404 || /NOT_FOUND|no longer available|is not found|not supported for generateContent/i.test(e?.message || "");
}

/** Sobrecarga ou limite momentâneo do Google ("high demand", 429, 500, 503): vale tentar de novo. */
export function isTransient(error: unknown): boolean {
  const e = error as { status?: number; message?: string };
  // Cota zerada / plano sem faturamento não passa esperando: não adianta tentar de novo.
  if (/quota|billing|limit: 0|free_tier/i.test(e?.message || "")) return false;
  return [429, 500, 502, 503, 504].includes(e?.status ?? 0) || /UNAVAILABLE|RESOURCE_EXHAUSTED|high demand|overloaded|try again later/i.test(e?.message || "");
}

const RETRY_DELAYS_MS = [2_000, 6_000];
/** Cada chamada espera no máximo 45 s; o conjunto de tentativas, ~100 s (o cliente não fica minutos esperando). */
const CALL_TIMEOUT_MS = 45_000;
const TOTAL_BUDGET_MS = 100_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Gera conteúdo de texto com tolerância a falhas do Google:
 * - sobrecarga momentânea: tenta de novo após 2 s e 6 s;
 * - modelo aposentado, ou ainda sobrecarregado após as tentativas: usa o alias do Flash mais recente
 *   (o admin pode trocar o modelo em Admin › IA e custos, sem deploy).
 */
export async function generateTextContent(apiKey: string, params: GenerateContentParameters): Promise<GenerateContentResponse> {
  const client = geminiClient(apiKey);
  const models = params.model === TEXT_FALLBACK_MODEL ? [params.model] : [params.model, TEXT_FALLBACK_MODEL];
  const started = Date.now();
  const left = () => TOTAL_BUDGET_MS - (Date.now() - started);
  let lastError: unknown;
  for (const model of models) {
    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
      if (left() < 5_000) throw lastError ?? new Error("Tempo esgotado aguardando o Gemini");
      try {
        return await client.models.generateContent({
          ...params,
          model,
          config: { ...params.config, abortSignal: AbortSignal.timeout(Math.min(CALL_TIMEOUT_MS, left())) },
        });
      } catch (error) {
        lastError = error;
        if (isModelUnavailable(error)) break; // vai para o próximo modelo
        // Estourou o tempo da chamada: trata como sobrecarga (tenta de novo/troca de modelo).
        if (!isTransient(error) && (error as Error)?.name !== "AbortError" && (error as Error)?.name !== "TimeoutError") throw error;
        if (attempt < RETRY_DELAYS_MS.length) await sleep(Math.min(RETRY_DELAYS_MS[attempt], Math.max(0, left() - 5_000)));
        else break;
      }
    }
    if (model !== models[models.length - 1]) {
      console.warn(`[ai/gemini] modelo "${model}" indisponível ou sobrecarregado; usando ${TEXT_FALLBACK_MODEL}. Confira em Admin › IA e custos.`);
    }
  }
  throw lastError;
}
