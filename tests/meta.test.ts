import { createHmac } from "crypto";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { allowedTargets } from "@/lib/publish-targets";
import { parseSignedRequest } from "@/lib/meta/graph";
import { createOAuthState, verifyOAuthState } from "@/lib/oauth-state";

beforeAll(() => {
  process.env.NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET || "test-secret";
});

describe("destinos de publicação", () => {
  it("imagem 9:16 não vai para o feed do Instagram (a Meta recusa)", () => {
    expect(allowedTargets("IMAGE", "9:16")).toEqual(["INSTAGRAM_STORY", "FACEBOOK_PAGE"]);
    expect(allowedTargets("IMAGE", "4:5")).toContain("INSTAGRAM_FEED");
  });
  it("vídeo vai para Reels, nunca para o feed de imagem", () => {
    expect(allowedTargets("VIDEO", "9:16")).toEqual(["INSTAGRAM_REELS", "INSTAGRAM_STORY", "FACEBOOK_PAGE"]);
  });
  it("texto puro não é publicável", () => {
    expect(allowedTargets("COPY", null)).toEqual([]);
  });
});

describe("signed_request da Meta", () => {
  const secret = "app-secret";
  const b64 = (s: string | Buffer) => Buffer.from(s).toString("base64url");
  const payload = b64(JSON.stringify({ algorithm: "HMAC-SHA256", user_id: "42" }));
  const sig = b64(createHmac("sha256", secret).update(payload).digest());

  it("aceita assinatura válida", () => {
    expect(parseSignedRequest(`${sig}.${payload}`, secret)?.user_id).toBe("42");
  });
  it("recusa assinatura forjada, segredo errado ou formato inválido", () => {
    expect(parseSignedRequest(`${b64("x")}.${payload}`, secret)).toBeNull();
    expect(parseSignedRequest(`${sig}.${payload}`, "outro-segredo")).toBeNull();
    expect(parseSignedRequest("lixo", secret)).toBeNull();
  });
});

describe("state do OAuth", () => {
  afterEach(() => vi.useRealTimers());

  it("só vale com o cookie (nonce) correto", () => {
    const { state, nonce } = createOAuthState("user-1", "ws-1");
    expect(verifyOAuthState(state, nonce)?.ws).toBe("ws-1");
    expect(verifyOAuthState(state, "outro-nonce")).toBeNull();
    expect(verifyOAuthState(state, undefined)).toBeNull();
  });
  it("recusa state adulterado (trocar o workspace de destino)", () => {
    const { state, nonce } = createOAuthState("user-1", "ws-1");
    const [, sig] = state.split(".");
    const forged = Buffer.from(JSON.stringify({ uid: "user-1", ws: "ws-vitima", n: nonce, exp: Date.now() + 60_000 })).toString("base64url");
    expect(verifyOAuthState(`${forged}.${sig}`, nonce)).toBeNull();
  });
  it("expira em 10 minutos", () => {
    const { state, nonce } = createOAuthState("user-1", "ws-1");
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 11 * 60_000);
    expect(verifyOAuthState(state, nonce)).toBeNull();
  });
});
