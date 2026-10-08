"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { AuthShell } from "@/components/auth/auth-shell";
import { buttonClass } from "@/components/app/ui-bits";

export function AcceptTermsForm({ version, updatedAt, updated, next }: { version: string; updatedAt: string; updated: boolean; next: string }) {
  const t = useTranslations("auth");
  const router = useRouter();
  const [accept, setAccept] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accept) return setError(t("signup.errors.acceptTerms"));
    setLoading(true);
    setError(null);
    const res = await fetch("/api/legal/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accept: true, version }),
    });
    if (!res.ok) {
      setLoading(false);
      // Os textos mudaram enquanto a tela estava aberta: recarrega para mostrar a versão nova.
      if (res.status === 409) return router.refresh();
      return setError(t("acceptTerms.error"));
    }
    router.replace(next);
    router.refresh();
  };

  return (
    <AuthShell
      title={updated ? t("acceptTerms.titleUpdated") : t("acceptTerms.title")}
      subtitle={updated ? t("acceptTerms.subtitleUpdated", { date: updatedAt }) : t("acceptTerms.subtitle")}
    >
      <form onSubmit={submit} className="space-y-5">
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
          {loading && <Loader2 className="h-4 w-4 animate-spin" />} {t("acceptTerms.submit")}
        </button>
        <button type="button" onClick={() => signOut({ callbackUrl: "/login" })} className={`${buttonClass("ghost")} w-full`}>
          {t("acceptTerms.signOut")}
        </button>
      </form>
    </AuthShell>
  );
}
