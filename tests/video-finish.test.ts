import { describe, expect, it } from "vitest";
import { execFileSync } from "child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { Jimp, intToRGBA } from "jimp";
import { tmpdir } from "os";
import path from "path";
import ffmpegStatic from "ffmpeg-static";
import {
  assColor, buildAss, captionChunks, captionFontPath, estimateWordTimings, finishVideo, frameGeometry, wordsFromAlignment,
} from "@/lib/video-finish";
import { formatPrice } from "@/lib/video-formats";

const ffmpeg = ffmpegStatic as string;

function tmp<T>(fn: (dir: string) => T): T {
  const dir = mkdtempSync(path.join(tmpdir(), "vysify-test-"));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Clipe preto com áudio (as legendas e a tela final ficam fáceis de detectar). */
const blackClip = (w: number, h: number, seconds: number) =>
  tmp((dir) => {
    const file = path.join(dir, "clip.mp4");
    execFileSync(ffmpeg, [
      "-hide_banner", "-loglevel", "error", "-y",
      "-f", "lavfi", "-i", `color=c=black:s=${w}x${h}:r=16:d=${seconds}`,
      "-f", "lavfi", "-i", `sine=frequency=440:duration=${seconds}`,
      "-shortest", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", file,
    ]);
    return readFileSync(file);
  });

/** Quadro em `t` segundos e a fração de pixels claros na faixa vertical [y0, y1] (0..1). */
async function brightShare(video: Buffer, t: number, y0: number, y1: number) {
  const png = tmp((dir) => {
    const input = path.join(dir, "in.mp4");
    const out = path.join(dir, "frame.png");
    writeFileSync(input, video);
    execFileSync(ffmpeg, ["-hide_banner", "-loglevel", "error", "-y", "-ss", String(t), "-i", input, "-frames:v", "1", out]);
    return readFileSync(out);
  });
  const img = await Jimp.read(png);
  const { width, height } = img.bitmap;
  let bright = 0;
  let total = 0;
  for (let y = Math.floor(height * y0); y < Math.floor(height * y1); y += 2) {
    for (let x = 0; x < width; x += 2) {
      const { r, g, b } = intToRGBA(img.getPixelColor(x, y));
      if (r + g + b > 450) bright++;
      total++;
    }
  }
  return { share: bright / total, width, height };
}

describe("legendas", () => {
  it("monta palavras a partir do alinhamento por caractere da ElevenLabs", () => {
    const text = "Oi, tudo bem?";
    const chars = [...text];
    const words = wordsFromAlignment({
      characters: chars,
      character_start_times_seconds: chars.map((_, i) => i * 0.1),
      character_end_times_seconds: chars.map((_, i) => i * 0.1 + 0.08),
    });
    expect(words.map((w) => w.w)).toEqual(["Oi,", "tudo", "bem?"]);
    expect(words[1]).toMatchObject({ s: 0.4, e: 0.78 });
  });

  it("estima os tempos pela duração quando a voz não informa", () => {
    const words = estimateWordTimings("Compre já 🔥 o seu", 4);
    expect(words.map((w) => w.w)).toEqual(["Compre", "já", "o", "seu"]);
    expect(words[0].s).toBeGreaterThan(0);
    expect(words[words.length - 1].e).toBeLessThanOrEqual(4);
    for (let i = 1; i < words.length; i++) expect(words[i].s).toBeGreaterThanOrEqual(words[i - 1].e - 0.001);
  });

  it("agrupa em blocos curtos e quebra na pontuação", () => {
    const words = estimateWordTimings("Cansado de fone que cai? Conheça o Nexaudio Pro hoje mesmo.", 6);
    const chunks = captionChunks(words).map((c) => c.map((w) => w.w).join(" "));
    expect(chunks.every((c) => c.split(" ").length <= 4)).toBe(true);
    expect(chunks.some((c) => c.endsWith("cai?"))).toBe(true);
  });

  it("esconde as legendas durante a tela final e escapa caracteres do ASS", () => {
    const words = [{ w: "{oi}", s: 0.2, e: 0.6 }, { w: "final", s: 7.5, e: 7.9 }];
    const ass = buildAss(720, 1280, 8, { captions: words, endCard: { cta: "Compre agora", price: "R$ 89,90" } })!;
    expect(ass).toContain("PlayResX: 720");
    expect(ass).toContain("Compre agora");
    expect(ass).toContain("R$ 89,90");
    expect(ass).not.toMatch(/Cap,,0,0,0,,.*final/); // a palavra que cai na tela final não aparece
    expect(ass).not.toContain("{oi}");
  });

  it("sem legendas nem tela final não gera arquivo", () => {
    expect(buildAss(720, 1280, 8, { captions: [], endCard: { cta: " " } })).toBeNull();
  });

  it("converte a cor para o formato do ASS", () => {
    expect(assColor("#7C3AED")).toBe("&H00ED3A7C&");
  });
});

describe("formatos", () => {
  it("recorta quando mantém imagem e resolução; senão encaixa sobre fundo desfocado", () => {
    expect(frameGeometry(720, 1280, "1:1")).toEqual({ mode: "crop", width: 720, height: 720 });
    expect(frameGeometry(720, 1280, "4:5")).toEqual({ mode: "crop", width: 720, height: 900 });
    expect(frameGeometry(720, 1280, "16:9")).toEqual({ mode: "pad", width: 1280, height: 720 });
    expect(frameGeometry(720, 720, "9:16")).toEqual({ mode: "pad", width: 404, height: 720 });
    expect(frameGeometry(720, 1280, "9:16")).toEqual({ mode: "crop", width: 720, height: 1280 });
  });

  it("formata o preço na moeda e no idioma do anúncio", () => {
    expect(formatPrice(89.9, "BRL", "pt-BR")).toMatch(/R\$\s?89,90/);
    expect(formatPrice(19.9, "USD", "en-US")).toBe("$19.90");
    expect(formatPrice(null, "BRL", "pt-BR")).toBeNull();
    expect(formatPrice(0, "BRL", "pt-BR")).toBeNull();
  });
});

describe("acabamento do vídeo (ffmpeg)", () => {
  it("encontra a fonte das legendas", () => {
    expect(captionFontPath()).toBeTruthy();
  });

  it("aplica formato, legendas e tela final mantendo o áudio", async () => {
    const master = blackClip(360, 640, 6);
    const captions = estimateWordTimings("Som potente para o seu dia", 3.5);
    const out = await finishVideo(master, { aspect: "1:1", captions, endCard: { offer: "Frete grátis", price: "R$ 89,90", cta: "Compre agora", color: "#7C3AED" } });
    expect(out.width).toBe(360);
    expect(out.height).toBe(360);

    // Legenda: texto claro na parte de baixo enquanto a locução fala; tela final: texto no meio no fim.
    const caption = await brightShare(out.buffer, 1.5, 0.55, 0.95);
    const endCard = await brightShare(out.buffer, 5.5, 0.3, 0.75);
    const middleBefore = await brightShare(out.buffer, 1.5, 0.3, 0.5);
    expect(caption.share).toBeGreaterThan(0.003);
    expect(endCard.share).toBeGreaterThan(0.01);
    expect(middleBefore.share).toBe(0);

    const probe = tmp((dir) => {
      const f = path.join(dir, "o.mp4");
      writeFileSync(f, out.buffer);
      try {
        execFileSync(ffmpeg, ["-hide_banner", "-i", f], { stdio: "pipe" });
        return "";
      } catch (e) {
        return String((e as { stderr: Buffer }).stderr);
      }
    });
    expect(probe).toMatch(/Audio:/);
  }, 60_000);

  it("sem nada a fazer devolve o próprio vídeo", async () => {
    const master = blackClip(320, 568, 1);
    const out = await finishVideo(master, { aspect: "9:16" });
    expect(out.buffer).toBe(master);
  }, 30_000);
});
