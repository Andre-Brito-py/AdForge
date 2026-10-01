// Regras de destino de publicação (código puro, usado no servidor e no navegador).

export const PUBLISH_TARGETS = {
  INSTAGRAM_FEED: { label: "Instagram · Feed", network: "instagram" },
  INSTAGRAM_REELS: { label: "Instagram · Reels", network: "instagram" },
  INSTAGRAM_STORY: { label: "Instagram · Stories", network: "instagram" },
  FACEBOOK_PAGE: { label: "Facebook · Página", network: "facebook" },
} as const;
export type PublishTarget = keyof typeof PUBLISH_TARGETS;
export const PUBLISH_TARGET_KEYS = Object.keys(PUBLISH_TARGETS) as [PublishTarget, ...PublishTarget[]];

export const IG_CAPTION_LIMIT = 2200;

/**
 * Quais destinos aceitam cada criativo. O feed do Instagram só aceita imagens
 * entre 4:5 e 1.91:1, então imagens 9:16 vão para Stories ou para a Página.
 */
export function allowedTargets(type: string, aspectRatio: string | null): PublishTarget[] {
  if (type === "VIDEO") return ["INSTAGRAM_REELS", "INSTAGRAM_STORY", "FACEBOOK_PAGE"];
  if (type === "IMAGE") {
    return aspectRatio === "9:16" ? ["INSTAGRAM_STORY", "FACEBOOK_PAGE"] : ["INSTAGRAM_FEED", "INSTAGRAM_STORY", "FACEBOOK_PAGE"];
  }
  return [];
}
