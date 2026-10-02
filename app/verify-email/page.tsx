"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { AuthShell } from "@/components/auth/auth-shell";
import { buttonClass } from "@/components/app/ui-bits";

function Verify() {
  const t = useTranslations("auth.verify");
  const token = useSearchParams().get("token") || "";
  const [state, setState] = useState<"loading" | "ok" | "error">(token ? "loading" : "error");
  const [message, setMessage] = useState(t("incomplete"));
  const ran = useRef(false);

  useEffect(() => {
    if (!token || ran.current) return;
    ran.current = true;
    fetch("/api/auth/verify-email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (res.ok) setState("ok");
        else { setState("error"); setMessage(data.error || t("invalid")); }
      })
      .catch(() => { setState("error"); setMessage(t("connection")); });
  }, [token, t]);

  if (state === "loading") {
    return (
      <AuthShell title={t("loading")} mood="working">
        <Loader2 className="h-6 w-6 animate-spin text-brand" />
      </AuthShell>
    );
  }
  if (state === "ok") {
    return (
      <AuthShell title={t("okTitle")} subtitle={t("okSubtitle")} mood="happy">
        <Link href="/dashboard" className={`${buttonClass("brand", "lg")} w-full`}>{t("goDashboard")}</Link>
      </AuthShell>
    );
  }
  return (
    <AuthShell title={t("errorTitle")} subtitle={message} mood="confused">
      <p className="text-sm text-muted-foreground">{t("errorHelp")}</p>
      <Link href="/login" className={`${buttonClass("primary", "lg")} mt-6 w-full`}>{t("signIn")}</Link>
    </AuthShell>
  );
}

export default function VerifyEmailPage() {
  return <Suspense><Verify /></Suspense>;
}
