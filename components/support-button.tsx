"use client";

import { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { formatHour, isSupportOpen, nextOpening, whatsappLink, type SupportConfig } from "@/lib/support";

/**
 * Atendimento pelo WhatsApp com o status do horário (configurado em Admin › Configurações gerais).
 * Fora do horário o link continua funcionando ("Deixar mensagem"), com o aviso de quando o atendimento volta.
 */
export function SupportButton({ support, email, variant = "card" }: { support: SupportConfig; email?: string | null; variant?: "card" | "link" }) {
  const t = useTranslations("support");
  const locale = useLocale() === "en" ? "en" : "pt";
  const [open, setOpen] = useState(() => isSupportOpen(support));

  // O status muda com o relógio: confere a cada minuto.
  useEffect(() => {
    const timer = setInterval(() => setOpen(isSupportOpen(support)), 60_000);
    return () => clearInterval(timer);
  }, [support]);

  const href = whatsappLink(support, email ? t("accountLine", { email }) : undefined);
  if (!href) return null;

  const start = formatHour(support.start, locale);
  const end = formatHour(support.end, locale);
  const days = t.raw("days") as string[];
  const back = (() => {
    if (open) return null;
    const next = nextOpening(support);
    if (!next) return null;
    const time = formatHour(next.time, locale);
    return next.inDays === 0 ? t("backToday", { time }) : next.inDays === 1 ? t("backTomorrow", { time }) : t("backOn", { day: days[next.day], time });
  })();
  const hours = support.days.length === 7
    ? t("hours", { start, end })
    : t("hoursDays", { days: support.days.map((d) => days[d]).join(", "), start, end });

  if (variant === "link") {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 hover:text-foreground" title={hours}>
        <span className={`h-2 w-2 rounded-full ${open ? "bg-emerald-500" : "bg-muted-foreground/50"}`} aria-hidden="true" />
        {t("title")}
      </a>
    );
  }

  return (
    <a href={href} target="_blank" rel="noopener noreferrer" title={hours}
      className="surface flex items-center gap-3 p-3 transition hover:border-foreground/20">
      <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/12 text-emerald-600 dark:text-emerald-400">
        <MessageCircle className="h-4 w-4" />
        <span className={`absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-sidebar ${open ? "bg-emerald-500" : "bg-muted-foreground/60"}`} />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium">{open ? t("talk") : t("leaveMessage")}</span>
        <span className="block truncate text-xs text-muted-foreground">{open ? t("online") : back || t("offline")}</span>
      </span>
    </a>
  );
}
