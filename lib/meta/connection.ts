import { db } from "@/lib/db";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { getAppConfig } from "@/lib/config";
import { appUrl } from "@/services/email";
import type { MetaPageAsset } from "./graph";

export const NONCE_COOKIE = "meta_oauth_nonce";

export async function getMetaApp(): Promise<{ appId: string; appSecret: string } | null> {
  const { secrets } = await getAppConfig();
  if (!secrets.metaAppId || !secrets.metaAppSecret) return null;
  return { appId: secrets.metaAppId, appSecret: secrets.metaAppSecret };
}

export function metaRedirectUri() {
  return `${appUrl()}/api/integrations/meta/callback`;
}

export async function saveMetaConnection(input: {
  workspaceId: string;
  userId: string;
  externalUserId: string;
  displayName: string | null;
  accessToken: string;
  expiresAt: Date | null;
  scopes: string[];
  assets: MetaPageAsset[];
}) {
  const data = {
    externalUserId: input.externalUserId,
    displayName: input.displayName,
    accessToken: encryptSecret(input.accessToken),
    tokenExpiresAt: input.expiresAt,
    scopes: input.scopes.join(","),
    assetsJson: JSON.stringify(input.assets),
    status: "ACTIVE",
    createdById: input.userId,
  };
  return db.connection.upsert({
    where: { workspaceId_provider: { workspaceId: input.workspaceId, provider: "META" } },
    update: data,
    create: { workspaceId: input.workspaceId, provider: "META", ...data },
  });
}

export function parseAssets(json: string | null | undefined): MetaPageAsset[] {
  try {
    return json ? (JSON.parse(json) as MetaPageAsset[]) : [];
  } catch {
    return [];
  }
}

/** Conexão Meta do workspace com o token já descriptografado (uso só no servidor). */
export async function getMetaConnection(workspaceId: string) {
  const conn = await db.connection.findUnique({ where: { workspaceId_provider: { workspaceId, provider: "META" } } });
  if (!conn) return null;
  const token = decryptSecret(conn.accessToken);
  return { ...conn, token, assets: parseAssets(conn.assetsJson) };
}

export async function markConnectionExpired(connectionId: string) {
  await db.connection.update({ where: { id: connectionId }, data: { status: "EXPIRED" } }).catch(() => undefined);
}
