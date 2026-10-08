export type StoreProvider = "MERCADOLIVRE" | "NUVEMSHOP" | "SHOPIFY";

export type StoreSlug = "mercadolivre" | "nuvemshop" | "shopify";
export const STORE_SLUGS: StoreSlug[] = ["mercadolivre", "nuvemshop", "shopify"];

export interface StoreItem {
  id: string;
  title: string;
  thumbnail: string | null;
  permalink: string | null;
  pictureCount: number;
  maxPictures: number | null;
}

export interface StoreTokens {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
}

export interface StoreAccount extends StoreTokens {
  externalUserId: string;
  displayName: string | null;
  scopes: string[];
}

/** Credenciais vivas de uma conexão (token já descriptografado e renovado se preciso). */
export interface LiveConnection {
  id: string;
  externalUserId: string;
  token: string;
}

export interface StoreAdapter {
  provider: StoreProvider;
  slug: StoreSlug;
  label: string;
  target: "MERCADOLIVRE_ITEM" | "NUVEMSHOP_PRODUCT" | "SHOPIFY_PRODUCT";
  /** O token expira e precisa de refresh? */
  refreshable: boolean;
  getApp(): Promise<{ appId: string; secret: string } | null>;
  /** `shop`: domínio da loja (só Shopify, onde cada loja tem o próprio endereço). */
  buildAuthUrl(opts: { appId: string; redirectUri: string; state: string; codeChallenge: string; shop?: string | null }): string;
  exchangeCode(opts: { appId: string; secret: string; redirectUri: string; code: string; codeVerifier: string; shop?: string | null }): Promise<StoreAccount>;
  refresh?(opts: { appId: string; secret: string; refreshToken: string }): Promise<StoreTokens>;
  searchItems(conn: LiveConnection, q: string): Promise<StoreItem[]>;
  getItem(conn: LiveConnection, id: string): Promise<StoreItem | null>;
  addImage(conn: LiveConnection, itemId: string, image: { buffer: Buffer; mimeType: string; filename: string }, asCover: boolean): Promise<{ externalId: string; permalink: string | null }>;
}

export class StoreApiError extends Error {
  constructor(message: string, public status?: number, public authError = false) {
    super(message);
    this.name = "StoreApiError";
  }
}
