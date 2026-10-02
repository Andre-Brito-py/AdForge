/**
 * O que cada modelo de vídeo da fal.ai sabe fazer. O modelo é escolhido no Admin (sem deploy);
 * aqui ficam só as diferenças que mudam o pedido e a montagem.
 */
export interface VideoModelCaps {
  /** Durações aceitas por pedido (s). */
  durations: number[];
  /** Aceita a locução (audio_url) e sincroniza os lábios de quem fala. */
  lipSyncAudio: boolean;
  /** Resolução por qualidade. */
  resolution: { standard: string; premium: string };
  /** O formato sai da imagem inicial (não há parâmetro aspect_ratio). */
  aspectFromImage: boolean;
}

export function videoModelCaps(model: string): VideoModelCaps {
  // Wan 2.6 (e versões seguintes da mesma família): até 15 s por pedido, áudio com lip-sync.
  if (/wan\/v2\.(6|[7-9])|wan-2\.(6|[7-9])|wan\/v3|wan-3/i.test(model)) {
    return { durations: [5, 10, 15], lipSyncAudio: true, resolution: { standard: "720p", premium: "1080p" }, aspectFromImage: true };
  }
  // Wan 2.1 / 2.2: trechos de ~5 s, sem áudio.
  return { durations: [5], lipSyncAudio: false, resolution: { standard: "480p", premium: "720p" }, aspectFromImage: false };
}

/**
 * Divide a duração total em pedidos que o modelo aceita, com o menor número de pedidos e partes iguais
 * quando possível (30 s -> 15+15; 20 s -> 10+10; 10 s -> 10). Menos emendas = vídeo mais coerente.
 */
export function planSegments(total: number, durations: number[]): number[] {
  const allowed = [...durations].sort((a, b) => b - a);
  const max = allowed[0];
  for (let n = Math.ceil(total / max); n <= Math.ceil(total / allowed[allowed.length - 1]); n++) {
    const each = total / n;
    if (Number.isInteger(each) && allowed.includes(each)) return Array(n).fill(each);
  }
  // Sem divisão exata: maiores primeiro, completando com o menor que couber.
  const out: number[] = [];
  let left = total;
  while (left > 0) {
    const d = allowed.find((x) => x <= left) ?? allowed[allowed.length - 1];
    out.push(d);
    left -= d;
  }
  return out;
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
