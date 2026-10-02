"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { PixelMascot, type MascotMood } from "./PixelMascot";
import { onMascotMood, setMascotHidden, useMascotHidden } from "./mascot-events";


const SLEEP_AFTER_MS = 60_000;

/** Mascote discreto no canto inferior direito do app. */
export function MascotCorner() {
  const t = useTranslations("mascot");
  const TIPS = t.raw("tips") as string[];
  const hidden = useMascotHidden();
  const [mood, setMood] = useState<MascotMood>("idle");
  const [bubble, setBubble] = useState(false);
  const [tip, setTip] = useState(0);
  const forced = useRef<MascotMood | null>(null);
  const sleepTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Dorme depois de um tempo sem interação; acorda com qualquer movimento.
  useEffect(() => {
    const scheduleSleep = () => {
      if (sleepTimer.current) clearTimeout(sleepTimer.current);
      sleepTimer.current = setTimeout(() => {
        if (!forced.current) setMood("sleeping");
      }, SLEEP_AFTER_MS);
    };
    const wake = () => {
      setMood((m) => (m === "sleeping" ? forced.current || "idle" : m));
      scheduleSleep();
    };
    scheduleSleep();
    window.addEventListener("pointermove", wake, { passive: true });
    window.addEventListener("keydown", wake);
    return () => {
      window.removeEventListener("pointermove", wake);
      window.removeEventListener("keydown", wake);
      if (sleepTimer.current) clearTimeout(sleepTimer.current);
    };
  }, []);

  useEffect(
    () =>
      onMascotMood((next, durationMs) => {
        forced.current = durationMs ? null : next === "idle" ? null : next;
        setMood(next);
        if (durationMs) setTimeout(() => setMood(forced.current || "idle"), durationMs);
      }),
    []
  );

  if (hidden) return null;

  return (
    <div className="pointer-events-none fixed bottom-3 right-3 z-40 flex flex-col items-end gap-2 sm:bottom-5 sm:right-5">
      {bubble && (
        <div className="pointer-events-auto relative max-w-[240px] rounded-2xl border border-border bg-popover px-4 py-3 text-xs leading-relaxed text-popover-foreground shadow-lg animate-in fade-in slide-in-from-bottom-2">
          <button
            onClick={() => setMascotHidden(true)}
            className="absolute right-1.5 top-1.5 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label={t("hide")}
            title={t("hideHint")}
          >
            <X className="h-3 w-3" />
          </button>
          <p className="pr-4 font-medium text-foreground">{t("tipTitle")}</p>
          <p className="mt-1 text-muted-foreground">{TIPS[tip]}</p>
          <button onClick={() => setTip((t) => (t + 1) % TIPS.length)} className="mt-2 font-medium text-brand hover:underline">
            {t("anotherTip")}
          </button>
        </div>
      )}
      <button
        onClick={() => {
          setBubble((b) => !b);
          setTip(Math.floor(Math.random() * TIPS.length));
        }}
        className="pointer-events-auto rounded-xl p-1 opacity-80 transition hover:-translate-y-0.5 hover:opacity-100 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
        aria-label={t("open")}
        aria-expanded={bubble}
      >
        <PixelMascot mood={mood} size={40} />
      </button>
    </div>
  );
}
