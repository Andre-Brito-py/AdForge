import { waitUntil } from "@vercel/functions";
import { Jimp } from "jimp";
import { db } from "./db";
import { HttpError } from "./api";
import { readOwnMedia, saveFile } from "./storage";
import { appUrl } from "@/services/email";
import { getMetaConnection, markConnectionExpired } from "./meta/connection";
import {
  MetaApiError, createIgContainer, getIgContainerStatus, getIgPermalink, getPageAccessToken,
  postPagePhoto, postPageVideo, publishIgContainer, type MetaPageAsset,
} from "./meta/graph";
import type { SessionUser } from "./auth";

import { allowedTargets, IG_CAPTION_LIMIT, PUBLISH_TARGETS, videoAspectFor, type PublishTarget } from "./publish-targets";
import { videoFormatUrl } from "./video-formats";

export { allowedTargets, IG_CAPTION_LIMIT, PUBLISH_TARGET_KEYS, PUBLISH_TARGETS, type PublishTarget } from "./publish-targets";

const VIDEO_TIMEOUT_MS = 20 * 60_000;
const POLL_THROTTLE_MS = 4_000;
const STALE_PENDING_MS = 90_000;
const DUPLICATE_WINDOW_MS = 2 * 60_000;

export function findAccount(assets: MetaPageAsset[], target: PublishTarget, accountId: string) {
  if (PUBLISH_TARGETS[target].network === "facebook") {
    const page = assets.find((a) => a.pageId === accountId);
    return page ? { pageId: page.pageId, name: page.pageName } : null;
  }
  const page = assets.find((a) => a.instagram?.id === accountId);
  return page?.instagram ? { pageId: page.pageId, name: `@${page.instagram.username || page.instagram.id}` } : null;
}

function absoluteUrl(url: string) {
  return /^https?:\/\//i.test(url) ? url : `${appUrl()}${url}`;
}

// ---------------------------------------------------------------------------

export async function createPublication(
  user: SessionUser,
  input: { creativeId: string; target: PublishTarget; accountId: string; caption: string | null }
) {
  const creative = await db.creative.findFirst({
    where: { id: input.creativeId, campaign: { workspaceId: user.workspaceId } },
  });
  if (!creative) throw new HttpError(404, "errors.creativeNotFound");
  if (creative.status !== "COMPLETED" || !creative.outputUrl) throw new HttpError(409, "errors.creativeNotReady");
  if (!allowedTargets(creative.type, creative.aspectRatio).includes(input.target)) {
    throw new HttpError(400, "errors.formatNotAccepted");
  }

  const conn = await getMetaConnection(user.workspaceId);
  if (!conn || conn.status !== "ACTIVE" || !conn.token) {
    throw new HttpError(409, "errors.metaNotConnected", "META_NOT_CONNECTED");
  }
  const account = findAccount(conn.assets, input.target, input.accountId);
  if (!account) throw new HttpError(400, "errors.targetAccountNotFound");

  const caption = input.caption?.slice(0, IG_CAPTION_LIMIT) || null;

  // Evita post duplicado (clique duplo, duas abas): o lock transacional do Postgres
  // serializa pedidos para o mesmo criativo+destino; o segundo encontra o primeiro em andamento.
  const lockKey = `publish:${creative.id}:${input.target}:${input.accountId}`;
  const { publication, created } = await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;
    const inFlight = await tx.publication.findFirst({
      where: {
        creativeId: creative.id,
        target: input.target,
        accountId: input.accountId,
        OR: [
          { status: { in: ["PENDING", "PROCESSING"] } },
          // Publicado há pouco: um segundo clique não deve gerar um post repetido.
          { status: "PUBLISHED", createdAt: { gt: new Date(Date.now() - DUPLICATE_WINDOW_MS) } },
        ],
      },
      orderBy: { createdAt: "desc" },
    });
    if (inFlight) return { publication: inFlight, created: false };
    const row = await tx.publication.create({
      data: {
        workspaceId: user.workspaceId,
        creativeId: creative.id,
        connectionId: conn.id,
        provider: "META",
        target: input.target,
        accountId: input.accountId,
        accountName: account.name,
        caption: input.target === "INSTAGRAM_STORY" ? null : caption,
        createdById: user.id,
      },
    });
    return { publication: row, created: true };
  });

  if (created) waitUntil(runPublication(publication.id).catch((e) => console.error("[publishing] run", e)));
  return publication;
}

async function failPublication(id: string, error: unknown, connectionId?: string | null) {
  let message = error instanceof Error ? error.message : String(error);
  if (error instanceof MetaApiError && error.isAuthError) {
    if (connectionId) await markConnectionExpired(connectionId);
    message = "A conexão com a Meta expirou. Reconecte em Integrações e tente de novo.";
  }
  if (error instanceof MetaApiError && error.code === 9) {
    message = "A conta atingiu o limite diário de publicações via API definido pela Meta. Tente novamente mais tarde.";
  }
  await db.publication.update({ where: { id }, data: { status: "FAILED", error: message.slice(0, 500) } });
}

/** Instagram exige JPEG: convertemos e salvamos uma cópia pública. */
async function jpegUrlFor(workspaceId: string, creativeId: string, outputUrl: string) {
  if (/\.jpe?g($|\?)/i.test(outputUrl)) return absoluteUrl(outputUrl);
  const { buffer } = await readOwnMedia(outputUrl);
  const image = await Jimp.read(buffer);
  const jpeg = await image.getBuffer("image/jpeg", { quality: 92 });
  const url = await saveFile(jpeg, `published/${workspaceId}/${creativeId}.jpg`, "image/jpeg");
  return absoluteUrl(url);
}

export async function runPublication(id: string): Promise<void> {
  const claimed = await db.publication.updateMany({
    where: { id, status: "PENDING" },
    data: { status: "PROCESSING", attempts: { increment: 1 } },
  });
  if (claimed.count === 0) return;

  const pub = await db.publication.findUnique({ where: { id }, include: { creative: true } });
  if (!pub) return;

  try {
    const conn = await getMetaConnection(pub.workspaceId);
    if (!conn?.token || conn.status !== "ACTIVE") throw new MetaApiError("Conexão com a Meta inativa", 190);
    const target = pub.target as PublishTarget;
    const account = findAccount(conn.assets, target, pub.accountId);
    if (!account) throw new Error("Conta de destino não encontrada");

    const pageToken = await getPageAccessToken(conn.token, account.pageId);
    const isVideo = pub.creative.type === "VIDEO";
    // Reels/Stories: a versão 9:16 do vídeo (mesmas legendas e tela final), gerada na primeira vez.
    const wantAspect = isVideo ? videoAspectFor(target) : null;
    const videoUrl = wantAspect && pub.creative.aspectRatio !== wantAspect
      ? await videoFormatUrl(pub.workspaceId, pub.creativeId, wantAspect)
      : pub.creative.outputUrl!;
    const mediaUrl = isVideo
      ? absoluteUrl(videoUrl)
      : await jpegUrlFor(pub.workspaceId, pub.creativeId, pub.creative.outputUrl!);

    if (target === "FACEBOOK_PAGE") {
      const postId = isVideo
        ? await postPageVideo(account.pageId, pageToken, mediaUrl, pub.caption || undefined)
        : await postPagePhoto(account.pageId, pageToken, mediaUrl, pub.caption || undefined);
      const permalink = isVideo ? `https://www.facebook.com/${account.pageId}/videos/${postId}` : `https://www.facebook.com/${postId}`;
      await db.publication.update({ where: { id }, data: { status: "PUBLISHED", externalId: postId, permalink, error: null } });
      return;
    }

    const kind =
      target === "INSTAGRAM_FEED" ? "IMAGE"
      : target === "INSTAGRAM_REELS" ? "REELS"
      : isVideo ? "STORIES_VIDEO" : "STORIES_IMAGE";
    const containerId = await createIgContainer({ igUserId: pub.accountId, token: pageToken, kind, mediaUrl, caption: pub.caption || undefined });

    if (isVideo) {
      // Vídeo: o Instagram processa em segundo plano; advancePublication() conclui depois.
      await db.publication.update({ where: { id }, data: { containerId } });
      return;
    }
    await finishInstagram(id, pub.accountId, containerId, pageToken);
  } catch (error) {
    console.error(`[publishing] ${id} falhou`, error);
    await failPublication(id, error, pub.connectionId);
  }
}

async function finishInstagram(id: string, igUserId: string, containerId: string, token: string) {
  const mediaId = await publishIgContainer(igUserId, containerId, token);
  const permalink = await getIgPermalink(mediaId, token);
  await db.publication.update({ where: { id }, data: { status: "PUBLISHED", externalId: mediaId, permalink, error: null } });
}

/** Avança publicações de vídeo no Instagram e reinicia pendentes paradas. */
export async function advancePublication(id: string) {
  const pub = await db.publication.findUnique({ where: { id } });
  if (!pub) return;
  const idle = Date.now() - pub.updatedAt.getTime();

  if (pub.status === "PENDING" && idle > STALE_PENDING_MS) {
    waitUntil(runPublication(id).catch(console.error));
    return;
  }
  if (pub.status !== "PROCESSING" || !pub.containerId || idle < POLL_THROTTLE_MS) return;

  try {
    if (Date.now() - pub.createdAt.getTime() > VIDEO_TIMEOUT_MS) throw new Error("O Instagram demorou demais para processar o vídeo");
    const conn = await getMetaConnection(pub.workspaceId);
    if (!conn?.token) throw new MetaApiError("Conexão com a Meta inativa", 190);
    const page = conn.assets.find((a) => a.instagram?.id === pub.accountId);
    if (!page) throw new Error("Conta de destino não encontrada");
    const token = await getPageAccessToken(conn.token, page.pageId);

    const status = await getIgContainerStatus(pub.containerId, token);
    if (status.code === "FINISHED") {
      // Trava atômica: só quem "pegar" o container publica (evita post duplicado).
      const claim = await db.publication.updateMany({ where: { id, status: "PROCESSING", containerId: pub.containerId }, data: { containerId: null } });
      if (claim.count === 1) await finishInstagram(id, pub.accountId, pub.containerId, token);
    } else if (status.code === "ERROR" || status.code === "EXPIRED") {
      throw new Error(`O Instagram recusou o vídeo${status.detail ? `: ${status.detail}` : ""}`);
    } else {
      await db.publication.update({ where: { id }, data: { status: "PROCESSING" } }); // atualiza updatedAt
    }
  } catch (error) {
    await failPublication(id, error, pub.connectionId);
  }
}

export async function advancePendingPublications(limit = 25) {
  const pending = await db.publication.findMany({
    where: { status: { in: ["PENDING", "PROCESSING"] } },
    orderBy: { updatedAt: "asc" },
    take: limit,
    select: { id: true },
  });
  for (const p of pending) await advancePublication(p.id);
  return pending.length;
}
