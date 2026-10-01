"use client";

import { useState } from "react";
import { MailWarning } from "lucide-react";
import { toast } from "sonner";

export function VerifyEmailBanner() {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const resend = async () => {
    setSending(true);
    const res = await fetch("/api/auth/verify-email", { method: "PUT" });
    const data = await res.json().catch(() => ({}));
    setSending(false);
    if (res.ok) {
      setSent(true);
      toast.success("Enviamos um novo link para o seu e-mail.");
    } else {
      toast.error(data.error || "Não foi possível reenviar agora.");
    }
  };

  return (
    <div className="border-b border-warning/30 bg-warning/10 px-4 py-2.5 text-sm sm:px-6 lg:px-10">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-1">
        <MailWarning className="h-4 w-4 shrink-0 text-warning" />
        <span className="text-foreground">Confirme seu e-mail para liberar a geração de campanhas.</span>
        <button onClick={resend} disabled={sending || sent} className="font-semibold text-brand hover:underline disabled:opacity-60">
          {sent ? "Link enviado" : sending ? "Enviando..." : "Reenviar link"}
        </button>
      </div>
    </div>
  );
}
