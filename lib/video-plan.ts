import type { FalRequest, VideoRequest } from "@/services/ai/video";

/**
 * O que um criativo de vídeo deve conter (guardado em Creative.prompt como JSON):
 * uma cena por trecho de 5 s, o roteiro da locução e eventuais instruções extras do cliente.
 * Criativos antigos têm só o texto do conceito em Creative.prompt.
 */
export interface VideoSpec {
  v: 2;
  scenes: string[];
  voiceover: string;
  extra?: string | null;
  /** Descrição do quadro de abertura (uma foto realista) que é gerado e revisado antes de animar. */
  keyframe?: string | null;
  /** Tamanho real estimado do produto (mantém a escala realista no quadro de abertura). */
  productSize?: string | null;
  /** Quem apresenta: define a voz da locução. */
  presenter?: "female" | "male" | "none" | null;
}

export function serializeVideoSpec(spec: Omit<VideoSpec, "v">): string {
  return JSON.stringify({ v: 2, ...spec });
}

export function parseVideoSpec(prompt: string | null, fallbackVoiceover: string): VideoSpec {
  if (prompt?.startsWith("{")) {
    try {
      const p = JSON.parse(prompt);
      if (p?.v === 2 && Array.isArray(p.scenes) && p.scenes.length > 0) {
        return {
          v: 2, scenes: p.scenes.map(String), voiceover: String(p.voiceover || fallbackVoiceover),
          extra: p.extra ? String(p.extra) : null, keyframe: p.keyframe ? String(p.keyframe) : null,
          productSize: p.productSize ? String(p.productSize) : null,
          presenter: ["female", "male", "none"].includes(p.presenter) ? p.presenter : null,
        };
      }
    } catch {
      /* cai no formato antigo */
    }
  }
  // Formato antigo: "conceito\n[INSTRUCTIONS] extra"
  const [concept, extra] = (prompt || "").split("\n[INSTRUCTIONS] ");
  return { v: 2, scenes: [concept || "Clean studio product shot"], voiceover: fallbackVoiceover, extra: extra || null };
}

/**
 * Estado do processamento (GenerationJob.externalData): trechos prontos, o pedido em andamento
 * na fal.ai e uma "trava" para dois pollers simultâneos não avançarem o mesmo trecho duas vezes.
 */
export interface VideoProgress {
  v: 2;
  total: number;
  /** Duração de cada pedido (s). Ausente nos vídeos antigos = trechos de 5 s. */
  segments?: number[];
  /** Os trechos já vêm com a locução (lip-sync): na montagem não se coloca a locução de novo. */
  audioInSegments?: boolean;
  /** Cada pedido ESTENDE o vídeo anterior (Veo): o último trecho pronto já é o vídeo inteiro. */
  extend?: boolean;
  /** URI (no Veo) do último vídeo pronto, usada para estendê-lo. */
  lastSourceUri?: string | null;
  /** A pessoa em cena fala a locução (lábios sincronizados) — senão é narração em off. */
  speaking?: boolean;
  /** Etapa final de lip-sync dedicado sobre o vídeo já montado. */
  lipsync?: { request: VideoRequest; startedAt: number; assembledUrl: string; duration?: number } | null;
  /** URLs (no nosso armazenamento) dos trechos já prontos, em ordem. */
  done: string[];
  /** Pedido em andamento (fal.ai ou Veo; null entre um trecho e outro). */
  current: VideoRequest | null;
  /** Início do trecho atual (para o tempo limite por trecho). */
  segmentStartedAt: number;
  /** Quando algum worker pegou o avanço (unir/baixar/enviar o próximo). */
  claimedAt?: number;
}

/** URLs das imagens de referência guardadas na campanha (lista vazia se não houver ou se o JSON for inválido). */
export function parseReferences(json: string | null | undefined): string[] {
  if (!json) return [];
  try {
    const list = JSON.parse(json);
    return Array.isArray(list) ? list.filter((u): u is string => typeof u === "string") : [];
  } catch {
    return [];
  }
}

export function parseVideoProgress(raw: string | null, fallbackStartedAt: number): VideoProgress | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw);
    if (p?.v === 2) return p as VideoProgress;
    // Formato antigo: só o FalRequest de um vídeo de um trecho.
    if (p?.requestId) return { v: 2, total: 1, done: [], current: p as FalRequest, segmentStartedAt: fallbackStartedAt };
  } catch {
    /* inválido */
  }
  return null;
}

export const CLAIM_TTL_MS = 3 * 60_000;

export function isClaimed(p: VideoProgress, now = Date.now()) {
  return !!p.claimedAt && now - p.claimedAt < CLAIM_TTL_MS;
}
