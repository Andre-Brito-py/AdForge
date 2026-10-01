import { createHmac, randomBytes, timingSafeEqual } from "crypto";

/**
 * "state" do OAuth assinado: protege contra CSRF e garante que a conta conectada
 * vá para o workspace de quem iniciou o fluxo. Válido por 10 minutos.
 */
interface StatePayload {
  uid: string;
  ws: string;
  n: string; // nonce, também guardado em cookie httpOnly
  exp: number;
}

function secret() {
  const s = process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error("NEXTAUTH_SECRET não configurado");
  return s;
}

function sign(data: string) {
  return createHmac("sha256", secret()).update(`oauth-state:${data}`).digest("base64url");
}

export function createOAuthState(userId: string, workspaceId: string) {
  const nonce = randomBytes(16).toString("base64url");
  const payload: StatePayload = { uid: userId, ws: workspaceId, n: nonce, exp: Date.now() + 10 * 60_000 };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return { state: `${data}.${sign(data)}`, nonce };
}

export function verifyOAuthState(state: string | null, nonceCookie: string | undefined): StatePayload | null {
  if (!state || !nonceCookie) return null;
  const [data, sig] = state.split(".");
  if (!data || !sig) return null;
  const a = Buffer.from(sig);
  const b = Buffer.from(sign(data));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(data, "base64url").toString("utf8")) as StatePayload;
    if (payload.exp < Date.now() || payload.n !== nonceCookie) return null;
    return payload;
  } catch {
    return null;
  }
}
