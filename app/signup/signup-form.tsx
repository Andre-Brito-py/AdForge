"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { AuthShell, Divider, GoogleButton } from "@/components/auth/auth-shell";
import { buttonClass } from "@/components/app/ui-bits";

export function SignupForm({ googleEnabled, signupCredits, termsVersion, initialEmail = "" }: { googleEnabled: boolean; signupCredits: number; termsVersion: string; initialEmail?: string }) {
  const t = useTranslations("auth");
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: initialEmail, password: "" });
  const [accept, setAccept] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const strong = form.password.length >= 8 && /[A-Za-z]/.test(form.password) && /\d/.test(form.password);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!strong) return setError(t("signup.errors.weakPassword"));
    if (!accept) return setError(t("signup.errors.acceptTerms"));
    setLoading(true);

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, acceptTerms: true }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setLoading(false);
      return setError(data.error || t("signup.errors.generic"));
    }

    const login = await signIn("credentials", { email: form.email, password: form.password, redirect: false });
    router.replace(login?.ok && !login.error ? "/onboarding" : "/login");
    router.refresh();
  };

  return (
    <AuthShell
      title={t("signup.title")}
      subtitle={signupCredits > 0 ? t("signup.subtitleCredits", { count: signupCredits }) : t("signup.subtitle")}
      footer={<>{t("signup.hasAccount")} <Link href="/login" className="font-medium text-brand hover:underline">{t("signup.signIn")}</Link></>}
      mood="happy"
    >
      {googleEnabled && (
        <>
          <GoogleButton disabled={loading} onClick={async () => {
            if (!accept) return setError(t("signup.errors.acceptTerms"));
            setLoading(true);
            // Registra o aceite antes de sair para o Google (a conta é criada na volta).
            await fetch("/api/legal/accept", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ accept: true, version: termsVersion }),
            }).catch(() => undefined);
            signIn("google", { callbackUrl: "/onboarding" });
          }} />
          <p className="mt-2 text-center text-xs text-muted-foreground">{t("signup.googleNotice")}</p>
          <Divider />
        </>
      )}

      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="name" className="label-base">{t("signup.name")}</label>
          <input id="name" autoComplete="name" required minLength={2} maxLength={80} className="input-base" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="space-y-2">
          <label htmlFor="email" className="label-base">{t("email")}</label>
          <input id="email" type="email" autoComplete="email" required className="input-base" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder={t("emailPlaceholder")} />
        </div>
        <div className="space-y-2">
          <label htmlFor="password" className="label-base">{t("password")}</label>
          <input id="password" type="password" autoComplete="new-password" required className="input-base" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <p className={`text-xs ${form.password && !strong ? "text-destructive" : "text-muted-foreground"}`}>{t("passwordHint")}</p>
        </div>
        <label className="flex items-start gap-2.5 text-sm text-muted-foreground">
          <input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--brand)]" />
          <span>
            {t.rich("signup.accept", {
              terms: (chunks) => <Link href="/legal/terms" target="_blank" className="text-foreground underline">{chunks}</Link>,
              privacy: (chunks) => <Link href="/legal/privacy" target="_blank" className="text-foreground underline">{chunks}</Link>,
            })}
          </span>
        </label>

        {error && <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2.5 text-sm text-destructive">{error}</p>}

        <button type="submit" disabled={loading} className={`${buttonClass("brand", "lg")} w-full`}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />} {t("signup.submit")}
        </button>
      </form>
    </AuthShell>
  );
}
