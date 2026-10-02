"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { PixelMascot } from "@/components/mascot/PixelMascot";
import { buttonClass } from "@/components/app/ui-bits";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("errorPages");
  const tc = useTranslations("common");
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
      <PixelMascot mood="confused" size={88} />
      <h1 className="mt-6 text-3xl font-semibold tracking-tight">{t("errorTitle")}</h1>
      <p className="mt-2 max-w-sm text-muted-foreground">
        {t("errorText")}
        {error.digest && <span className="mt-2 block font-mono text-xs">{t("code", { code: error.digest })}</span>}
      </p>
      <div className="mt-8 flex gap-2">
        <button onClick={reset} className={buttonClass("primary")}>{tc("tryAgain")}</button>
        <Link href="/dashboard" className={buttonClass("outline")}>{t("backDashboard")}</Link>
      </div>
    </div>
  );
}
