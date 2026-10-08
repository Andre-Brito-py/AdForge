import { createHmac, timingSafeEqual } from "crypto";
import { cookies, headers } from "next/headers";
import { db } from "./db";
import { HttpError } from "./api";

/**
 * Aceite dos Termos de Uso e da Política de Privacidade.
 * Ao mudar os textos de forma relevante, troque TERMS_VERSION (e a data em lib/company.ts):
 * quem aceitou a versão anterior é levado a /accept-terms no próximo acesso.
 * Cada aceite vira um ConsentRecord (versão, data, IP e navegador), guardado mesmo após a exclusão da conta
 * pelo prazo de defesa em juízo (LGPD art. 16, II e art. 7º, VI; CDC art. 27: 5 anos).
 */
export const TERMS_VERSION = "2026-10-08";
export const CONSENT_RETENTION_YEARS = 5;

export type ConsentMethod = "signup_email" | "signup_google" | "reaccept";

export function hasCurrentTerms(user: { termsVersion?: string | null }) {
  return user.termsVersion === TERMS_VERSION;
}

/** Para as APIs que geram cobrança (campanha, variação, checkout): sem aceite atual, 403. */
export function assertCurrentTerms(user: { termsVersion?: string | null }) {
  if (!hasCurrentTerms(user)) throw new HttpError(403, "errors.termsRequired", "TERMS_REQUIRED");
}

async function fingerprint() {
  try {
    const h = await headers();
    const ip = h.get("x-forwarded-for")?.split(",")[0].trim() || h.get("x-real-ip") || null;
    return { ipAddress: ip?.slice(0, 64) || null, userAgent: h.get("user-agent")?.slice(0, 400) || null };
  } catch {
    return { ipAddress: null, userAgent: null };
  }
}

/** Registra o aceite da versão atual (no usuário e no histórico de provas). */
export async function recordTermsAcceptance(user: { id: string; email: string; locale?: string | null }, method: ConsentMethod) {
  const now = new Date();
  await db.$transaction([
    db.user.update({ where: { id: user.id }, data: { termsVersion: TERMS_VERSION, termsAcceptedAt: now } }),
    db.consentRecord.create({
      data: {
        userId: user.id,
        userEmail: user.email,
        version: TERMS_VERSION,
        method,
        locale: user.locale || null,
        createdAt: now,
        ...(await fingerprint()),
      },
    }),
  ]);
}

// ---------- Cadastro pelo Google ----------
// O aceite acontece na nossa tela (checkbox) ANTES de ir ao Google; a conta só é criada na volta.
// Um cookie assinado e de curta duração leva esse aceite até o callback do NextAuth.

export const PRE_ACCEPT_COOKIE = "vysify_terms_ok";
const PRE_ACCEPT_TTL_S = 30 * 60;

function sign(payload: string) {
  return createHmac("sha256", process.env.NEXTAUTH_SECRET || "dev-only-insecure-key").update(payload).digest("base64url");
}

export function preAcceptValue(now = Date.now()) {
  const payload = `${TERMS_VERSION}.${now}`;
  return `${payload}.${sign(payload)}`;
}

export function isValidPreAccept(value: string | undefined | null, now = Date.now()) {
  if (!value) return false;
  const i = value.lastIndexOf(".");
  if (i < 0) return false;
  const payload = value.slice(0, i);
  const sig = Buffer.from(value.slice(i + 1));
  const want = Buffer.from(sign(payload));
  if (sig.length !== want.length || !timingSafeEqual(sig, want)) return false;
  const [version, ts] = payload.split(".");
  return version === TERMS_VERSION && now - Number(ts) < PRE_ACCEPT_TTL_S * 1000 && Number(ts) <= now + 60_000;
}

export const preAcceptCookieOptions = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: PRE_ACCEPT_TTL_S };

/** Lê (e apaga) o aceite prévio do cadastro pelo Google. */
export async function consumePreAccept(): Promise<boolean> {
  try {
    const store = await cookies();
    const ok = isValidPreAccept(store.get(PRE_ACCEPT_COOKIE)?.value);
    if (ok) {
      try {
        store.delete(PRE_ACCEPT_COOKIE);
      } catch {
        /* fora de um route handler não dá para apagar; ele expira sozinho em 30 min */
      }
    }
    return ok;
  } catch {
    return false;
  }
}

/** Fim do prazo de guarda das provas de aceite de contas que já não existem. */
export function consentCutoff(now = new Date()) {
  const d = new Date(now);
  d.setUTCFullYear(d.getUTCFullYear() - CONSENT_RETENTION_YEARS);
  return d;
}
