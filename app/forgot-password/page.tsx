"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, MailCheck } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { buttonClass } from "@/components/app/ui-bits";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/auth/forgot-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) return setError(data.error || "Tente novamente em instantes.");
    setSent(true);
  };

  return (
    <AuthShell
      title={sent ? "Confira seu e-mail" : "Esqueceu a senha?"}
      subtitle={sent ? undefined : "Enviamos um link para você criar uma nova senha."}
      footer={<Link href="/login" className="font-medium text-brand hover:underline">Voltar para o login</Link>}
    >
      {sent ? (
        <div className="flex gap-3 rounded-2xl bg-muted p-4 text-sm">
          <MailCheck className="h-5 w-5 shrink-0 text-brand" />
          <p>Se existir uma conta para <strong>{email}</strong>, você vai receber um link válido por 1 hora. Confira também a caixa de spam.</p>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="email" className="label-base">E-mail da conta</label>
            <input id="email" type="email" autoComplete="email" required className="input-base" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          {error && <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2.5 text-sm text-destructive">{error}</p>}
          <button type="submit" disabled={loading} className={`${buttonClass("primary", "lg")} w-full`}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />} Enviar link
          </button>
        </form>
      )}
    </AuthShell>
  );
}
