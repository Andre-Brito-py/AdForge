import { describe, expect, it } from "vitest";
import { execFileSync } from "child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import ffmpegStatic from "ffmpeg-static";
import { planSegments, planVideo, segmentPrompt, videoModelCaps } from "@/lib/video-models";
import { parseKeyframeReview } from "@/services/ai/keyframe";
import { assembleVideo, sliceAudio } from "@/lib/video-assembly";

const ffmpeg = ffmpegStatic as string;
function fixture(args: string[], name: string) {
  const dir = mkdtempSync(path.join(tmpdir(), "vysify-smart-"));
  const file = path.join(dir, name);
  execFileSync(ffmpeg, ["-hide_banner", "-loglevel", "error", "-y", ...args, file]);
  const buf = readFileSync(file);
  rmSync(dir, { recursive: true, force: true });
  return buf;
}
function info(buf: Buffer, ext = "mp4") {
  const dir = mkdtempSync(path.join(tmpdir(), "vysify-smart-"));
  const file = path.join(dir, `x.${ext}`);
  writeFileSync(file, buf);
  let out = "";
  try { execFileSync(ffmpeg, ["-hide_banner", "-i", file], { stdio: "pipe" }); } catch (e) { out = String((e as { stderr: Buffer }).stderr); }
  rmSync(dir, { recursive: true, force: true });
  const m = /Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/.exec(out)!;
  return { duration: Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]), audio: /Audio:/.test(out) };
}

describe("modelos de vídeo e plano de pedidos", () => {
  it("Wan 2.6 aceita 5/10/15 s e lip-sync; Wan 2.1/2.2 só trechos de 5 s", () => {
    expect(videoModelCaps("wan/v2.6/image-to-video")).toMatchObject({ durations: [5, 10, 15], lipSyncAudio: true });
    expect(videoModelCaps("fal-ai/wan/v2.2-a14b/image-to-video")).toMatchObject({ durations: [5], lipSyncAudio: false });
    expect(videoModelCaps("fal-ai/wan-i2v").resolution.standard).toBe("480p");
  });

  it("menos emendas possível, em partes iguais", () => {
    const d = [5, 10, 15];
    expect(planSegments(5, d)).toEqual([5]);
    expect(planSegments(10, d)).toEqual([10]);
    expect(planSegments(15, d)).toEqual([15]);
    expect(planSegments(20, d)).toEqual([10, 10]);
    expect(planSegments(30, d)).toEqual([15, 15]);
    expect(planSegments(15, [5])).toEqual([5, 5, 5]);
  });

  it("Veo: 4/6/8 s por pedido, com corte no total (15 s = 8+8 cortado em 15)", () => {
    expect(videoModelCaps("veo-3.1-fast-generate-preview")).toMatchObject({ provider: "veo", durations: [4, 6, 8], lipSyncAudio: false });
    expect(videoModelCaps("wan/v2.6/image-to-video").provider).toBe("fal");
    const d = [4, 6, 8];
    expect(planSegments(5, d)).toEqual([6]);
    expect(planSegments(10, d)).toEqual([6, 4]);
    expect(planSegments(15, d)).toEqual([8, 8]);
    expect(planSegments(20, d)).toEqual([8, 6, 6]);
    expect(planSegments(30, d)).toEqual([8, 8, 8, 6]);
  });

  it("Veo 3.1/Fast estendem o próprio vídeo (8 + 7 s...); Lite e Wan não", () => {
    const fast = videoModelCaps("veo-3.1-fast-generate-preview");
    expect(fast.extensionSeconds).toBe(7);
    expect(videoModelCaps("veo-3.1-lite-generate-preview").extensionSeconds).toBeUndefined();
    expect(planVideo(15, fast)).toEqual({ segments: [8, 7], extend: true });
    expect(planVideo(30, fast)).toEqual({ segments: [8, 7, 7, 7, 7], extend: true });
    expect(planVideo(5, fast)).toEqual({ segments: [6], extend: false }); // curto: um pedido só
    expect(planVideo(15, videoModelCaps("wan/v2.6/image-to-video"))).toEqual({ segments: [15], extend: false });
  });

  it("um pedido de 15 s descreve as 3 cenas em sequência, num plano contínuo", () => {
    const p = segmentPrompt(["a", "b", "c", "d", "e", "f"], 15, 15);
    expect(p).toBe("One continuous shot, no cuts. 0-5s: d 5-10s: e 10-15s: f");
    expect(segmentPrompt(["a", "b"], 5, 5)).toBe("b");
  });
});

describe("revisão do quadro de abertura", () => {
  it("nota baixa reprova mesmo se o modelo disser pass=true", () => {
    expect(parseKeyframeReview('{"score": 5, "pass": true, "issues": ["bottle too big"]}').pass).toBe(false);
    expect(parseKeyframeReview('{"score": 8, "pass": true, "issues": []}').pass).toBe(true);
    expect(parseKeyframeReview('{"score": 9, "pass": false, "issues": ["extra finger"]}').pass).toBe(false);
  });
});

describe("locução por trecho (lip-sync) e montagem com áudio dos trechos", () => {
  const voice = fixture(["-f", "lavfi", "-i", "sine=frequency=300:duration=12", "-c:a", "libmp3lame"], "v.mp3");

  it("corta a parte certa da locução e garante no mínimo 3 s", async () => {
    expect(info((await sliceAudio(voice, 0, 10))!, "mp3").duration).toBeGreaterThan(9.5);
    // Sobram só 2 s de fala a partir dos 10 s: completa com silêncio até 3 s (mínimo do modelo).
    expect(info((await sliceAudio(voice, 10, 10))!, "mp3").duration).toBeGreaterThanOrEqual(2.9);
    // A fala já acabou: esse trecho vai sem áudio.
    expect(await sliceAudio(voice, 15, 5)).toBeNull();
  }, 60_000);

  it("corta o vídeo montado na duração pedida (8+8 s -> 15 s)", async () => {
    const clip = fixture(["-f", "lavfi", "-i", "color=c=green:s=320x568:r=16:d=8", "-c:v", "libx264", "-pix_fmt", "yuv420p"], "g.mp4");
    const out = await assembleVideo([clip, clip], voice, null, { maxSeconds: 15 });
    const i = info(out.buffer);
    expect(i.duration).toBeGreaterThan(14.5);
    expect(i.duration).toBeLessThan(15.5);
    expect(i.audio).toBe(true);
  }, 120_000);

  it("une trechos que já têm áudio (e completa com silêncio o que não tem)", async () => {
    const withAudio = fixture(["-f", "lavfi", "-i", "color=c=red:s=320x568:r=16:d=2", "-f", "lavfi", "-i", "sine=duration=2", "-shortest", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac"], "a.mp4");
    const silent = fixture(["-f", "lavfi", "-i", "color=c=blue:s=320x568:r=16:d=2", "-c:v", "libx264", "-pix_fmt", "yuv420p"], "b.mp4");
    const out = await assembleVideo([withAudio, silent], null, null, { segmentAudio: true });
    const i = info(out.buffer);
    expect(i.audio).toBe(true);
    expect(i.duration).toBeGreaterThan(3.5);
  }, 120_000);
});
