import { describe, expect, it } from "vitest";
import { execFileSync } from "child_process";
import { mkdtempSync, readFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import ffmpegStatic from "ffmpeg-static";
import { Jimp, intToRGBA } from "jimp";
import { applyLogoToImage, brandColorDirection, colorName, websiteDomain } from "@/lib/brand-assets";
import { assembleVideo, imageToPng, lastFrame } from "@/lib/video-assembly";

const ffmpeg = ffmpegStatic as string;
function fixture(args: string[], name: string) {
  const dir = mkdtempSync(path.join(tmpdir(), "vysify-brand-"));
  const file = path.join(dir, name);
  execFileSync(ffmpeg, ["-hide_banner", "-loglevel", "error", "-y", ...args, file]);
  const buf = readFileSync(file);
  rmSync(dir, { recursive: true, force: true });
  return buf;
}
const solid = (color: string, w: number, h: number, name = "img.png") => fixture(["-f", "lavfi", "-i", `color=c=${color}:s=${w}x${h}`, "-frames:v", "1"], name);
const pixel = async (png: Buffer, fx: number, fy: number) => {
  const img = await Jimp.read(png);
  return intToRGBA(img.getPixelColor(Math.floor(img.width * fx), Math.floor(img.height * fy)));
};

describe("Brand Kit nos criativos", () => {
  it("logo vai para o canto inferior direito da imagem; o resto fica intacto", async () => {
    const image = solid("blue", 400, 500);
    const logo = await imageToPng(solid("red", 100, 50, "logo.jpg")); // JPG também é aceito
    const out = await applyLogoToImage({ buffer: image, mimeType: "image/png" }, logo);
    const corner = await pixel(out.buffer, 0.85, 0.94);
    expect(corner.r).toBeGreaterThan(200);
    expect(corner.b).toBeLessThan(60);
    const topLeft = await pixel(out.buffer, 0.1, 0.1);
    expect(topLeft.b).toBeGreaterThan(200);
    expect(topLeft.r).toBeLessThan(60);
  }, 60_000);

  it("logo também entra no vídeo final (canto inferior direito)", async () => {
    const clip = fixture(["-f", "lavfi", "-i", "color=c=blue:s=320x568:r=16:d=1", "-c:v", "libx264", "-pix_fmt", "yuv420p"], "clip.mp4");
    const logo = await imageToPng(solid("red", 100, 50));
    const { buffer } = await assembleVideo([clip], null, logo);
    const frame = await lastFrame(buffer);
    const corner = await pixel(frame, 0.85, 0.95);
    expect(corner.r).toBeGreaterThan(180);
    expect(corner.b).toBeLessThan(90);
    const center = await pixel(frame, 0.5, 0.4);
    expect(center.b).toBeGreaterThan(180);
  }, 120_000);

  it("domínio do site para a legenda", () => {
    expect(websiteDomain("https://www.termix.com.br/loja?x=1")).toBe("termix.com.br");
    expect(websiteDomain("nada")).toBeNull();
    expect(websiteDomain(null)).toBeNull();
  });

  it("nome da cor para os prompts de imagem e vídeo", () => {
    expect(colorName("#7C3AED")).toBe("purple");
    expect(colorName("#16A34A")).toBe("green");
    expect(colorName("#111111")).toBe("black");
    expect(colorName("#FDE68A")).toBe("light yellow");
    expect(colorName("roxo")).toBeNull();
    expect(brandColorDirection("#7c3aed")).toContain("purple accents (brand color #7C3AED)");
    expect(brandColorDirection(null)).toBe("");
  });
});
