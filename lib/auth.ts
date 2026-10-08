import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { countryFromHeaders, isLocale, pickLocale, type Locale } from "./locale";
import { cache } from "react";
import speakeasy from "speakeasy";
import { db } from "./db";
import { getAppConfig } from "./config";
import { verifyPasswordConstantTime } from "./password";
import { rateLimit } from "./rate-limit";
import { createUserWithWorkspace, getWorkspaceIdForUser } from "./users";
import { HttpError } from "./api";
import { sendWelcomeEmail } from "@/services/email";
import { consumePreAccept, recordTermsAcceptance } from "./terms";

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

/** Idioma (cookie/navegador) e país (CDN) de quem está se cadastrando. */
export async function requestOrigin(): Promise<{ locale: Locale; country: string | null }> {
  try {
    const [store, h] = await Promise.all([cookies(), headers()]);
    const country = countryFromHeaders(h);
    const cookieLocale = store.get("NEXT_LOCALE")?.value;
    return { locale: isLocale(cookieLocale) ? cookieLocale : pickLocale(h.get("accept-language"), country), country };
  } catch {
    return { locale: "pt", country: null };
  }
}

/** O botão do Google aparece? (ligado no Admin › Integrações e com Client ID/Secret). Sem redeploy. */
export async function isGoogleLoginActive() {
  return (await getAppConfig()).googleLogin.active;
}

/**
 * Opções do NextAuth montadas a cada requisição, para que ligar/desligar o Google
 * ou trocar as credenciais no painel valha sem redeploy.
 */
export async function getAuthOptions(): Promise<NextAuthOptions> {
  const { googleLogin, secrets } = await getAppConfig();
  if (!googleLogin.active) return authOptions;
  return {
    ...authOptions,
    providers: [
      GoogleProvider({ clientId: secrets.googleClientId!, clientSecret: secrets.googleClientSecret! }),
      ...authOptions.providers,
    ],
  };
}

function headerValue(headers: unknown, name: string): string | undefined {
  if (!headers || typeof headers !== "object") return undefined;
  const v = (headers as Record<string, string | string[] | undefined>)[name];
  return Array.isArray(v) ? v[0] : v;
}

/** Opções base (sem o Google). Bastam para ler a sessão com getServerSession. */
export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "E-mail e senha",
      credentials: {
        email: { label: "E-mail", type: "email" },
        password: { label: "Senha", type: "password" },
        token2fa: { label: "Código 2FA", type: "text" },
      },
      async authorize(credentials, req) {
        const email = credentials?.email?.trim().toLowerCase();
        const password = credentials?.password || "";
        if (!email || !password) throw new Error("INVALID_CREDENTIALS");

        const ip = headerValue(req?.headers, "x-forwarded-for")?.split(",")[0].trim() || "unknown";
        const limited = await rateLimit(`login:${ip}`, 20, 15 * 60);
        if (!limited.ok) throw new Error("RATE_LIMITED");

        const user = await db.user.findUnique({ where: { email } });

        if (user?.lockedUntil && user.lockedUntil > new Date()) {
          throw new Error("ACCOUNT_LOCKED");
        }

        const valid = await verifyPasswordConstantTime(password, user?.passwordHash);
        if (!user || !valid) {
          if (user) {
            const attempts = user.failedLoginAttempts + 1;
            await db.user.update({
              where: { id: user.id },
              data:
                attempts >= MAX_FAILED_ATTEMPTS
                  ? { failedLoginAttempts: 0, lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60_000) }
                  : { failedLoginAttempts: attempts },
            });
          }
          throw new Error("INVALID_CREDENTIALS");
        }

        if (user.twoFactorEnabled && user.twoFactorSecret) {
          const token = credentials?.token2fa?.trim();
          if (!token) throw new Error("2FA_REQUIRED");
          const ok = speakeasy.totp.verify({ secret: user.twoFactorSecret, encoding: "base32", token, window: 1 });
          if (!ok) throw new Error("INVALID_2FA");
        }

        if (user.failedLoginAttempts > 0 || user.lockedUntil) {
          await db.user.update({ where: { id: user.id }, data: { failedLoginAttempts: 0, lockedUntil: null } });
        }

        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider !== "google") return true;
      // Desligado no painel entre o clique e o retorno do Google: recusa.
      if (!(await isGoogleLoginActive())) return false;
      const email = user.email?.toLowerCase();
      if (!email) return false;
      // Só aceita e-mails que o próprio Google confirma como verificados.
      if ((profile as { email_verified?: boolean } | undefined)?.email_verified !== true) return false;

      const existing = await db.user.findUnique({ where: { email } });
      if (!existing) {
        // Cadastros fechados no painel: quem já tem conta continua entrando; conta nova não.
        if (!(await getAppConfig()).signupsEnabled) return "/login?error=SignupsClosed";
        const origin = await requestOrigin();
        const { user: created } = await createUserWithWorkspace({
          email,
          name: user.name || email.split("@")[0],
          image: user.image,
          emailVerified: new Date(),
          ...origin,
        });
        // Aceite marcado na tela de cadastro antes de ir ao Google. Sem ele (ex.: Google pela tela de login),
        // a conta é criada e o aceite é pedido no primeiro acesso (/accept-terms).
        if (await consumePreAccept()) await recordTermsAcceptance(created, "signup_google");
        sendWelcomeEmail(created.email, created.name || "", created.locale).catch(console.error);
      } else if (!existing.emailVerified) {
        // O Google provou a posse do e-mail. Uma senha definida antes disso pode ter sido criada
        // por outra pessoa com este e-mail (pré-sequestro de conta): descartamos a senha e as sessões.
        await db.user.update({
          where: { id: existing.id },
          data: { emailVerified: new Date(), passwordHash: null, sessionVersion: { increment: 1 } },
        });
      }
      return true;
    },
    async jwt({ token, user, account, trigger }) {
      // No login (ou quando o cliente pede update) recarregamos tudo do banco;
      // nunca confiamos em valores enviados pelo navegador.
      if (user || trigger === "update") {
        const dbUser =
          account?.provider === "google" || !user
            ? await db.user.findUnique({ where: { email: (token.email as string).toLowerCase() } })
            : await db.user.findUnique({ where: { id: user.id } });
        if (dbUser) {
          token.sub = dbUser.id;
          token.role = dbUser.role;
          token.onboardingCompleted = dbUser.onboardingCompleted;
          token.sv = dbUser.sessionVersion;
          token.name = dbUser.name;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub as string;
        session.user.role = token.role as string;
        session.user.onboardingCompleted = !!token.onboardingCompleted;
        session.user.sv = (token.sv as number) ?? 0;
      }
      return session;
    },
  },
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: "/login", error: "/login" },
  secret: process.env.NEXTAUTH_SECRET,
};

export type SessionUser = NonNullable<Awaited<ReturnType<typeof loadSessionUser>>>;

async function loadSessionUser() {
  const session = await getServerSession(authOptions);
  const id = session?.user?.id;
  if (!id) return null;

  const user = await db.user.findUnique({
    where: { id },
    select: {
      id: true, email: true, name: true, image: true, role: true,
      emailVerified: true, onboardingCompleted: true, twoFactorEnabled: true,
      sessionVersion: true, passwordHash: true, notifyOnComplete: true, marketingOptIn: true,
      locale: true, country: true, termsVersion: true,
    },
  });
  // Sessão de um usuário apagado ou invalidada por troca de senha.
  if (!user || user.sessionVersion !== (session.user.sv ?? 0)) return null;

  const workspaceId = await getWorkspaceIdForUser(user.id);
  if (!workspaceId) return null;

  const { passwordHash, ...rest } = user;
  return { ...rest, hasPassword: !!passwordHash, workspaceId, isAdmin: user.role === "SUPERADMIN" };
}

/** Usuário da requisição atual (deduplicado por request). */
export const getSessionUser = cache(loadSessionUser);

/** Para Server Components: redireciona para o login se não houver sessão válida. */
export async function requireUser() {
  const user = await getSessionUser();
  if (!user) {
    // Cookie existe mas a sessão foi invalidada (troca de senha, conta removida...):
    // o login limpa o cookie, evitando um loop entre proxy e página.
    const stale = !!(await getServerSession(authOptions))?.user;
    redirect(stale ? "/login?expired=1" : "/login");
  }
  return user;
}

/** Para route handlers: lança 401/403. */
export async function requireApiUser(opts: { verified?: boolean } = {}) {
  const user = await getSessionUser();
  if (!user) throw new HttpError(401, "errors.unauthenticated", "UNAUTHENTICATED");
  if (opts.verified && !user.emailVerified) {
    throw new HttpError(403, "errors.emailNotVerified", "EMAIL_NOT_VERIFIED");
  }
  return user;
}

export async function requireApiAdmin() {
  const user = await requireApiUser();
  if (!user.isAdmin) throw new HttpError(403, "errors.forbidden", "FORBIDDEN");
  return user;
}
