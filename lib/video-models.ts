/**
 * O que cada modelo de vídeo da fal.ai sabe fazer. O modelo é escolhido no Admin (sem deploy);
 * aqui ficam só as diferenças que mudam o pedido e a montagem.
 */
export interface VideoModelCaps {
  /** Quem gera: fal.ai (Wan, Kling...) ou Google Veo (chave do Gemini). */
  provider: "fal" | "veo";
  /** Durações aceitas por pedido (s). */
  durations: number[];
  /** Aceita a locução (audio_url) e sincroniza os lábios de quem fala. */
  lipSyncAudio: boolean;
  /** Resolução por qualidade. */
  resolution: { standard: string; premium: string };
  /** O formato sai da imagem inicial (não há parâmetro aspect_ratio). */
  aspectFromImage: boolean;
  /** Formatos que o modelo gera direto ("any" = qualquer, segue a imagem). Os outros são recortados na montagem. */
  aspects?: readonly string[];
  /**
   * Segundos que cada EXTENSÃO acrescenta, quando o modelo sabe continuar o próprio vídeo (Veo 3.1/Fast).
   * Com extensão, o vídeo longo é 8 s + extensões, sem recomeçar de um quadro parado (o produto não muda na emenda).
   */
  extensionSeconds?: number;
  /** Família do modelo na fal.ai (o corpo do pedido muda entre elas). */
  family?: "wan" | "kling";
}

export function videoModelCaps(model: string): VideoModelCaps {
  // Google Veo 3.x (veo-3.1-generate-preview, -fast-, -lite-): 4/6/8 s por pedido; física e mãos mais fortes.
  if (/^veo-/i.test(model)) {
    const extensible = /^veo-3\.1-(fast-)?generate/i.test(model);
    return {
      provider: "veo", durations: [4, 6, 8], lipSyncAudio: false, resolution: { standard: "720p", premium: "1080p" }, aspectFromImage: false,
      aspects: ["9:16", "16:9"],
      ...(extensible ? { extensionSeconds: 7 } : {}),
    };
  }
  // Kling (fal.ai): física e mãos muito boas. v3: 3 a 15 s por pedido; v2.x: 5 ou 10 s. O formato segue a imagem inicial.
  // A locução da Vysify entra na montagem e o lip-sync final cuida da boca (o áudio do próprio Kling fica desligado).
  if (/kling-video\//i.test(model)) {
    const v3 = /kling-video\/v3/i.test(model);
    return { provider: "fal", family: "kling", durations: v3 ? [5, 10, 15] : [5, 10], lipSyncAudio: false, resolution: { standard: "1080p", premium: "1080p" }, aspectFromImage: true };
  }
  // Wan 2.6 (e versões seguintes da mesma família): até 15 s por pedido, áudio com lip-sync.
  if (/wan\/v2\.(6|[7-9])|wan-2\.(6|[7-9])|wan\/v3|wan-3/i.test(model)) {
    return { provider: "fal", durations: [5, 10, 15], lipSyncAudio: true, resolution: { standard: "720p", premium: "1080p" }, aspectFromImage: true };
  }
  // Wan 2.1 / 2.2: trechos de ~5 s, sem áudio.
  return { provider: "fal", durations: [5], lipSyncAudio: false, resolution: { standard: "480p", premium: "720p" }, aspectFromImage: false };
}

/** Modelos de vídeo prontos para escolher no Admin (o campo continua livre para versões novas). */
export const VIDEO_MODEL_PRESETS = [
  { id: "wan/v2.6/image-to-video", label: "Wan 2.6 (fal.ai) — mais barato, lip-sync nativo" },
  { id: "fal-ai/kling-video/v2.6/pro/image-to-video", label: "Kling 2.6 Pro (fal.ai) — ótima física, bom preço" },
  { id: "fal-ai/kling-video/v3/pro/image-to-video", label: "Kling 3.0 Pro (fal.ai) — máxima qualidade do Kling" },
  { id: "veo-3.1-lite-generate-preview", label: "Google Veo 3.1 Lite — econômico" },
  { id: "veo-3.1-fast-generate-preview", label: "Google Veo 3.1 Fast — equilíbrio qualidade/custo" },
  { id: "veo-3.1-generate-preview", label: "Google Veo 3.1 — máxima qualidade" },
] as const;

/**
 * Divide a duração total em pedidos que o modelo aceita, com o menor número de pedidos e partes iguais
 * quando possível (30 s -> 15+15; 20 s -> 10+10; 10 s -> 10). Menos emendas = vídeo mais coerente.
 */
export function planSegments(total: number, durations: number[]): number[] {
  const allowed = [...new Set(durations)].sort((a, b) => b - a);
  const max = allowed[0];
  const min = allowed[allowed.length - 1];
  // Menor número de pedidos; entre eles, o que menos passa do total (o excedente é cortado na montagem)
  // e, no empate, partes mais parecidas entre si (30 s -> 15+15, não 15+10+5).
  for (let n = Math.ceil(total / max); n <= Math.ceil(total / min); n++) {
    let best: number[] | null = null;
    const score = (c: number[]) => [c.reduce((a, b) => a + b, 0) - total, Math.max(...c) - Math.min(...c)];
    const walk = (start: number, picked: number[]) => {
      if (picked.length === n) {
        const sum = picked.reduce((a, b) => a + b, 0);
        if (sum < total) return;
        if (!best) best = [...picked];
        else {
          const [o1, s1] = score(picked);
          const [o2, s2] = score(best);
          if (o1 < o2 || (o1 === o2 && s1 < s2)) best = [...picked];
        }
        return;
      }
      for (let i = start; i < allowed.length; i++) walk(i, [...picked, allowed[i]]);
    };
    walk(0, []);
    if (best) return best;
  }
  return Array(Math.ceil(total / min)).fill(min);
}

/**
 * Parte do roteiro falada dentro de [start, start+seconds) de um vídeo de `total` segundos
 * (proporcional ao número de palavras; serve para o prompt dizer o que a pessoa fala naquele pedido).
 */
export function voiceoverSlice(text: string, start: number, seconds: number, total: number): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0 || total <= 0) return "";
  const from = Math.floor((start / total) * words.length);
  const to = Math.ceil(((start + seconds) / total) * words.length);
  return words.slice(from, Math.max(from + 1, to)).join(" ");
}

/**
 * Formato em que o modelo deve GERAR o vídeo para entregar `target`: o próprio, se ele suportar; senão 9:16
 * (vertical, o mais próximo de 4:5 e 1:1), com recorte central na montagem.
 */
export function generationAspect(caps: VideoModelCaps, target: string): { generate: string; cropTo: string | null } {
  if (!caps.aspects || caps.aspects.includes(target)) return { generate: target, cropTo: null };
  const generate = caps.aspects.includes("9:16") ? "9:16" : caps.aspects[0];
  return { generate, cropTo: target };
}

/** Plano com extensão: um pedido de 8 s e extensões até cobrir o total (15 s = 8+7; 30 s = 8+7+7+7+7, cortado). */
export function planExtension(total: number, extensionSeconds: number, first = 8): number[] {
  const out = [first];
  while (out.reduce((a, b) => a + b, 0) < total) out.push(extensionSeconds);
  return out;
}

/** Como dividir o vídeo para este modelo: extensões (quando suportado) ou pedidos independentes. */
export function planVideo(total: number, caps: VideoModelCaps): { segments: number[]; extend: boolean } {
  if (caps.extensionSeconds && total > 8) return { segments: planExtension(total, caps.extensionSeconds), extend: true };
  return { segments: planSegments(total, caps.durations), extend: false };
}

/**
 * Prompt de um pedido que cobre várias cenas de 5 s (ex.: 15 s = 3 cenas): descreve a ação em sequência,
 * num plano contínuo, para o modelo não cortar nem trocar de cenário.
 */
export function segmentPrompt(scenes: string[], startSecond: number, seconds: number): string {
  const first = Math.floor(startSecond / 5);
  const count = Math.max(1, Math.round(seconds / 5));
  const slice = scenes.slice(first, first + count);
  const parts = slice.length ? slice : [scenes[scenes.length - 1]];
  if (parts.length === 1) return parts[0];
  // Tempos relativos ao próprio pedido (cada pedido começa em 0 s).
  return `One continuous shot, no cuts. ${parts.map((s, i) => `${i * 5}-${(i + 1) * 5}s: ${s}`).join(" ")}`;
}
