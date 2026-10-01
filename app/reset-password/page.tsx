"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { buttonClass } from "@/components/app/ui-bits";

function ResetForm() {
  const token = useSearchParams().get("token") || "";
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(token ? null : "Link incompleto. Abra o link do e-mail novamente.");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/auth/reset-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, password }) });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) return setError(data.error || "Não foi possível redefinir a senha.");
    setDone(true);
  };

  if (done) {
    return (
      <AuthShell title="Senha alterada" subtitle="Por segurança, encerramos as sessões abertas com a senha antiga." mood="happy">
        <Link href="/login" className={`${buttonClass("primary", "lg")} w-full`}>Entrar com a nova senha</Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Criar nova senha" footer={<Link href="/forgot-password" className="text-brand hover:underline">Pedir um novo link</Link>}>
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="password" className="label-base">Nova senha</label>
          <input id="password" type="password" autoComplete="new-password" required minLength={8} className="input-base" value={password} onChange={(e) => setPassword(e.target.value)} />
          <p className="text-xs text-muted-foreground">Mínimo de 8 caracteres, com letras e números.</p>
        </div>
        {error && <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2.5 text-sm text-destructive">{error}</p>}
        <button type="submit" disabled={loading || !token} className={`${buttonClass("primary", "lg")} w-full`}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />} Salvar nova senha
        </button>
      </form>
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return <Suspense><ResetForm /></Suspense>;
}
