/** Formatos em que um anúncio em vídeo pode ser baixado (sem dependências de servidor: usado também na galeria). */
export const VIDEO_ASPECTS = ["9:16", "4:5", "1:1", "16:9"] as const;
export type VideoAspect = (typeof VIDEO_ASPECTS)[number];

export function isVideoAspect(v: unknown): v is VideoAspect {
  return typeof v === "string" && (VIDEO_ASPECTS as readonly string[]).includes(v);
}
