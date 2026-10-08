import { z } from "zod";
import { db } from "./db";
import { deletePrefix, readOwnMedia, saveFile } from "./storage";

/**
 * Vitrine da landing: até 3 criativos de exemplo (foto do produto → anúncio pronto, com legenda e hashtags).
 * Escolhidos no Admin entre os criativos do PRÓPRIO workspace do admin (nunca de clientes) e copiados para
 * "showcase/", para a landing não quebrar se a campanha for apagada.
 */
export const MAX_SHOWCASE = 3;

export const showcaseItemSchema = z.object({
  creativeId: z.string().max(60),
  mediaType: z.enum(["IMAGE", "VIDEO"]),
  mediaUrl: z.string().max(1000),
  posterUrl: z.string().max(1000).nullable().optional(),
  productImageUrl: z.string().max(1000).nullable().optional(),
  aspectRatio: z.string().max(10),
  platformLabel: z.string().max(60),
  headline: z.string().max(200).default(""),
  caption: z.string().max(1500).default(""),
  hashtags: z.string().max(500).default(""),
});
export type ShowcaseItem = z.infer<typeof showcaseItemSchema>;

export const showcaseSchema = z.object({
  enabled: z.boolean().default(false),
  items: z.array(showcaseItemSchema).max(MAX_SHOWCASE).default([]),
});
export type Showcase = z.infer<typeof showcaseSchema>;

export async function getShowcase(): Promise<Showcase> {
  const row = await db.systemConfig.findUnique({ where: { id: "global" }, select: { showcaseJson: true } });
  if (!row?.showcaseJson) return { enabled: false, items: [] };
  try {
    const parsed = showcaseSchema.safeParse(JSON.parse(row.showcaseJson));
    return parsed.success ? parsed.data : { enabled: false, items: [] };
  } catch {
    return { enabled: false, items: [] };
  }
}

/** A vitrine que a landing mostra (vazia se desligada). */
export async function publicShowcase(): Promise<ShowcaseItem[]> {
  const s = await getShowcase();
  return s.enabled ? s.items : [];
}

async function copyToShowcase(url: string | null | undefined, name: string) {
  if (!url) return null;
  const { buffer, mimeType } = await readOwnMedia(url);
  const ext = (url.split("?")[0].split(".").pop() || "bin").toLowerCase().slice(0, 4);
  return saveFile(buffer, `${name}.${ext}`, mimeType);
}

/** Copia o criativo escolhido (mídia, capa e foto do produto) para a pasta pública da vitrine. */
export async function buildShowcaseItem(creativeId: string, workspaceIds: string[], platformLabel: (key: string | null) => string): Promise<ShowcaseItem> {
  const visual = await db.creative.findFirst({
    where: { id: creativeId, status: "COMPLETED", type: { in: ["IMAGE", "VIDEO"] }, campaign: { workspaceId: { in: workspaceIds } } },
    include: { campaign: { include: { product: true } } },
  });
  if (!visual?.outputUrl) throw new Error("Criativo não encontrado no seu workspace (ou ainda não concluído)");
  const copy = await db.creative.findFirst({ where: { campaignId: visual.campaignId, type: "COPY", variantIndex: visual.variantIndex } });
  // Uma pasta por item: sair da vitrine apaga a pasta inteira.
  const folder = `showcase/${visual.id}-${Date.now().toString(36)}`;
  const [mediaUrl, posterUrl, productImageUrl] = await Promise.all([
    copyToShowcase(visual.outputUrl, `${folder}/media`),
    copyToShowcase(visual.thumbnailUrl, `${folder}/poster`).catch(() => null),
    copyToShowcase(visual.campaign.product.originalImageUrl, `${folder}/product`).catch(() => null),
  ]);
  return {
    creativeId: visual.id,
    mediaType: visual.type as "IMAGE" | "VIDEO",
    mediaUrl: mediaUrl!,
    posterUrl,
    productImageUrl,
    aspectRatio: visual.aspectRatio || "1:1",
    platformLabel: platformLabel(visual.campaign.platform),
    headline: copy?.headline || "",
    caption: copy?.text || "",
    hashtags: copy?.hashtags || "",
  };
}

/** Salva a vitrine e apaga as cópias de itens que saíram dela. */
export async function saveShowcase(next: Showcase, previous: Showcase) {
  await db.systemConfig.upsert({
    where: { id: "global" },
    update: { showcaseJson: JSON.stringify(next) },
    create: { id: "global", showcaseJson: JSON.stringify(next) },
  });
  const folderOf = (url: string) => url.split("/showcase/")[1]?.split("/")[0] || null;
  const kept = new Set(next.items.map((i) => folderOf(i.mediaUrl)));
  for (const item of previous.items) {
    const folder = folderOf(item.mediaUrl);
    if (folder && !kept.has(folder)) await deletePrefix(`showcase/${folder}/`).catch(() => undefined);
  }
}
