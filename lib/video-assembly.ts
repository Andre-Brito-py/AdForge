import { execFile } from "child_process";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import ffmpegStatic from "ffmpeg-static";

/**
 * Montagem dos vídeos com ffmpeg (binário estático do pacote ffmpeg-static; FFMPEG_PATH sobrescreve).
 *  - lastFrame(): último quadro de um trecho, usado como imagem inicial do trecho seguinte (continuidade);
 *  - assembleVideo(): une os trechos e coloca a locução, gerando um único MP4 pronto para postar.
 */

function ffmpegPath(): string {
  const p = process.env.FFMPEG_PATH || ffmpegStatic;
  if (!p) throw new Error("ffmpeg indisponível neste servidor");
  return p;
}

function run(args: string[], timeoutMs = 120_000): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(ffmpegPath(), ["-hide_banner", "-y", ...args], { timeout: timeoutMs, maxBuffer: 16 * 1024 * 1024 }, (error, _stdout, stderr) => {
      if (error) reject(new Error(`ffmpeg: ${(stderr || error.message).split("\n").filter(Boolean).slice(-3).join(" | ")}`));
      else resolve(stderr);
    });
  });
}

async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(path.join(tmpdir(), "vysify-video-"));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

/** Duração (s) lida do cabeçalho que o ffmpeg imprime ao abrir o arquivo. */
async function probeDuration(file: string): Promise<number> {
  const out = await run(["-i", file, "-f", "null", "-t", "0", "-"]).catch((e: Error) => e.message);
  const m = /Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/.exec(out);
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : 0;
}

/** Converte qualquer imagem (PNG, JPG, WEBP...) em PNG, preservando a transparência. */
export async function imageToPng(image: Buffer): Promise<Buffer> {
  return withTempDir(async (dir) => {
    const input = path.join(dir, "in.img");
    const output = path.join(dir, "out.png");
    await writeFile(input, image);
    await run(["-i", input, "-frames:v", "1", "-pix_fmt", "rgba", output]);
    return readFile(output);
  });
}

/** Logo ocupa ~18% da largura do criativo, com margem de ~3,5%, no canto inferior direito. */
export const LOGO_WIDTH_RATIO = 0.18;
export const LOGO_MARGIN_RATIO = 0.035;

/** Último quadro do vídeo em PNG (alta qualidade, sem perdas, para o próximo trecho). */
export async function lastFrame(video: Buffer): Promise<Buffer> {
  return withTempDir(async (dir) => {
    const input = path.join(dir, "in.mp4");
    const output = path.join(dir, "last.png");
    await writeFile(input, video);
    // -sseof busca a partir do fim; -update 1 sobrescreve até sobrar só o último quadro decodificado.
    await run(["-sseof", "-0.5", "-i", input, "-update", "1", "-frames:v", "100", output]);
    return readFile(output);
  });
}

/**
 * Trecho [start, start+seconds) da locução em MP3, com pelo menos `minSeconds` (silêncio no fim) —
 * modelos com lip-sync exigem áudio de no mínimo 3 s. Devolve null se a fala já acabou antes de `start`.
 */
export async function sliceAudio(audio: Buffer, start: number, seconds: number, minSeconds = 3): Promise<Buffer | null> {
  return withTempDir(async (dir) => {
    const input = path.join(dir, "in.mp3");
    const output = path.join(dir, "out.mp3");
    await writeFile(input, audio);
    const total = await probeDuration(input);
    if (start >= total - 0.3) return null;
    const pad = Math.max(minSeconds, Math.min(seconds, total - start));
    await run(["-ss", String(start), "-t", String(seconds), "-i", input, "-af", `apad=whole_dur=${pad.toFixed(2)}`, "-c:a", "libmp3lame", "-b:a", "128k", output]);
    return readFile(output);
  });
}

async function hasAudio(file: string): Promise<boolean> {
  const out = await run(["-i", file, "-f", "null", "-t", "0", "-"]).catch((e: Error) => e.message);
  return /Audio:/.test(out);
}

async function joinWithSegmentAudio(dir: string, files: string[], logoPng?: Buffer | null, maxSeconds?: number, cropAspect?: string | null): Promise<{ buffer: Buffer; duration: number }> {
  const inputs = files.flatMap((f) => ["-i", f]);
  const audioLabels: string[] = [];
  let extra = files.length;
  for (let i = 0; i < files.length; i++) {
    if (await hasAudio(files[i])) {
      audioLabels.push(`[${i}:a:0]`);
    } else {
      // Trecho sem áudio: silêncio do mesmo tamanho, para a concatenação funcionar.
      inputs.push("-f", "lavfi", "-t", (await probeDuration(files[i])).toFixed(2), "-i", "anullsrc=r=44100:cl=stereo");
      audioLabels.push(`[${extra++}:a:0]`);
    }
  }
  let graph =
    files.map((_, i) => `[${i}:v:0]setsar=1[v${i}]`).join(";") + ";" +
    audioLabels.map((l, i) => `${l}aresample=44100,aformat=channel_layouts=stereo[a${i}]`).join(";") + ";" +
    files.map((_, i) => `[v${i}][a${i}]`).join("") + `concat=n=${files.length}:v=1:a=1[v][a]`;
  const tail = await cropAndLogo(dir, files[0], inputs, graph, logoPng, cropAspect);
  graph = tail.graph;
  const vOut = tail.out;
  const output = path.join(dir, "final.mp4");
  await run([...inputs, "-filter_complex", graph, "-map", vOut, "-map", "[a]", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", ...(maxSeconds ? ["-t", String(maxSeconds)] : []), "-movflags", "+faststart", output], 300_000);
  return { buffer: await readFile(output), duration: Math.round(await probeDuration(output)) };
}

/**
 * Recorte central no formato pedido (ex.: vídeo 9:16 do Veo -> 4:5 do Feed ou 1:1 do Facebook) e logo no canto,
 * aplicados sobre a saída "[v]" do filtro. Devolve o filtro completo e o rótulo final do vídeo.
 */
async function cropAndLogo(dir: string, firstFile: string, inputs: string[], graph: string, logoPng?: Buffer | null, cropAspect?: string | null) {
  let label = "[v]";
  let { width, height } = await probeSize(firstFile);
  const m = /^(\d+):(\d+)$/.exec(cropAspect || "");
  if (m) {
    const ratio = Number(m[1]) / Number(m[2]);
    let cw = width;
    let ch = Math.round(width / ratio);
    if (ch > height) {
      ch = height;
      cw = Math.round(height * ratio);
    }
    cw -= cw % 2;
    ch -= ch % 2;
    if (cw !== width || ch !== height) {
      graph += `;${label}crop=${cw}:${ch}[vc]`;
      label = "[vc]";
      width = cw;
      height = ch;
    }
  }
  if (logoPng) {
    const logo = path.join(dir, "logo.png");
    await writeFile(logo, logoPng);
    const index = inputs.filter((x) => x === "-i").length;
    inputs.push("-i", logo);
    const w = Math.max(32, Math.round(width * LOGO_WIDTH_RATIO / 2) * 2);
    const margin = Math.round(width * LOGO_MARGIN_RATIO);
    graph += `;[${index}:v]scale=${w}:-1[lg];${label}[lg]overlay=W-w-${margin}:H-h-${margin}:format=auto[vl]`;
    label = "[vl]";
  }
  return { graph, out: label };
}

/** Largura e altura do primeiro stream de vídeo. */
async function probeSize(file: string): Promise<{ width: number; height: number }> {
  const out = await run(["-i", file, "-f", "null", "-t", "0", "-"]).catch((e: Error) => e.message);
  const m = /Video:.*?, (\d{2,5})x(\d{2,5})/.exec(out);
  return m ? { width: Number(m[1]), height: Number(m[2]) } : { width: 720, height: 1280 };
}

/**
 * Une os trechos (na ordem), aplica o logo (opcional) e coloca a locução. Se a fala for mais longa
 * que o vídeo, o último quadro é estendido para ela não ser cortada; se for mais curta, o resto fica em silêncio.
 */
export async function assembleVideo(
  segments: Buffer[],
  narration: Buffer | null,
  logoPng?: Buffer | null,
  opts: { segmentAudio?: boolean; maxSeconds?: number; cropAspect?: string | null } = {}
): Promise<{ buffer: Buffer; duration: number }> {
  if (segments.length === 0) throw new Error("Nenhum trecho para montar");
  return withTempDir(async (dir) => {
    const files = await Promise.all(
      segments.map(async (buf, i) => {
        const f = path.join(dir, `seg${i}.mp4`);
        await writeFile(f, buf);
        return f;
      })
    );

    // Trechos que já trazem a locução (modelos com lip-sync): une vídeo E áudio de cada trecho.
    if (opts.segmentAudio) return joinWithSegmentAudio(dir, files, logoPng, opts.maxSeconds, opts.cropAspect);

    // Modelos com durações fixas (ex.: Veo 8+8 s para um vídeo de 15 s): corta no total pedido.
    const trim = opts.maxSeconds ? ["-t", String(opts.maxSeconds)] : [];

    // 1) Concatena re-codificando (os trechos podem vir com parâmetros levemente diferentes) e aplica o logo.
    const joined = path.join(dir, "joined.mp4");
    const inputs = files.flatMap((f) => ["-i", f]);
    let graph = files.map((_, i) => `[${i}:v:0]setsar=1[v${i}]`).join(";") + ";" + files.map((_, i) => `[v${i}]`).join("") + `concat=n=${files.length}:v=1:a=0[v]`;
    const tail = await cropAndLogo(dir, files[0], inputs, graph, logoPng, opts.cropAspect);
    graph = tail.graph;
    const out = tail.out;
    await run([...inputs, "-filter_complex", graph, "-map", out, "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p", "-an", ...trim, joined], 240_000);

    const videoDuration = await probeDuration(joined);
    const output = path.join(dir, "final.mp4");

    if (!narration) {
      await run(["-i", joined, "-c", "copy", "-movflags", "+faststart", output]);
      return { buffer: await readFile(output), duration: Math.round(videoDuration) };
    }

    const voice = path.join(dir, "voice.mp3");
    await writeFile(voice, narration);
    const voiceDuration = await probeDuration(voice);
    const extra = Math.max(0, voiceDuration + 0.4 - videoDuration);

    // 2) Áudio: a locução + silêncio até o fim do vídeo. Vídeo: congela o último quadro se a fala for maior.
    const vf = extra > 0 ? ["-vf", `tpad=stop_mode=clone:stop_duration=${extra.toFixed(2)}`, "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p"] : ["-c:v", "copy"];
    await run(["-i", joined, "-i", voice, "-map", "0:v:0", "-map", "1:a:0", ...vf, "-af", "apad", "-c:a", "aac", "-b:a", "160k", "-shortest", "-movflags", "+faststart", output], 240_000);
    return { buffer: await readFile(output), duration: Math.round(Math.max(videoDuration, voiceDuration)) };
  });
}
