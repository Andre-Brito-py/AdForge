"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { signIn, signOut } from "next-auth/react";
import { Loader2 } from "lucide-react";
import { AuthShell, Divider, GoogleButton } from "@/components/auth/auth-shell";
import { safeRedirect } from "@/lib/redirect";
import { buttonClass } from "@/components/app/ui-bits";

const ERRORS: Record<string, string> = {
  INVALID_CREDENTIALS: "E-mail ou senha incorretos.",
  ACCOUNT_LOCKED: "Muitas tentativas erradas. Por segurança, a conta foi bloqueada por 15 minutos. Você pode redefinir a senha.",
  RATE_LIMITED: "Muitas tentativas a partir desta rede. Aguarde alguns minutos.",
  INVALID_2FA: "Código de verificação inválido. Confira o app autenticador.",
  OAuthAccountNotLinked: "Este e-mail já está cadastrado com outro método de login.",
  AccessDenied: "Não foi possível entrar com esta conta.",
};

export function LoginForm({ googleEnabled, from, oauthError, expired }: { googleEnabled: boolean; from: string | null; oauthError: string | null; expired: boolean }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [needs2fa, setNeeds2fa] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    oauthError ? ERRORS[oauthError] || "Não foi possível entrar. Tente novamente." : expired ? "Sua sessão expirou. Entre novamente." : null
  );
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
    setError(ERRORS[res?.error || ""] || "Não foi possível entrar. Tente novamente.");
  };

  return (
    <AuthShell
      title={needs2fa ? "Verificação em duas etapas" : "Entrar na sua conta"}
      subtitle={needs2fa ? "Digite o código de 6 dígitos do seu app autenticador." : "Que bom ver você de novo."}
      footer={<>Ainda não tem conta? <Link href="/signup" className="font-medium text-brand hover:underline">Criar conta</Link></>}
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
              <label htmlFor="email" className="label-base">E-mail</label>
              <input id="email" type="email" autoComplete="email" required className="input-base" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@empresa.com" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="label-base">Senha</label>
                <Link href="/forgot-password" className="text-xs text-muted-foreground hover:text-foreground">Esqueci a senha</Link>
              </div>
              <input id="password" type="password" autoComplete="current-password" required className="input-base" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
          </>
        ) : (
          <input
            autoFocus inputMode="numeric" autoComplete="one-time-code" maxLength={6} required
            className="input-base h-14 text-center font-mono text-2xl tracking-[0.5em]" placeholder="000000"
            value={token} onChange={(e) => setToken(e.target.value.replace(/\D/g, ""))} aria-label="Código de 6 dígitos"
          />
        )}

        {error && <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2.5 text-sm text-destructive">{error}</p>}

        <button type="submit" disabled={loading} className={`${buttonClass("primary", "lg")} w-full`}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />} {needs2fa ? "Verificar" : "Entrar"}
        </button>
        {needs2fa && (
          <button type="button" onClick={() => { setNeeds2fa(false); setToken(""); }} className="w-full text-center text-sm text-muted-foreground hover:text-foreground">
            Voltar
          </button>
        )}
      </form>
    </AuthShell>
  );
}
