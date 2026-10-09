"use client";

import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Loader2, XCircle, CircleDashed } from "lucide-react";
import { PixelMascot } from "@/components/mascot/PixelMascot";
import { VyStudio } from "@/components/mascot/VyStudio";
import { setMascotMood } from "@/components/mascot/mascot-events";
import { buttonClass } from "@/components/app/ui-bits";
import { useTranslations } from "next-intl";

interface CreativeStatus { id: string; type: string; status: string; variantIndex: number; headline: string | null; segments?: { done: number; total: number; lipsync?: boolean } | null }
interface CampaignStatus { id: string; name: string; status: string; creatives: CreativeStatus[] }


export default function GeneratingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useTranslations("campaigns.generating");
  const MESSAGES = t.raw("messages") as string[];
  const router = useRouter();
  const [data, setData] = useState<CampaignStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState(0);
  const done = useRef(false);

  useEffect(() => {
    setMascotMood("working");
    const timer = setInterval(() => setMsg((m) => (m + 1) % MESSAGES.length), 3500);
    return () => { clearInterval(timer); setMascotMood("idle"); };
  }, [MESSAGES.length]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let delay = 2500;
    const poll = async () => {
      try {
        const res = await fetch(`/api/campaigns/${id}`, { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || t("connectionError"));
        setData(json);
        if (json.status !== "GENERATING" && !done.current) {
          done.current = true;
          setMascotMood(json.status === "FAILED" ? "confused" : "happy", 5000);
          setTimeout(() => {
            router.replace(`/campaigns/${id}`);
            router.refresh(); // atualiza o saldo da barra lateral (estornos)
          }, 1400);
          return;
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : t("connectionError"));
      }
      // Vídeos levam minutos: espaça o polling aos poucos.
      delay = Math.min(delay * 1.15, 8000);
      timer = setTimeout(poll, delay);
    };
    poll();
    return () => clearTimeout(timer);
  }, [id, router, t]);

  const visuals = (data?.creatives || []).filter((c) => c.type !== "COPY");
  const headlines = new Map((data?.creatives || []).filter((c) => c.type === "COPY").map((c) => [c.variantIndex, c.headline]));
  const finished = visuals.filter((c) => c.status === "COMPLETED" || c.status === "FAILED").length;
  // Vídeos longos contam as cenas prontas no progresso (senão a barra fica parada por vários minutos).
  const partial = visuals.reduce((sum, c) => sum + (c.status === "PROCESSING" && c.segments ? c.segments.done / (c.segments.total + 1) : 0), 0);
  const progress = visuals.length ? Math.round(((finished + partial + 0.15) / (visuals.length + 0.15)) * 100) : 8;
  const isVideo = visuals[0]?.type === "VIDEO";
  const finishedAll = data && data.status !== "GENERATING";

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center py-6 text-center sm:py-12">
      {finishedAll && data?.status === "FAILED"
        ? <PixelMascot mood="confused" size={96} />
        : <VyStudio kind={isVideo ? "VIDEO" : "IMAGE"} progress={Math.min(progress, 100)} done={!!finishedAll} />}
      <h1 className="mt-6 text-2xl font-semibold tracking-tight sm:text-3xl">
        {finishedAll ? t("done") : t("title")}
      </h1>
      <p className="mt-2 min-h-6 text-muted-foreground" aria-live="polite">
        {finishedAll ? t("opening") : MESSAGES[msg]}
      </p>

      <div className="mt-8 w-full">
        <div className="mb-2 flex justify-between text-xs text-muted-foreground">
          <span>{t("progress", { done: finished, total: visuals.length || "…" })} {isVideo ? t("videos") : t("images")}</span>
          <span className="tabular-nums">{Math.min(progress, 100)}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-brand transition-all duration-700" style={{ width: `${Math.min(progress, 100)}%` }} />
        </div>
      </div>

      {visuals.length > 0 && (
        <ul className="surface mt-8 w-full divide-y divide-border text-left">
          {visuals.map((c, i) => (
            <li key={c.id} className="flex items-center gap-3 px-4 py-3 text-sm">
              {c.status === "COMPLETED" ? <CheckCircle2 className="h-4 w-4 text-success" />
                : c.status === "FAILED" ? <XCircle className="h-4 w-4 text-destructive" />
                : c.status === "PROCESSING" ? <Loader2 className="h-4 w-4 animate-spin text-brand" />
                : <CircleDashed className="h-4 w-4 text-muted-foreground" />}
              <span className="font-medium">{t("variation", { n: i + 1 })}</span>
              <span className="truncate text-muted-foreground">{headlines.get(c.variantIndex)}</span>
              {c.segments && (c.segments.total > 1 || c.segments.lipsync) && (
                <span className="ml-auto shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums text-muted-foreground">
                  {c.segments.lipsync ? t("lipsync") : c.segments.done >= c.segments.total ? t("assembling") : t("scene", { done: c.segments.done + 1, total: c.segments.total })}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {isVideo && !finishedAll && (
        <p className="mt-6 text-xs text-muted-foreground">
          {t("videoNote")}
        </p>
      )}
      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

      <Link href="/campaigns" className={`${buttonClass("ghost")} mt-6`}>{t("back")}</Link>
    </div>
  );
}
