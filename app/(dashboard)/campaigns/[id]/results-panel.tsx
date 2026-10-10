"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BarChart3, Loader2, RefreshCw, Sparkles, Trophy } from "lucide-react";
import { toast } from "sonner";
import { useFormatter, useNow, useTranslations } from "next-intl";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { buttonClass } from "@/components/app/ui-bits";
import { setMascotMood } from "@/components/mascot/mascot-events";

export interface CreativeResult {
  creativeId: string;
  impressions: number;
  reach: number;
  clicks: number;
  spend: number;
  purchases: number;
  revenue: number;
  engagement: number;
  videoViews: number;
  currency: string | null;
  ads: number;
  posts: number;
  ctr: number | null;
  cpc: number | null;
  cpa: number | null;
  roas: number | null;
  engagementRate: number | null;
  active: boolean;
  needsPermission: boolean;
}

export interface Ranking {
  results: CreativeResult[];
  basis: "roas" | "cpa" | "ctr" | "engagement" | null;
  winnerId: string | null;
  syncedAt: string | null;
}

/** Painel do topo: como o campeão é escolhido, última atualização e o botão de atualizar. */
export function ResultsPanel({ campaignId, ranking, onRanking }: { campaignId: string; ranking: Ranking; onRanking: (r: Ranking) => void }) {
  const t = useTranslations("campaigns.results");
  const format = useFormatter();
  const now = useNow({ updateInterval: 60_000 });
  const [syncing, setSyncing] = useState(false);
  const needsPermission = ranking.results.some((r) => r.needsPermission);

  const sync = async () => {
    setSyncing(true);
    const res = await fetch(`/api/campaigns/${campaignId}/insights`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setSyncing(false);
    if (!res.ok) return toast.error(data.error || t("syncError"));
    onRanking(data);
    toast.success(t("synced"));
  };

  return (
    <section className="surface mb-6 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 font-semibold"><BarChart3 className="h-4 w-4 text-brand" /> {t("title")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {ranking.winnerId && ranking.basis ? t(`basis.${ranking.basis}`) : ranking.results.length ? t("notEnough", { min: 300 }) : t("empty")}
          </p>
          {needsPermission && <p className="mt-1 text-xs text-warning">{t("needsPermission")}</p>}
        </div>
        <div className="flex items-center gap-3">
          {ranking.syncedAt && <span className="text-xs text-muted-foreground">{t("updated", { when: format.relativeTime(new Date(ranking.syncedAt), now) })}</span>}
          <button onClick={sync} disabled={syncing} className={buttonClass("outline", "sm")}>
            {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} {t("sync")}
          </button>
        </div>
      </div>
    </section>
  );
}

/** Números de um criativo (e o selo de campeão). */
export function ResultStrip({ result, winner }: { result: CreativeResult; winner: boolean }) {
  const t = useTranslations("campaigns.results");
  const format = useFormatter();
  const money = (v: number) => (result.currency ? format.number(v, { style: "currency", currency: result.currency }) : format.number(v, { maximumFractionDigits: 2 }));
  const pct = (v: number) => format.number(v, { style: "percent", maximumFractionDigits: 1 });
  const items = [
    result.impressions > 0 && [t("impressions"), format.number(result.impressions, { notation: "compact" })],
    result.spend > 0 && result.ctr !== null && [t("ctr"), pct(result.ctr)],
    result.purchases > 0 && [t("purchases"), format.number(result.purchases)],
    result.roas !== null && [t("roas"), `${format.number(result.roas, { maximumFractionDigits: 1 })}x`],
    result.cpa !== null && result.roas === null && [t("cpa"), money(result.cpa)],
    result.spend > 0 && [t("spend"), money(result.spend)],
    result.spend === 0 && result.engagementRate !== null && [t("engagement"), pct(result.engagementRate)],
  ].filter(Boolean) as [string, string][];

  return (
    <div className={`border-t border-border px-4 py-3 ${winner ? "bg-brand/5" : ""}`}>
      <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        {winner && <span className="inline-flex items-center gap-1 rounded-full bg-brand px-2 py-0.5 font-semibold text-brand-foreground"><Trophy className="h-3 w-3" /> {t("winner")}</span>}
        <span className="text-muted-foreground">{[result.ads && t("ads", { count: result.ads }), result.posts && t("posts", { count: result.posts })].filter(Boolean).join(" · ")}</span>
        {result.active && <span className="whitespace-nowrap text-success">● {t("active")}</span>}
      </div>
      {items.length > 0 ? (
        <dl className="grid grid-cols-[repeat(auto-fill,minmax(5rem,1fr))] gap-x-3 gap-y-1.5">
          {items.slice(0, 6).map(([k, v]) => (
            <div key={k} className="min-w-0">
              <dt className="text-[11px] leading-tight text-muted-foreground">{k}</dt>
              <dd className="text-sm font-semibold tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-xs text-muted-foreground">{t("waiting")}</p>
      )}
    </div>
  );
}

/** "Gerar mais como este": quantas variações, custo e confirmação. */
export function WinnerDialog({ campaignId, creativeId, unitCost, onClose }: { campaignId: string; creativeId: string | null; unitCost: number; onClose: () => void }) {
  const t = useTranslations("campaigns.results");
  const router = useRouter();
  const [count, setCount] = useState(2);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (!creativeId) return;
    setBusy(true);
    setMascotMood("working");
    const res = await fetch(`/api/campaigns/${campaignId}/winner`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creativeId, count }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setMascotMood("confused", 4000);
      return toast.error(data.error || t("winnerError"));
    }
    toast.success(t("winnerStarted", { count: data.count }));
    setMascotMood("working", 8000);
    onClose();
    router.refresh();
  };

  return (
    <Dialog open={!!creativeId} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Trophy className="h-4 w-4 text-brand" /> {t("winnerTitle")}</DialogTitle>
          <DialogDescription>{t("winnerDescription")}</DialogDescription>
        </DialogHeader>
        <div>
          <p className="mb-2 text-sm font-medium">{t("winnerCount")}</p>
          <div className="grid grid-cols-4 gap-2">
            {[1, 2, 3, 4].map((n) => (
              <button key={n} type="button" onClick={() => setCount(n)} data-selected={count === n} className="choice py-2.5 text-center text-lg font-semibold tabular-nums">{n}</button>
            ))}
          </div>
          <p className="mt-3 text-sm text-muted-foreground">{t("winnerCost", { count: unitCost * count })}</p>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className={buttonClass("ghost")}>{t("cancel")}</button>
          <button onClick={run} disabled={busy} className={buttonClass("brand")}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} {t("winnerConfirm")}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
