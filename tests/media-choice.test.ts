import { describe, expect, it } from "vitest";
import { execFileSync } from "child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import ffmpegStatic from "ffmpeg-static";
import { DEFAULT_COSTS, PLATFORMS, costPerVariation, resolveMedia } from "@/lib/catalog";
import { generationAspect, videoModelCaps } from "@/lib/video-models";
import { campaignSchema } from "@/lib/validation";
import { assembleVideo } from "@/lib/video-assembly";

describe("imagem ou vídeo em cada formato", () => {
  it("Feed, Facebook e Stories aceitam os dois; Reels é sempre vídeo; padrão = o do formato", () => {
    expect(resolveMedia("FACEBOOK_ADS", "VIDEO")).toBe("VIDEO");
    expect(resolveMedia("FACEBOOK_ADS", null)).toBe("IMAGE");
    expect(resolveMedia("INSTAGRAM_FEED", "VIDEO")).toBe("VIDEO");
    expect(resolveMedia("REELS_TIKTOK", "IMAGE")).toBe("VIDEO");
    expect(PLATFORMS.STORIES.mediaOptions).toContain("VIDEO");
  });

  it("o custo segue a mídia escolhida", () => {
    expect(costPerVariation(DEFAULT_COSTS, "FACEBOOK_ADS", "standard", 10, "VIDEO")).toBe(DEFAULT_COSTS.video * 2);
    expect(costPerVariation(DEFAULT_COSTS, "FACEBOOK_ADS", "standard", 10, "IMAGE")).toBe(DEFAULT_COSTS.image);
  });

  it("o pedido aceita a escolha de mídia", () => {
    const ok = campaignSchema.parse({ productId: "6f1c2a52-6b1e-4c43-9b8e-4b2f4f1a7c11", objective: "SALES", platform: "FACEBOOK_ADS", style: "STUDIO", variations: 1, media: "VIDEO" });
    expect(ok.media).toBe("VIDEO");
  });
});

describe("formato do vídeo", () => {
  it("Veo gera vertical e recorta 1:1/4:5; Wan gera direto no formato", () => {
    const veo = videoModelCaps("veo-3.1-fast-generate-preview");
    expect(generationAspect(veo, "1:1")).toEqual({ generate: "9:16", cropTo: "1:1" });
    expect(generationAspect(veo, "4:5")).toEqual({ generate: "9:16", cropTo: "4:5" });
    expect(generationAspect(veo, "9:16")).toEqual({ generate: "9:16", cropTo: null });
    expect(generationAspect(videoModelCaps("wan/v2.6/image-to-video"), "1:1")).toEqual({ generate: "1:1", cropTo: null });
  });

  it("recorte central: vídeo 9:16 vira 1:1 na montagem", async () => {
    const ff = ffmpegStatic as string;
    const dir = mkdtempSync(path.join(tmpdir(), "vysify-crop-"));
    const src = path.join(dir, "v.mp4");
    execFileSync(ff, ["-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i", "color=c=blue:s=720x1280:r=16:d=1", "-c:v", "libx264", "-pix_fmt", "yuv420p", src]);
    const out = await assembleVideo([readFileSync(src)], null, null, { cropAspect: "1:1" });
    const dst = path.join(dir, "o.mp4");
    writeFileSync(dst, out.buffer);
    let info = "";
    try { execFileSync(ff, ["-hide_banner", "-i", dst], { stdio: "pipe" }); } catch (e) { info = String((e as { stderr: Buffer }).stderr); }
    rmSync(dir, { recursive: true, force: true });
    expect(info).toMatch(/720x720/);
  }, 60_000);
});
