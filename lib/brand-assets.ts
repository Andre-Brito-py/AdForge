import { Jimp } from "jimp";
import { readOwnMedia } from "./storage";
import { imageToPng, LOGO_MARGIN_RATIO, LOGO_WIDTH_RATIO } from "./video-assembly";

/**
 * Uso do Brand Kit nos criativos: logo no canto (imagens e vídeos), domínio do site para a legenda
 * e nome aproximado da cor (os modelos de imagem/vídeo entendem melhor "roxo" do que "#7C3AED").
 */

/** Logo do Brand Kit em PNG (aceita PNG/JPG/WEBP no upload). */
export async function loadLogoPng(logoUrl: string | null | undefined): Promise<Buffer | null> {
  if (!logoUrl) return null;
  const { buffer } = await readOwnMedia(logoUrl);
  return imageToPng(buffer);
}

/** Aplica o logo no canto inferior direito de uma imagem, mantendo o formato original. */
export async function applyLogoToImage(image: { buffer: Buffer; mimeType: string }, logoPng: Buffer): Promise<{ buffer: Buffer; mimeType: string }> {
  const img = await Jimp.read(image.buffer);
  const logo = await Jimp.read(logoPng);
  const w = Math.max(32, Math.round(img.width * LOGO_WIDTH_RATIO));
  logo.resize({ w });
  // Logos muito altos (verticais) não podem ocupar mais de 22% da altura.
  if (logo.height > img.height * 0.22) logo.resize({ h: Math.round(img.height * 0.22) });
  const margin = Math.round(img.width * LOGO_MARGIN_RATIO);
  img.composite(logo, img.width - logo.width - margin, img.height - logo.height - margin);
  const mimeType = image.mimeType === "image/jpeg" ? "image/jpeg" : "image/png";
  return { buffer: await img.getBuffer(mimeType), mimeType };
}

/** "https://www.termix.com.br/loja?x=1" -> "termix.com.br" */
export function websiteDomain(website: string | null | undefined): string | null {
  if (!website) return null;
  try {
    const host = new URL(website).hostname.replace(/^www\./i, "");
    return host || null;
  } catch {
    return null;
  }
}

/** Nome aproximado (em inglês) de uma cor hex, para prompts de imagem/vídeo. */
export function colorName(hex: string | null | undefined): string | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (s < 0.15) return l < 0.2 ? "black" : l > 0.85 ? "white" : "gray";
  let h = d === 0 ? 0 : max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  const tone = l < 0.3 ? "dark " : l > 0.72 ? "light " : "";
  const names: [number, string][] = [[15, "red"], [40, "orange"], [65, "yellow"], [160, "green"], [195, "teal"], [250, "blue"], [290, "purple"], [335, "pink"], [360, "red"]];
  return tone + names.find(([limit]) => h < limit)![1];
}

/** Trecho de prompt com a cor da marca (ou vazio). */
export function brandColorDirection(hex: string | null | undefined): string {
  const name = colorName(hex);
  return name ? `Use subtle ${name} accents (brand color ${hex!.toUpperCase()}) in the background, props or lighting.` : "";
}
