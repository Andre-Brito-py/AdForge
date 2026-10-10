import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { execFileSync } from "child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import ffmpegStatic from "ffmpeg-static";

const url = process.env.TEST_DATABASE_URL;
const ffmpeg = ffmpegStatic as string;

vi.mock("@/services/email", () => ({
  sendWelcomeEmail: vi.fn(async () => {}),
  appUrl: () => "https://app.vysify.test",
}));

// Armazenamento em memória: o teste não escreve em public/uploads.
const files = new Map<string, Buffer>();
vi.mock("@/lib/storage", () => ({
  saveFile: vi.fn(async (buffer: Buffer, key: string) => {
    files.set(`/mem/${key}`, buffer);
    return `/mem/${key}`;
  }),
  readOwnMedia: vi.fn(async (u: string) => {
    const buffer = files.get(u);
    if (!buffer) throw new Error(`arquivo ausente: ${u}`);
    return { buffer, mimeType: u.endsWith(".mp3") ? "audio/mpeg" : "video/mp4" };
  }),
}));

function media(args: string[], name: string) {
  const dir = mkdtempSync(path.join(tmpdir(), "vysify-test-"));
  try {
    const file = path.join(dir, name);
    execFileSync(ffmpeg, ["-hide_banner", "-loglevel", "error", "-y", ...args, file]);
    return readFileSync(file);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Tamanho do vídeo lido do cabeçalho. */
function size(buf: Buffer) {
  const dir = mkdtempSync(path.join(tmpdir(), "vysify-test-"));
  try {
    const f = path.join(dir, "v.mp4");
    writeFileSync(f, buf);
    let out = "";
    try {
      execFileSync(ffmpeg, ["-hide_banner", "-i", f], { stdio: "pipe" });
    } catch (e) {
      out = String((e as { stderr: Buffer }).stderr);
    }
    const m = /Video:.*?, (\d{2,5})x(\d{2,5})/.exec(out)!;
    return `${m[1]}x${m[2]}`;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe.skipIf(!url)("formatos do vídeo (banco)", async () => {
  const { db } = await import("@/lib/db");
  const { createUserWithWorkspace } = await import("@/lib/users");
  const { finishGeneratedVideo, videoFormatUrl, parseFormats } = await import("@/lib/video-formats");
  const { serializeVideoSpec } = await import("@/lib/video-plan");

  const email = `formats-${Date.now()}@exemplo.com`;
  let workspaceId = "";
  let creativeId = "";

  beforeAll(async () => {
    workspaceId = (await createUserWithWorkspace({ email, name: "Formatos" })).workspaceId;
    files.set("/mem/voice.mp3", media(["-f", "lavfi", "-i", "sine=frequency=440:duration=3", "-c:a", "libmp3lame"], "v.mp3"));
    const product = await db.product.create({ data: { workspaceId, name: "Caixa de som", price: 149.9, originalImageUrl: "/mem/p.png" } });
    const campaign = await db.campaign.create({
      data: { workspaceId, productId: product.id, name: "Camp", objective: "SALES", tone: "STUDIO", status: "GENERATING", language: "pt-BR", videoDuration: 5 },
    });
    await db.creative.create({ data: { campaignId: campaign.id, type: "COPY", variantIndex: 0, provider: "llm", model: "m", cta: "Compre agora", text: "Copy", status: "COMPLETED" } });
    const video = await db.creative.create({
      data: {
        campaignId: campaign.id, type: "VIDEO", variantIndex: 0, provider: "google-veo", model: "veo", aspectRatio: "1:1", status: "PROCESSING",
        prompt: serializeVideoSpec({ scenes: ["a"], voiceover: "Som potente para o seu dia", offerLine: "Frete grátis" }),
        audioUrl: "/mem/voice.mp3",
        captionsJson: JSON.stringify([{ w: "Som", s: 0.2, e: 0.5 }, { w: "potente", s: 0.5, e: 1.1 }]),
      },
    });
    creativeId = video.id;
  });

  afterAll(async () => {
    await db.workspace.deleteMany({ where: { id: workspaceId } });
    await db.user.deleteMany({ where: { email } });
    await db.$disconnect();
  });

  it("guarda o mestre e entrega o formato da campanha com acabamento", async () => {
    const master = media(["-f", "lavfi", "-i", "color=c=black:s=360x640:r=16:d=5", "-c:v", "libx264", "-pix_fmt", "yuv420p"], "m.mp4");
    const out = await finishGeneratedVideo(creativeId, master, true);
    expect(out.aspect).toBe("1:1");
    expect(size(out.buffer)).toBe("360x360");
    expect(out.masterUrl).toMatch(/-master\.mp4$/);
    expect(files.get(out.masterUrl!)).toBe(master);
    const finalUrl = `/mem/final.mp4`;
    files.set(finalUrl, out.buffer);
    await db.creative.update({
      where: { id: creativeId },
      data: { status: "COMPLETED", outputUrl: finalUrl, masterUrl: out.masterUrl, formatsJson: JSON.stringify({ "1:1": finalUrl }) },
    });
  }, 60_000);

  it("gera outro formato a partir do mestre uma vez e reaproveita depois", async () => {
    const first = await videoFormatUrl(workspaceId, creativeId, "4:5");
    expect(first).toMatch(/-4x5\.mp4$/);
    expect(size(files.get(first)!)).toBe("360x450");
    expect(await videoFormatUrl(workspaceId, creativeId, "4:5")).toBe(first);
    expect(await videoFormatUrl(workspaceId, creativeId, "1:1")).toBe("/mem/final.mp4");
    const saved = await db.creative.findUnique({ where: { id: creativeId }, select: { formatsJson: true } });
    expect(parseFormats(saved?.formatsJson)).toMatchObject({ "1:1": "/mem/final.mp4", "4:5": first });
  }, 60_000);

  it("não entrega vídeo de outro workspace", async () => {
    const other = await createUserWithWorkspace({ email: `outro-${email}`, name: "Outro" });
    try {
      await expect(videoFormatUrl(other.workspaceId, creativeId, "9:16")).rejects.toMatchObject({ status: 404 });
    } finally {
      await db.workspace.deleteMany({ where: { id: other.workspaceId } });
      await db.user.deleteMany({ where: { email: `outro-${email}` } });
    }
  });
});
