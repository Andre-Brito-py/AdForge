import { describe, expect, it } from "vitest";
import { execFileSync } from "child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { Jimp, intToRGBA } from "jimp";
import { tmpdir } from "os";
import path from "path";
import ffmpegStatic from "ffmpeg-static";
import { assembleVideo, lastFrame } from "@/lib/video-assembly";

const ffmpeg = ffmpegStatic as string;

/** Gera um clipe de teste (cor sólida) e uma "locução" (tom) com o próprio ffmpeg. */
function fixture(args: string[], name: string) {
  const dir = mkdtempSync(path.join(tmpdir(), "vysify-test-"));
  const file = path.join(dir, name);
  execFileSync(ffmpeg, ["-hide_banner", "-loglevel", "error", "-y", ...args, file]);
  const buf = readFileSync(file);
  rmSync(dir, { recursive: true, force: true });
  return buf;
}
const clip = (color: string, seconds = 2) =>
  fixture(["-f", "lavfi", "-i", `color=c=${color}:s=320x568:r=16:d=${seconds}`, "-c:v", "libx264", "-pix_fmt", "yuv420p"], "clip.mp4");
const tone = (seconds: number) => fixture(["-f", "lavfi", "-i", `sine=frequency=440:duration=${seconds}`, "-c:a", "libmp3lame"], "voice.mp3");

function info(buf: Buffer) {
  const dir = mkdtempSync(path.join(tmpdir(), "vysify-test-"));
  const file = path.join(dir, "out.mp4");
  writeFileSync(file, buf);
  let out = "";
  try {
    execFileSync(ffmpeg, ["-hide_banner", "-i", file], { stdio: "pipe" });
  } catch (e) {
    out = String((e as { stderr: Buffer }).stderr);
  }
  rmSync(dir, { recursive: true, force: true });
  const m = /Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/.exec(out)!;
  return { duration: Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]), hasAudio: /Audio:/.test(out), hasVideo: /Video:/.test(out) };
}

describe("montagem de vídeo (ffmpeg)", () => {
  it("extrai o ÚLTIMO quadro (não o primeiro) como PNG", async () => {
    // Clipe que começa vermelho e termina azul: o quadro extraído tem que ser azul.
    const redThenBlue = (await assembleVideo([clip("red"), clip("blue")], null)).buffer;
    const png = await lastFrame(redThenBlue);
    expect(png.subarray(1, 4).toString()).toBe("PNG");
    const img = await Jimp.read(png);
    const { r, g, b } = intToRGBA(img.getPixelColor(Math.floor(img.width / 2), Math.floor(img.height / 2)));
    expect(b).toBeGreaterThan(200);
    expect(r).toBeLessThan(60);
    expect(g).toBeLessThan(60);
  }, 60_000);

  it("une 3 trechos e coloca a locução dentro do MP4", async () => {
    const out = await assembleVideo([clip("red"), clip("green"), clip("blue")], tone(4));
    const i = info(out.buffer);
    expect(i.hasVideo).toBe(true);
    expect(i.hasAudio).toBe(true);
    expect(i.duration).toBeGreaterThan(5.5);
    expect(i.duration).toBeLessThan(6.6);
  }, 120_000);

  it("estende o último quadro quando a fala é mais longa que o vídeo (não corta a locução)", async () => {
    const out = await assembleVideo([clip("red", 2)], tone(4));
    const i = info(out.buffer);
    expect(i.duration).toBeGreaterThan(4);
  }, 120_000);

  it("sem locução, entrega só o vídeo unido", async () => {
    const out = await assembleVideo([clip("red"), clip("blue")], null);
    const i = info(out.buffer);
    expect(i.hasAudio).toBe(false);
    expect(i.duration).toBeGreaterThan(3.5);
  }, 120_000);
});
