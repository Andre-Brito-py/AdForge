"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { signIn, signOut } from "next-auth/react";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { AuthShell, Divider, GoogleButton } from "@/components/auth/auth-shell";
import { safeRedirect } from "@/lib/redirect";
import { buttonClass } from "@/components/app/ui-bits";

const KNOWN_ERRORS = ["INVALID_CREDENTIALS", "ACCOUNT_LOCKED", "RATE_LIMITED", "INVALID_2FA", "OAuthAccountNotLinked", "AccessDenied"];

export function LoginForm({ googleEnabled, from, oauthError, expired }: { googleEnabled: boolean; from: string | null; oauthError: string | null; expired: boolean }) {
  const t = useTranslations("auth");
  const tc = useTranslations("common");
  const errorText = (code: string | null | undefined) =>
    code && KNOWN_ERRORS.includes(code) ? t(`login.errors.${code}`) : t("login.errors.generic");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [needs2fa, setNeeds2fa] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(oauthError ? errorText(oauthError) : expired ? t("login.errors.expired") : null);
  const target = safeRedirect(from);

  // Sessão invalidada no servidor: remove o cookie antigo.
  useEffect(() => {
    if (expired) signOut({ redirect: false });
  }, [expired]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await signIn("credentials", { email, password, token2fa: needs2fa ? token : "", redirect: false });
    if (res?.ok && !res.error) {
      // Navegação completa: garante que o cookie de sessão novo seja usado em todas as rotas.
      window.location.href = target;
      return;
    }
    setLoading(false);
    if (res?.error === "2FA_REQUIRED") {
      setNeeds2fa(true);
      return;
    }
    setError(errorText(res?.error));
  };

  return (
    <AuthShell
      title={needs2fa ? t("login.twoFactorTitle") : t("login.title")}
      subtitle={needs2fa ? t("login.twoFactorSubtitle") : t("login.subtitle")}
      footer={<>{t("login.noAccount")} <Link href="/signup" className="font-medium text-brand hover:underline">{t("login.createAccount")}</Link></>}
    >
      {googleEnabled && !needs2fa && (
        <>
          <GoogleButton disabled={loading} onClick={() => { setLoading(true); signIn("google", { callbackUrl: target }); }} />
          <Divider />
        </>
      )}

      <form onSubmit={submit} className="space-y-4">
        {!needs2fa ? (
          <>
            <div className="space-y-2">
              <label htmlFor="email" className="label-base">{t("email")}</label>
              <input id="email" type="email" autoComplete="email" required className="input-base" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("emailPlaceholder")} />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="label-base">{t("password")}</label>
                <Link href="/forgot-password" className="text-xs text-muted-foreground hover:text-foreground">{t("login.forgot")}</Link>
              </div>
              <input id="password" type="password" autoComplete="current-password" required className="input-base" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
          </>
        ) : (
          <input
            autoFocus inputMode="numeric" autoComplete="one-time-code" maxLength={6} required
            className="input-base h-14 text-center font-mono text-2xl tracking-[0.5em]" placeholder="000000"
            value={token} onChange={(e) => setToken(e.target.value.replace(/\D/g, ""))} aria-label={t("login.codeLabel")}
          />
        )}

        {error && <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2.5 text-sm text-destructive">{error}</p>}

        <button type="submit" disabled={loading} className={`${buttonClass("primary", "lg")} w-full`}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />} {needs2fa ? t("login.verify") : t("login.submit")}
        </button>
        {needs2fa && (
          <button type="button" onClick={() => { setNeeds2fa(false); setToken(""); }} className="w-full text-center text-sm text-muted-foreground hover:text-foreground">
            {tc("back")}
          </button>
        )}
      </form>
    </AuthShell>
  );
}
