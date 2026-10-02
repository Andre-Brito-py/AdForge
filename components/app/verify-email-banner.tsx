"use client";

import { useState } from "react";
import { MailWarning } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

export function VerifyEmailBanner() {
  const t = useTranslations("verifyBanner");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const resend = async () => {
    setSending(true);
    const res = await fetch("/api/auth/verify-email", { method: "PUT" });
    const data = await res.json().catch(() => ({}));
    setSending(false);
    if (res.ok) {
      setSent(true);
      toast.success(t("sentToast"));
    } else {
      toast.error(data.error || t("error"));
    }
  };

  return (
    <div className="border-b border-warning/30 bg-warning/10 px-4 py-2.5 text-sm sm:px-6 lg:px-10">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-1">
        <MailWarning className="h-4 w-4 shrink-0 text-warning" />
        <span className="text-foreground">{t("text")}</span>
        <button onClick={resend} disabled={sending || sent} className="font-semibold text-brand hover:underline disabled:opacity-60">
          {sent ? t("sent") : sending ? t("sending") : t("resend")}
        </button>
      </div>
    </div>
  );
}
