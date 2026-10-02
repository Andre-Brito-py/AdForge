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
export async function assembleVideo(segments: Buffer[], narration: Buffer | null, logoPng?: Buffer | null): Promise<{ buffer: Buffer; duration: number }> {
  if (segments.length === 0) throw new Error("Nenhum trecho para montar");
  return withTempDir(async (dir) => {
    const files = await Promise.all(
      segments.map(async (buf, i) => {
        const f = path.join(dir, `seg${i}.mp4`);
        await writeFile(f, buf);
        return f;
      })
    );

    // 1) Concatena re-codificando (os trechos podem vir com parâmetros levemente diferentes) e aplica o logo.
    const joined = path.join(dir, "joined.mp4");
    const inputs = files.flatMap((f) => ["-i", f]);
    let graph = files.map((_, i) => `[${i}:v:0]setsar=1[v${i}]`).join(";") + ";" + files.map((_, i) => `[v${i}]`).join("") + `concat=n=${files.length}:v=1:a=0[v]`;
    let out = "[v]";
    if (logoPng) {
      const logo = path.join(dir, "logo.png");
      await writeFile(logo, logoPng);
      inputs.push("-i", logo);
      const { width } = await probeSize(files[0]);
      const w = Math.max(32, Math.round(width * LOGO_WIDTH_RATIO / 2) * 2);
      const margin = Math.round(width * LOGO_MARGIN_RATIO);
      graph += `;[${files.length}:v]scale=${w}:-1[lg];[v][lg]overlay=W-w-${margin}:H-h-${margin}:format=auto[vl]`;
      out = "[vl]";
    }
    await run([...inputs, "-filter_complex", graph, "-map", out, "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p", "-an", joined], 240_000);

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
