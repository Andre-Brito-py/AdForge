import { createHash } from "crypto";
import type { Prisma } from "@prisma/client";
import { clientIp } from "./rate-limit";

/**
 * Declaração de autorização de uso de imagem (marcada pelo cliente ao anexar imagens de referência).
 * O texto guardado é exatamente o que o cliente viu (o teste garante que é igual ao da tela).
 * Se o texto mudar, aumente a versão: registros antigos continuam com o texto da época.
 */
export const IMAGE_RIGHTS_VERSION = "2026-10-02";
export const IMAGE_RIGHTS_TEXT = {
  pt: "Tenho autorização para usar a imagem das pessoas que aparecem nessas fotos (ou elas sou eu).",
  en: "I'm authorized to use the image of the people shown in these photos (or they're me).",
} as const;

/** Prazo de guarda: 5 anos (prescrição de ações de consumo, CDC art. 27); depois o cron apaga. */
export const IMAGE_RIGHTS_RETENTION_YEARS = 5;

/** Registros criados antes desta data já passaram do prazo de guarda. */
export function imageRightsCutoff(now = new Date()) {
  const d = new Date(now);
  d.setUTCFullYear(d.getUTCFullYear() - IMAGE_RIGHTS_RETENTION_YEARS);
  return d;
}

export function sha256(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

/** IP e navegador de quem fez a declaração (Marco Civil art. 15: registro de acesso a aplicação). */
export function requestFingerprint(request: Request) {
  const ip = clientIp(request);
  return {
    ipAddress: ip === "unknown" ? null : ip.slice(0, 64),
    userAgent: request.headers.get("user-agent")?.slice(0, 400) || null,
  };
}

export function buildImageRightsRecord(opts: {
  user: { id: string; email: string; name: string | null; locale: string | null; workspaceId: string };
  campaign: { id: string; name: string };
  images: { url: string; buffer: Buffer }[];
  fingerprint: { ipAddress: string | null; userAgent: string | null };
}): Prisma.ImageRightsRecordCreateInput {
  const locale = opts.user.locale === "en" ? "en" : "pt";
  return {
    userId: opts.user.id,
    userEmail: opts.user.email,
    userName: opts.user.name,
    workspaceId: opts.user.workspaceId,
    campaignId: opts.campaign.id,
    campaignName: opts.campaign.name,
    declarationVersion: IMAGE_RIGHTS_VERSION,
    declarationText: IMAGE_RIGHTS_TEXT[locale],
    locale,
    imageUrls: JSON.stringify(opts.images.map((i) => i.url)),
    imageHashes: JSON.stringify(opts.images.map((i) => sha256(i.buffer))),
    ...opts.fingerprint,
  };
}
