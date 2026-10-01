"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Loader2 } from "lucide-react";
import { AuthShell, Divider, GoogleButton } from "@/components/auth/auth-shell";
import { buttonClass } from "@/components/app/ui-bits";

export function SignupForm({ googleEnabled, signupCredits }: { googleEnabled: boolean; signupCredits: number }) {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [accept, setAccept] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const strong = form.password.length >= 8 && /[A-Za-z]/.test(form.password) && /\d/.test(form.password);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!strong) return setError("A senha precisa ter 8+ caracteres, com letras e números.");
    if (!accept) return setError("É preciso aceitar os Termos de Uso e a Política de Privacidade.");
    setLoading(true);

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, acceptTerms: true }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setLoading(false);
      return setError(data.error || "Não foi possível criar a conta.");
    }

    const login = await signIn("credentials", { email: form.email, password: form.password, redirect: false });
    router.replace(login?.ok && !login.error ? "/onboarding" : "/login");
    router.refresh();
  };

  return (
    <AuthShell
      title="Crie sua conta"
      subtitle={signupCredits > 0 ? `Você começa com ${signupCredits} créditos grátis para testar. Sem cartão de crédito.` : "Comece em menos de um minuto."}
      footer={<>Já tem conta? <Link href="/login" className="font-medium text-brand hover:underline">Entrar</Link></>}
      mood="happy"
    >
      {googleEnabled && (
        <>
          <GoogleButton disabled={loading} onClick={() => { setLoading(true); signIn("google", { callbackUrl: "/onboarding" }); }} />
          <p className="mt-2 text-center text-xs text-muted-foreground">Ao continuar com o Google, você aceita os Termos e a Política de Privacidade.</p>
          <Divider />
        </>
      )}

      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="name" className="label-base">Nome</label>
          <input id="name" autoComplete="name" required minLength={2} maxLength={80} className="input-base" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="space-y-2">
          <label htmlFor="email" className="label-base">E-mail</label>
          <input id="email" type="email" autoComplete="email" required className="input-base" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="voce@empresa.com" />
        </div>
        <div className="space-y-2">
          <label htmlFor="password" className="label-base">Senha</label>
          <input id="password" type="password" autoComplete="new-password" required className="input-base" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <p className={`text-xs ${form.password && !strong ? "text-destructive" : "text-muted-foreground"}`}>Mínimo de 8 caracteres, com letras e números.</p>
        </div>
        <label className="flex items-start gap-2.5 text-sm text-muted-foreground">
          <input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--brand)]" />
          <span>
            Li e aceito os <Link href="/legal/terms" target="_blank" className="text-foreground underline">Termos de Uso</Link> e a{" "}
            <Link href="/legal/privacy" target="_blank" className="text-foreground underline">Política de Privacidade</Link>.
          </span>
        </label>

        {error && <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2.5 text-sm text-destructive">{error}</p>}

        <button type="submit" disabled={loading} className={`${buttonClass("brand", "lg")} w-full`}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />} Criar conta
        </button>
      </form>
    </AuthShell>
  );
}
