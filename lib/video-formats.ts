import { db } from "./db";
import { HttpError } from "./api";
import { readOwnMedia, saveFile } from "./storage";
import { loadLogoPng } from "./brand-assets";
import { parseVideoSpec } from "./video-plan";
import { estimateWordTimings, finishVideo, mediaDuration, type CaptionWord, type EndCard } from "./video-finish";
import type { VideoAspect } from "./video-aspects";

/**
 * Formatos do anÃºncio em vÃ­deo. A geraÃ§Ã£o guarda o vÃ­deo-mestre (sem acabamento) e entrega o formato da
 * campanha; os outros (9:16, 4:5, 1:1, 16:9) sÃ£o renderizados sob demanda a partir do mestre, com as mesmas
 * legendas, tela final e logo, e ficam guardados em `formatsJson`.
 */

export function parseFormats(json: string | null | undefined): Partial<Record<string, string>> {
  if (!json) return {};
  try {
    const v = JSON.parse(json);
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}

function parseCaptions(json: string | null | undefined): CaptionWord[] | null {
  if (!json) return null;
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.filter((w) => typeof w?.w === "string" && typeof w?.s === "number" && typeof w?.e === "number") : null;
  } catch {
    return null;
  }
}

/** PreÃ§o na moeda e no idioma do anÃºncio (ex.: "R$ 89,90", "$19.90"). */
export function formatPrice(price: number | null | undefined, currency: string | null | undefined, language: string | null | undefined): string | null {
  if (price === null || price === undefined || !Number.isFinite(price) || price <= 0) return null;
  try {
    return new Intl.NumberFormat(language || "pt-BR", { style: "currency", currency: currency || "BRL" }).format(price);
  } catch {
    return null;
  }
}

const creativeSelect = {
  id: true, type: true, prompt: true, audioUrl: true, captionsJson: true, masterUrl: true, outputUrl: true, formatsJson: true,
  aspectRatio: true, variantIndex: true, campaignId: true, status: true,
  campaign: {
    select: {
      id: true, workspaceId: true, language: true, captions: true, endCard: true, applyLogo: true,
      product: { select: { price: true, currency: true } },
    },
  },
} as const;

type FinishingCreative = NonNullable<Awaited<ReturnType<typeof loadCreative>>>;

function loadCreative(id: string) {
  return db.creative.findUnique({ where: { id }, select: creativeSelect });
}

/** Legendas, tela final e logo de um vÃ­deo, conforme as opÃ§Ãµes da campanha. */
export async function finishingFor(creative: FinishingCreative): Promise<{ captions: CaptionWord[] | null; endCard: EndCard | null; logoPng: Buffer | null }> {
  const campaign = creative.campaign;
  const copy = await db.creative.findFirst({ where: { campaignId: creative.campaignId, type: "COPY", variantIndex: creative.variantIndex }, select: { cta: true, text: true } });
  const spec = parseVideoSpec(creative.prompt, copy?.text || "");
  const brand = await db.brandKit.findUnique({ where: { workspaceId: campaign.workspaceId }, select: { primaryColor: true, logoUrl: true } });

  let captions: CaptionWord[] | null = null;
  if (campaign.captions && creative.audioUrl) {
    captions = parseCaptions(creative.captionsJson);
    if (!captions?.length) {
      // Voz sem tempos por palavra (OpenAI TTS): estima pela duraÃ§Ã£o do Ã¡udio.
      const audio = await readOwnMedia(creative.audioUrl).catch(() => null);
      const seconds = audio ? await mediaDuration(audio.buffer).catch(() => 0) : 0;
      captions = seconds > 0 ? estimateWordTimings(spec.voiceover, seconds) : null;
    }
  }

  const endCard: EndCard | null = campaign.endCard
    ? {
        offer: spec.offerLine,
        price: formatPrice(campaign.product.price, campaign.product.currency, campaign.language),
        cta: copy?.cta,
        color: brand?.primaryColor,
      }
    : null;

  const logoPng = campaign.applyLogo
    ? await loadLogoPng(brand?.logoUrl).catch((e) => {
        console.warn("[video-formats] nÃ£o foi possÃ­vel carregar o logo", e);
        return null;
      })
    : null;
  return { captions, endCard, logoPng };
}

/**
 * Renderiza um formato: do mestre (com logo) quando existe; em vÃ­deos antigos, do vÃ­deo entregue (que jÃ¡ tem o logo).
 * Se o acabamento falhar (ex.: fonte), tenta sÃ³ o formato, para nunca deixar o cliente sem vÃ­deo.
 */
export async function renderFormat(creative: FinishingCreative, aspect: string, source?: { buffer: Buffer; isMaster: boolean }) {
  const src = source ?? (creative.masterUrl
    ? { buffer: (await readOwnMedia(creative.masterUrl)).buffer, isMaster: true }
    : { buffer: (await readOwnMedia(creative.outputUrl!)).buffer, isMaster: false });
  const finishing = await finishingFor(creative);
  const opts = { aspect, captions: finishing.captions, endCard: finishing.endCard, logoPng: src.isMaster ? finishing.logoPng : null };
  // VÃ­deo antigo jÃ¡ entregue com acabamento? NÃ£o desenha legendas por cima das que jÃ¡ existem.
  if (!src.isMaster && creative.formatsJson) {
    opts.captions = null;
    opts.endCard = null;
  }
  try {
    return await finishVideo(src.buffer, opts);
  } catch (error) {
    console.error("[video-formats] acabamento falhou; entregando sÃ³ o formato", error);
    return finishVideo(src.buffer, { aspect, logoPng: opts.logoPng });
  }
}

/** Caminho do arquivo de um formato (ex.: ".../abc-4x5.mp4"). */
function formatKey(creative: FinishingCreative, aspect: string) {
  return `creatives/${creative.campaign.workspaceId}/${creative.campaignId}/${creative.id}-${aspect.replace(":", "x")}.mp4`;
}

/** Salva um formato renderizado e o registra em `formatsJson` (lido de novo: outro formato pode ter sido salvo). */
export async function storeFormat(creativeId: string, key: string, aspect: string, buffer: Buffer) {
  const url = await saveFile(buffer, key, "video/mp4");
  const fresh = await db.creative.findUnique({ where: { id: creativeId }, select: { formatsJson: true } });
  await db.creative.update({ where: { id: creativeId }, data: { formatsJson: JSON.stringify({ ...parseFormats(fresh?.formatsJson), [aspect]: url }) } });
  return url;
}

/** URL do vÃ­deo no formato pedido, renderizando na primeira vez. */
export async function videoFormatUrl(workspaceId: string, creativeId: string, aspect: VideoAspect): Promise<string> {
  const creative = await loadCreative(creativeId);
  if (!creative || creative.campaign.workspaceId !== workspaceId || creative.type !== "VIDEO") throw new HttpError(404, "errors.creativeNotFound");
  if (creative.status !== "COMPLETED" || !creative.outputUrl) throw new HttpError(409, "errors.creativeNotReady");
  const existing = parseFormats(creative.formatsJson)[aspect];
  if (existing) return existing;
  if (aspect === (creative.aspectRatio || "9:16")) return creative.outputUrl;
  const out = await renderFormat(creative, aspect);
  return storeFormat(creative.id, formatKey(creative, aspect), aspect, out.buffer);
}

/** Acabamento do vÃ­deo recÃ©m-gerado: guarda o mestre e devolve o formato da campanha pronto. */
export async function finishGeneratedVideo(creativeId: string, master: Buffer, isMaster: boolean) {
  const creative = await loadCreative(creativeId);
  if (!creative) throw new Error("Criativo nÃ£o encontrado");
  const aspect = creative.aspectRatio || "9:16";
  const masterUrl = isMaster
    ? await saveFile(master, `creatives/${creative.campaign.workspaceId}/${creative.campaignId}/${creative.id}-master.mp4`, "video/mp4")
    : null;
  const out = await renderFormat({ ...creative, formatsJson: null }, aspect, { buffer: master, isMaster });
  return { ...out, aspect, masterUrl };
}
