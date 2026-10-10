import { copyFile, readFile, writeFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { LOGO_MARGIN_RATIO, LOGO_WIDTH_RATIO, hasAudio, probeDuration, probeSize, run, withTempDir } from "./video-assembly";

/**
 * Acabamento do anúncio em vídeo (o que transforma "um vídeo de IA" num anúncio pronto para veicular):
 *  - legendas grandes, palavra a palavra, sincronizadas com a locução (a maioria assiste sem som);
 *  - tela final com oferta, preço e chamada para ação nos últimos segundos;
 *  - o formato pedido (9:16, 4:5, 1:1, 16:9) a partir do mesmo vídeo-mestre: recorte central ou,
 *    quando o recorte perderia demais, o vídeo inteiro sobre um fundo desfocado;
 *  - o logo do Brand Kit no canto.
 * As legendas e a tela final são desenhadas com libass (filtro `ass` do ffmpeg) usando a fonte Geist.
 */

export interface CaptionWord {
  /** Palavra como foi falada. */
  w: string;
  /** Início e fim (s) no áudio. */
  s: number;
  e: number;
}

export interface EndCard {
  /** Linha curta da oferta (ex.: "Frete grátis hoje"). */
  offer?: string | null;
  /** Preço já formatado na moeda (ex.: "R$ 89,90"). */
  price?: string | null;
  cta?: string | null;
  /** Cor da marca (#RRGGBB) para o botão. */
  color?: string | null;
}

export interface FinishOptions {
  /** Formato de saída ("9:16", "4:5", "1:1", "16:9"). */
  aspect: string;
  captions?: CaptionWord[] | null;
  endCard?: EndCard | null;
  logoPng?: Buffer | null;
}

/** Recorte que manteria menos que isso da imagem vira "vídeo inteiro sobre fundo desfocado". */
const MIN_CROP_AREA = 0.55;
const FONT_NAME = "Geist";

/** Geometria de saída: recorte central do mestre ou encaixe sobre fundo desfocado. */
export function frameGeometry(width: number, height: number, aspect: string) {
  const m = /^(\d+):(\d+)$/.exec(aspect);
  const ratio = m ? Number(m[1]) / Number(m[2]) : width / height;
  let cw = width;
  let ch = Math.round(width / ratio);
  if (ch > height) {
    ch = height;
    cw = Math.round(height * ratio);
  }
  const even = (n: number) => n - (n % 2);
  // Recorta só se mantiver boa parte da imagem E a resolução (1:1 -> 9:16 por recorte ficaria com 405 px de largura).
  if ((cw * ch) / (width * height) >= MIN_CROP_AREA && Math.min(cw, ch) >= 0.75 * Math.min(width, height)) {
    return { mode: "crop" as const, width: even(cw), height: even(ch) };
  }
  // Encaixe: mantém o lado maior do mestre como referência (ex.: 1280x720 -> 720x1280).
  const long = Math.max(width, height);
  const outW = ratio >= 1 ? long : Math.round(long * ratio);
  const outH = ratio >= 1 ? Math.round(long / ratio) : long;
  return { mode: "pad" as const, width: even(outW), height: even(outH) };
}

// ---------- Legendas ----------

/** Remove emojis e caracteres que a fonte não tem ou que o ASS interpreta ({ } \). */
function clean(text: string) {
  return text
    .replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, "")
    .replace(/[{}]/g, "")
    .replace(/\\/g, "/")
    .replace(/\s+/g, " ")
    .trim();
}

/** Tempos estimados pelo tamanho de cada palavra (quando o provedor de voz não devolve os tempos). */
export function estimateWordTimings(text: string, duration: number, lead = 0.15): CaptionWord[] {
  const words = clean(text).split(" ").filter(Boolean);
  if (words.length === 0 || duration <= lead) return [];
  const weights = words.map((w) => w.length + 1 + (/[.,!?;:]$/.test(w) ? 3 : 0));
  const total = weights.reduce((a, b) => a + b, 0);
  const span = duration - lead - 0.1;
  let t = lead;
  return words.map((w, i) => {
    const d = (weights[i] / total) * span;
    const word = { w, s: round2(t), e: round2(t + d) };
    t += d;
    return word;
  });
}

/** Palavras a partir do alinhamento por caractere da ElevenLabs (`/with-timestamps`). */
export function wordsFromAlignment(a: { characters: string[]; character_start_times_seconds: number[]; character_end_times_seconds: number[] }): CaptionWord[] {
  const out: CaptionWord[] = [];
  let cur: CaptionWord | null = null;
  a.characters.forEach((ch, i) => {
    if (/\s/.test(ch)) {
      if (cur) out.push(cur);
      cur = null;
      return;
    }
    const s = a.character_start_times_seconds[i] ?? 0;
    const e = a.character_end_times_seconds[i] ?? s;
    if (!cur) cur = { w: ch, s, e };
    else {
      cur.w += ch;
      cur.e = e;
    }
  });
  if (cur) out.push(cur);
  return out
    .map((w) => ({ w: clean(w.w), s: round2(w.s), e: round2(w.e) }))
    .filter((w) => w.w);
}

/** Agrupa as palavras em blocos curtos (até ~3-4 palavras), quebrando em pontuação e pausas. */
export function captionChunks(words: CaptionWord[], maxChars = 18, maxWords = 4): CaptionWord[][] {
  const chunks: CaptionWord[][] = [];
  let cur: CaptionWord[] = [];
  const len = (c: CaptionWord[]) => c.reduce((n, w) => n + w.w.length + 1, -1);
  for (const w of words) {
    const prev = cur[cur.length - 1];
    const pause = prev && w.s - prev.e > 0.6;
    if (cur.length && (pause || cur.length >= maxWords || len([...cur, w]) > maxChars)) {
      chunks.push(cur);
      cur = [];
    }
    cur.push(w);
    if (/[.!?;:]$/.test(w.w) || (/,$/.test(w.w) && cur.length >= 2)) {
      chunks.push(cur);
      cur = [];
    }
  }
  if (cur.length) chunks.push(cur);
  return chunks;
}

// ---------- ASS ----------

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function assTime(t: number) {
  const cs = Math.max(0, Math.round(t * 100));
  const h = Math.floor(cs / 360000);
  const m = Math.floor((cs % 360000) / 6000);
  const s = Math.floor((cs % 6000) / 100);
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs % 100).padStart(2, "0")}`;
}

/** #RRGGBB -> &H00BBGGRR (ordem do ASS). */
export function assColor(hex: string, alpha = 0) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  const rgb = m ? m[1] : "FFFFFF";
  return `&H${alpha.toString(16).padStart(2, "0")}${rgb.slice(4, 6)}${rgb.slice(2, 4)}${rgb.slice(0, 2)}&`.toUpperCase();
}

function luminance(hex: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 0;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Cor de destaque da palavra falada: a da marca se for clara o bastante, senão amarelo. */
function highlightColor(brand?: string | null) {
  return brand && luminance(brand) > 0.45 ? brand : "#FFD400";
}

/** Distância da legenda até a base: 9:16 sobe mais (botões do Reels/TikTok ficam embaixo). */
function captionMarginRatio(width: number, height: number) {
  const r = width / height;
  if (r < 0.7) return 0.25;
  if (r < 0.9) return 0.15;
  if (r <= 1.1) return 0.12;
  return 0.1;
}

function endCardSeconds(duration: number) {
  return duration >= 8 ? 3 : 2;
}

function hasEndCard(card?: EndCard | null): card is EndCard {
  return !!card && !!(card.offer?.trim() || card.price?.trim() || card.cta?.trim());
}

function truncate(text: string, max: number) {
  const t = clean(text);
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`;
}

/** Arquivo .ass com as legendas e a tela final para um vídeo W x H de `duration` segundos. */
export function buildAss(width: number, height: number, duration: number, opts: Pick<FinishOptions, "captions" | "endCard">): string | null {
  const card = hasEndCard(opts.endCard) ? opts.endCard : null;
  // Limpa de novo: as palavras podem vir do banco (JSON salvo) e nunca podem injetar comandos do ASS.
  const cleaned = (opts.captions || []).map((w) => ({ ...w, w: clean(String(w.w)) })).filter((w) => w.w && Number.isFinite(w.s) && Number.isFinite(w.e));
  const words = cleaned.length ? cleaned : null;
  if (!card && !words) return null;

  const base = Math.min(width, height * 0.75);
  const capSize = Math.round(base * 0.08);
  const outline = Math.max(3, Math.round(capSize * 0.15));
  const marginX = Math.round(width * 0.08);
  const marginV = Math.round(height * captionMarginRatio(width, height));
  const brand = opts.endCard?.color || null;
  const ctaBg = brand && /^#?[0-9a-f]{6}$/i.test(brand) ? brand : "#FFFFFF";
  const ctaText = luminance(ctaBg) > 0.6 ? "#111111" : "#FFFFFF";
  const ctaPad = Math.round(base * 0.025);

  const styles = [
    // Name, Font, Size, Primary, Secondary, Outline, Back, Bold, Italic, Underline, Strike, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, ML, MR, MV, Encoding
    `Style: Cap,${FONT_NAME},${capSize},&H00FFFFFF,&H00FFFFFF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,${outline},${Math.round(outline / 2)},2,${marginX},${marginX},${marginV},1`,
    `Style: Offer,${FONT_NAME},${Math.round(base * 0.064)},&H00FFFFFF,&H00FFFFFF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,${Math.max(1, Math.round(outline / 2))},0,5,${marginX},${marginX},0,1`,
    `Style: Price,${FONT_NAME},${Math.round(base * 0.13)},&H00FFFFFF,&H00FFFFFF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,${Math.max(1, Math.round(outline / 2))},0,5,${marginX},${marginX},0,1`,
    // BorderStyle 3 = caixa opaca na cor do contorno: vira o "botão" da chamada.
    `Style: Cta,${FONT_NAME},${Math.round(base * 0.066)},${assColor(ctaText)},${assColor(ctaText)},${assColor(ctaBg)},&H00000000,-1,0,0,0,100,100,0,0,3,${ctaPad},0,5,${marginX},${marginX},0,1`,
    `Style: Shade,${FONT_NAME},10,&H00000000,&H00000000,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1`,
  ];

  const events: string[] = [];
  const cardStart = card ? Math.max(0, duration - endCardSeconds(duration)) : duration;

  if (words) {
    const hl = assColor(highlightColor(brand));
    const chunks = captionChunks(words);
    chunks.forEach((chunk, ci) => {
      const next = chunks[ci + 1];
      // O bloco fica na tela até o próximo começar (sem piscar entre blocos), ou um pouco depois da última palavra.
      const chunkEnd = Math.min(next ? next[0].s : chunk[chunk.length - 1].e + 0.35, cardStart);
      chunk.forEach((w, wi) => {
        const start = w.s;
        const end = Math.min(wi < chunk.length - 1 ? chunk[wi + 1].s : chunkEnd, cardStart);
        if (end - start < 0.04) return;
        const text = chunk.map((x, xi) => (xi === wi ? `{\\c${hl}}${x.w}{\\c&H00FFFFFF&}` : x.w)).join(" ");
        // Pequeno "pop" quando o bloco aparece.
        const pop = wi === 0 ? "{\\fscx108\\fscy108\\t(0,90,\\fscx100\\fscy100)}" : "";
        events.push(`Dialogue: 1,${assTime(start)},${assTime(end)},Cap,,0,0,0,,${pop}${text}`);
      });
    });
  }

  if (card) {
    const start = assTime(cardStart);
    const end = assTime(duration + 1);
    const fade = "\\fad(250,0)";
    events.push(`Dialogue: 0,${start},${end},Shade,,0,0,0,,{\\an7\\pos(0,0)\\p1\\1a&H48&${fade}}m 0 0 l ${width} 0 ${width} ${height} 0 ${height}{\\p0}`);
    const offer = card.offer?.trim() ? truncate(card.offer, 40) : null;
    const price = card.price?.trim() ? truncate(card.price, 20) : null;
    const cta = card.cta?.trim() ? truncate(card.cta, 24) : null;
    const items = [
      offer && { style: "Offer", text: offer, h: base * 0.064 * 1.5 },
      price && { style: "Price", text: price, h: base * 0.13 * 1.25 },
      cta && { style: "Cta", text: cta, h: base * 0.066 * 1.3 + ctaPad * 2 + base * 0.04 },
    ].filter(Boolean) as { style: string; text: string; h: number }[];
    const total = items.reduce((a, b) => a + b.h, 0);
    // Bloco centrado um pouco abaixo do meio (o produto continua visível em cima, desfocado pela sombra).
    let y = height * 0.56 - total / 2;
    items.forEach((it, i) => {
      const cy = Math.round(y + it.h / 2);
      y += it.h;
      const delay = 120 * i;
      const anim = `\\fad(${250 + delay},0)\\fscx${it.style === "Cta" ? 92 : 100}\\fscy${it.style === "Cta" ? 92 : 100}\\t(${delay},${delay + 220},\\fscx100\\fscy100)`;
      events.push(`Dialogue: 2,${start},${end},${it.style},,0,0,0,,{\\an5\\pos(${Math.round(width / 2)},${cy})${anim}}${it.text}`);
    });
  }

  return [
    "[Script Info]",
    "ScriptType: v4.00+",
    `PlayResX: ${width}`,
    `PlayResY: ${height}`,
    "WrapStyle: 0",
    "ScaledBorderAndShadow: yes",
    "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    ...styles,
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
    ...events,
    "",
  ].join("\n");
}

// ---------- ffmpeg ----------

/** Fonte das legendas: VIDEO_FONT_PATH ou a Geist que vem com o Next (incluída no deploy pelo next.config). */
export function captionFontPath(): string | null {
  const candidates = [
    process.env.VIDEO_FONT_PATH,
    path.join(process.cwd(), "node_modules", "next", "dist", "compiled", "@vercel", "og", "Geist-Regular.ttf"),
  ].filter(Boolean) as string[];
  return candidates.find((p) => existsSync(p)) ?? null;
}

/**
 * Aplica formato, logo, legendas e tela final sobre o vídeo-mestre. Sem nada a fazer, devolve o próprio mestre.
 */
export async function finishVideo(master: Buffer, opts: FinishOptions): Promise<{ buffer: Buffer; duration: number; width: number; height: number }> {
  return withTempDir(async (dir) => {
    const input = path.join(dir, "master.mp4");
    await writeFile(input, master);
    const size = await probeSize(input);
    const duration = await probeDuration(input);
    const geo = frameGeometry(size.width, size.height, opts.aspect);
    const reshape = geo.width !== size.width || geo.height !== size.height;

    const font = captionFontPath();
    if (!font && (opts.captions?.length || hasEndCard(opts.endCard))) console.warn("[video-finish] fonte das legendas não encontrada; usando a padrão do sistema");
    const ass = buildAss(geo.width, geo.height, duration, opts);
    if (!reshape && !opts.logoPng && !ass) return { buffer: master, duration: Math.round(duration), ...size };

    const inputs = ["-i", "master.mp4"];
    let graph: string;
    if (!reshape) {
      graph = "[0:v]setsar=1[base]";
    } else if (geo.mode === "crop") {
      graph = `[0:v]crop=${geo.width}:${geo.height},setsar=1[base]`;
    } else {
      graph =
        `[0:v]split[a][b];` +
        `[a]scale=${geo.width}:${geo.height}:force_original_aspect_ratio=increase,crop=${geo.width}:${geo.height},boxblur=24:2,eq=brightness=-0.08[bg];` +
        `[b]scale=${geo.width}:${geo.height}:force_original_aspect_ratio=decrease[fg];` +
        `[bg][fg]overlay=(W-w)/2:(H-h)/2,setsar=1[base]`;
    }
    let label = "[base]";

    if (opts.logoPng) {
      await writeFile(path.join(dir, "logo.png"), opts.logoPng);
      inputs.push("-i", "logo.png");
      const w = Math.max(32, Math.round((geo.width * LOGO_WIDTH_RATIO) / 2) * 2);
      const margin = Math.round(geo.width * LOGO_MARGIN_RATIO);
      graph += `;[1:v]scale=${w}:-1[lg];${label}[lg]overlay=W-w-${margin}:H-h-${margin}:format=auto[vl]`;
      label = "[vl]";
    }

    if (ass) {
      await writeFile(path.join(dir, "subs.ass"), ass, "utf8");
      if (font) await copyFile(font, path.join(dir, path.basename(font)));
      // Caminhos relativos (cwd = pasta temporária): evita escapar "C:\" e ":" dentro do filtro.
      graph += `;${label}ass=subs.ass${font ? ":fontsdir=." : ""}[vs]`;
      label = "[vs]";
    }

    const audio = (await hasAudio(input)) ? ["-map", "0:a:0", "-c:a", "copy"] : ["-an"];
    await run(
      [...inputs, "-filter_complex", graph, "-map", label, ...audio, "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "out.mp4"],
      240_000,
      dir
    );
    return { buffer: await readFile(path.join(dir, "out.mp4")), duration: Math.round(duration), width: geo.width, height: geo.height };
  });
}

/** Duração (s) de um áudio ou vídeo em memória. */
export async function mediaDuration(buffer: Buffer, ext = "mp3"): Promise<number> {
  return withTempDir(async (dir) => {
    const file = path.join(dir, `in.${ext}`);
    await writeFile(file, buffer);
    return probeDuration(file);
  });
}
