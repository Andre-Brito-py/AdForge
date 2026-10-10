"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Copy, Download, Loader2, MessageCircle, RefreshCw, Send, Sparkles, Volume2, Lightbulb } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader, StatusBadge, buttonClass } from "@/components/app/ui-bits";
import { DeleteButton } from "@/components/app/delete-button";
import { useFormatter, useNow, useTranslations } from "next-intl";
import { objectiveLabel, platformLabel, styleLabel } from "@/lib/catalog-i18n";
import { setMascotMood } from "@/components/mascot/mascot-events";
import { PixelMascot } from "@/components/mascot/PixelMascot";
import { AdList, PublicationList, PublishDialog, type AdRow, type PublicationRow, type PublishingInfo } from "./publish-dialog";
import { VIDEO_ASPECTS } from "@/lib/video-aspects";
import { ResultStrip, ResultsPanel, WinnerDialog, type Ranking } from "./results-panel";

interface Creative {
  id: string; type: string; status: string; variantIndex: number; outputUrl: string | null; thumbnailUrl?: string | null; audioUrl: string | null;
  headline: string | null; text: string | null; cta: string | null; hashtags?: string | null; aspectRatio: string | null; creditsUsed: number;
}
interface Campaign {
  id: string; name: string; status: string; createdAt: string; objective: string; platform: string | null; style: string | null; quality: string; language: string;
  product: { id: string; name: string; originalImageUrl: string };
  creatives: Creative[];
}

const RATIO_CLASS: Record<string, string> = { "1:1": "aspect-square", "4:5": "aspect-[4/5]", "9:16": "aspect-[9/16]", "16:9": "aspect-video" };

function copyText(c: Creative | undefined) {
  if (!c) return "";
  return [c.headline, c.text, c.cta, c.hashtags].filter(Boolean).join("\n\n");
}

/** Legenda pronta para postar: texto + hashtags (o título fica de fora, já que vai na imagem/vídeo). */
function captionText(c: Creative | undefined) {
  if (!c) return "";
  return [c.text, c.hashtags].filter(Boolean).join("\n\n");
}

export default function CreativeGalleryClient({
  campaign, strategy, unitCost, emailVerified, publishing, initialPublications, initialRanking,
}: {
  campaign: Campaign;
  strategy: { analysis: string; hooks: string[] } | null;
  unitCost: number | null;
  emailVerified: boolean;
  publishing: PublishingInfo;
  initialPublications: PublicationRow[];
  /** Resultados dos anúncios/posts (null quando ainda não há nada publicado para medir). */
  initialRanking: Ranking | null;
}) {
  const [ranking, setRanking] = useState<Ranking | null>(initialRanking);
  const [winnerFor, setWinnerFor] = useState<string | null>(null);
  const router = useRouter();
  const t = useTranslations("campaigns.gallery");
  const tn = useTranslations("nav");
  const tcat = useTranslations("catalog");
  const tcom = useTranslations("common");
  const format = useFormatter();
  const now = useNow({ updateInterval: 60_000 });
  const [regenFor, setRegenFor] = useState<Creative | null | undefined>(undefined);
  const [instructions, setInstructions] = useState("");
  const [regenerating, setRegenerating] = useState(false);
  const [regenNotice, setRegenNotice] = useState<{ kind: "OUT_OF_SCOPE" | "POLICY_VIOLATION"; message: string } | null>(null);
  const tw = useTranslations("campaigns.wizard");
  const [publishFor, setPublishFor] = useState<{ visual: Creative; copy?: Creative } | null>(null);
  const [publications, setPublications] = useState<PublicationRow[]>(initialPublications);
  const publishingNow = publications.some((p) => p.status === "PENDING" || p.status === "PROCESSING");
  const [ads, setAds] = useState<AdRow[]>([]);
  const loadAds = useCallback(async () => {
    const res = await fetch(`/api/ads?campaignId=${campaign.id}`, { cache: "no-store" }).catch(() => null);
    if (res?.ok) setAds(await res.json());
  }, [campaign.id]);
  const adsRunning = ads.some((a) => a.status === "PENDING" || a.status === "PROCESSING");
  useEffect(() => {
    if (!publishing.connected) return;
    let alive = true;
    fetch(`/api/ads?campaignId=${campaign.id}`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (alive && data) setAds(data); })
      .catch(() => undefined);
    return () => { alive = false; };
  }, [campaign.id, publishing.connected]);
  // Anúncio pago sendo criado na Meta (vídeo leva alguns minutos): acompanha até terminar.
  useEffect(() => {
    if (!adsRunning) return;
    const t = setInterval(loadAds, 6000);
    return () => clearInterval(t);
  }, [adsRunning, loadAds]);

  // Acompanha publicações em andamento (vídeos no Instagram levam alguns minutos).
  useEffect(() => {
    if (!publishingNow) return;
    const t = setInterval(async () => {
      const res = await fetch(`/api/publications?campaignId=${campaign.id}`, { cache: "no-store" }).catch(() => null);
      if (res?.ok) setPublications(await res.json());
    }, 5000);
    return () => clearInterval(t);
  }, [publishingNow, campaign.id]);

  const sets = useMemo(() => {
    const copies = new Map(campaign.creatives.filter((c) => c.type === "COPY").map((c) => [c.variantIndex, c]));
    return campaign.creatives.filter((c) => c.type !== "COPY").map((visual) => ({ visual, copy: copies.get(visual.variantIndex) }));
  }, [campaign.creatives]);

  const pending = sets.some((s) => s.visual.status === "QUEUED" || s.visual.status === "PROCESSING");
  const failedCount = sets.filter((s) => s.visual.status === "FAILED").length;

  // Enquanto houver criativos em geração, atualiza a página periodicamente.
  useEffect(() => {
    if (!pending) return;
    const t = setInterval(async () => {
      await fetch(`/api/campaigns/${campaign.id}`, { cache: "no-store" }).catch(() => null);
      router.refresh();
    }, 5000);
    return () => clearInterval(t);
  }, [pending, campaign.id, router]);

  const download = async (url: string, name: string) => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      window.open(url, "_blank", "noopener");
    }
  };

  // Outro formato do mesmo vídeo: renderizado no servidor na primeira vez (alguns segundos) e depois só baixado.
  const [formatBusy, setFormatBusy] = useState<string | null>(null);
  const downloadFormat = async (visual: Creative, aspect: string, name: string) => {
    setFormatBusy(`${visual.id}:${aspect}`);
    const toastId = toast.loading(t("formatPreparing", { aspect }));
    try {
      const res = await fetch(`/api/creatives/${visual.id}/format`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aspect }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) throw new Error(data.error || t("formatError"));
      toast.dismiss(toastId);
      await download(data.url, name);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("formatError"), { id: toastId });
    } finally {
      setFormatBusy(null);
    }
  };

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    toast.success(t("textCopied"));
  };

  const regenerate = async () => {
    setRegenerating(true);
    const res = await fetch(`/api/campaigns/${campaign.id}/creatives`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ baseCreativeId: regenFor?.id || null, instructions: instructions || null }),
    });
    const data = await res.json().catch(() => ({}));
    setRegenerating(false);
    if (!res.ok && (data.code === "OUT_OF_SCOPE" || data.code === "POLICY_VIOLATION")) {
      setMascotMood("confused", 6000);
      return setRegenNotice({ kind: data.code, message: data.error });
    }
    if (!res.ok) return toast.error(data.error || t("regenError"));
    setRegenNotice(null);
    toast.success(t("regenStarted"));
    setMascotMood("working", 8000);
    setRegenFor(undefined);
    setInstructions("");
    router.refresh();
  };

  return (
    <>
      <PageHeader
        back={{ href: "/campaigns", label: tn("campaigns") }}
        title={campaign.name}
        description={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <StatusBadge status={pending ? "GENERATING" : campaign.status} />
            <span>{objectiveLabel(tcat, campaign.objective)} · {platformLabel(tcat, campaign.platform)} · {styleLabel(tcat, campaign.style)} · {campaign.language} · {format.relativeTime(new Date(campaign.createdAt), now)}</span>
          </span>
        }
        actions={
          <>
            {!pending && (
              <DeleteButton endpoint={`/api/campaigns/${campaign.id}`} redirectTo="/campaigns" confirmText={t("deleteConfirm")} />
            )}
            {unitCost !== null && (
              <button onClick={() => setRegenFor(null)} disabled={!emailVerified} className={buttonClass("brand")}>
                <Sparkles className="h-4 w-4" /> {t("newVariation")}
              </button>
            )}
          </>
        }
      />

      {failedCount > 0 && !pending && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-warning/30 bg-warning/10 p-4 text-sm">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <p>
            {t("failedNotice", { count: failedCount })}
          </p>
        </div>
      )}

      {ranking && <ResultsPanel campaignId={campaign.id} ranking={ranking} onRanking={setRanking} />}

      {strategy && (strategy.analysis || strategy.hooks.length > 0) && (
        <details className="surface group mb-6 p-5">
          <summary className="flex cursor-pointer list-none items-center gap-2 font-medium">
            <Lightbulb className="h-4 w-4 text-brand" /> {t("strategy")}
            <span className="ml-auto text-xs text-muted-foreground group-open:hidden">{t("show")}</span>
          </summary>
          {strategy.analysis && <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{strategy.analysis}</p>}
          {strategy.hooks.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {strategy.hooks.map((h, i) => (
                <button key={i} onClick={() => copy(h)} className="rounded-full bg-muted px-3 py-1.5 text-left text-xs hover:bg-accent" title={t("copyHook")}>
                  “{h}”
                </button>
              ))}
            </div>
          )}
        </details>
      )}

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {sets.map(({ visual, copy: c }, i) => {
          const ratio = RATIO_CLASS[visual.aspectRatio || "1:1"] || "aspect-square";
          const ext = visual.type === "VIDEO" ? "mp4" : (visual.outputUrl?.split(".").pop() || "png").slice(0, 4);
          return (
            <article key={visual.id} className="surface flex flex-col overflow-hidden">
              <div className={`relative ${ratio} max-h-[520px] w-full bg-muted`}>
                {visual.status === "COMPLETED" && visual.outputUrl ? (
                  visual.type === "VIDEO" ? (
                    // Capa = o quadro de abertura aprovado: aparece na hora e o vídeo só é baixado ao dar play.
                    <video src={visual.outputUrl} poster={visual.thumbnailUrl || undefined} controls playsInline preload={visual.thumbnailUrl ? "none" : "metadata"} className="h-full w-full object-cover" />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={visual.outputUrl} alt={c?.headline || `#${i + 1}`} className="h-full w-full object-cover" />
                  )
                ) : visual.status === "FAILED" ? (
                  <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted-foreground">
                    <AlertCircle className="h-6 w-6 text-destructive" />
                    {t("failed")}<br />{t("refunded", { count: visual.creditsUsed })}
                  </div>
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin text-brand" />
                    {visual.status === "QUEUED" ? t("queued") : visual.type === "VIDEO" ? t("generatingVideo") : t("generatingImage")}
                  </div>
                )}
                <span className="absolute left-3 top-3 rounded-full bg-background/90 px-2 py-0.5 text-xs font-medium backdrop-blur">#{i + 1}</span>
              </div>

              {/* A locução já vai dentro do vídeo; o MP3 fica disponível para quem quiser editar. */}
              {visual.audioUrl && visual.status === "COMPLETED" && (
                <a href={visual.audioUrl} target="_blank" rel="noopener" className="flex items-center gap-2 border-t border-border px-4 py-2 text-xs text-muted-foreground hover:text-foreground">
                  <Volume2 className="h-3.5 w-3.5 shrink-0" /> {t("narration")}
                </a>
              )}

              {c && (
                <div className="flex-1 space-y-2 border-t border-border p-4">
                  {c.headline && <p className="font-semibold leading-snug">{c.headline}</p>}
                  {c.text && <p className="whitespace-pre-line text-sm text-muted-foreground">{c.text}</p>}
                  {c.cta && <p className="text-xs font-medium uppercase tracking-wide text-brand">{c.cta}</p>}
                  {c.hashtags && (
                    <button onClick={() => copy(c.hashtags!)} title={t("copyHashtags")} className="block text-left text-sm text-brand/90 hover:underline">
                      {c.hashtags}
                    </button>
                  )}
                </div>
              )}

              {(() => {
                const result = ranking?.results.find((r) => r.creativeId === visual.id);
                if (!result) return null;
                const winner = ranking?.winnerId === visual.id;
                return (
                  <>
                    <ResultStrip result={result} winner={winner} />
                    {winner && unitCost !== null && (
                      <div className="border-t border-border bg-brand/5 px-3 pb-3">
                        <button onClick={() => setWinnerFor(visual.id)} disabled={!emailVerified} className={`${buttonClass("brand", "sm")} w-full`}>
                          <Sparkles className="h-3.5 w-3.5" /> {t("moreLikeThis")}
                        </button>
                      </div>
                    )}
                  </>
                );
              })()}

              <PublicationList items={publications.filter((p) => p.creativeId === visual.id)} />
              <AdList items={ads.filter((a) => a.creativeId === visual.id)} />

              <div className="flex flex-wrap gap-1.5 border-t border-border p-3">
                {visual.status === "COMPLETED" && visual.outputUrl && (
                  <button onClick={() => setPublishFor({ visual, copy: c })} className={buttonClass("brand", "sm")}>
                    <Send className="h-3.5 w-3.5" /> {t("publish")}
                  </button>
                )}
                {visual.status === "COMPLETED" && visual.outputUrl && (
                  <button onClick={() => download(visual.outputUrl!, `vysify-${campaign.id.slice(0, 6)}-${i + 1}.${ext}`)} className={buttonClass("outline", "sm")}>
                    <Download className="h-3.5 w-3.5" /> {t("download")}
                  </button>
                )}
                {c && (
                  <button onClick={() => copy(captionText(c))} className={buttonClass("outline", "sm")} title={t("copyCaptionHint")}>
                    <Copy className="h-3.5 w-3.5" /> {t("copyCaption")}
                  </button>
                )}
                {c && (
                  <a href={`https://wa.me/?text=${encodeURIComponent(copyText(c))}`} target="_blank" rel="noopener noreferrer" className={buttonClass("ghost", "sm")}>
                    <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                  </a>
                )}
                {unitCost !== null && visual.status !== "QUEUED" && visual.status !== "PROCESSING" && (
                  <button onClick={() => setRegenFor(visual)} disabled={!emailVerified} className={`${buttonClass("ghost", "sm")} ml-auto`}>
                    <RefreshCw className="h-3.5 w-3.5" /> {t("newVersion")}
                  </button>
                )}
              </div>

              {visual.type === "VIDEO" && visual.status === "COMPLETED" && visual.outputUrl && (
                <div className="flex flex-wrap items-center gap-1 border-t border-border px-3 py-2" title={t("formatsHint")}>
                  <span className="mr-1 text-xs text-muted-foreground">{t("formats")}:</span>
                  {VIDEO_ASPECTS.filter((a) => a !== (visual.aspectRatio || "9:16")).map((a) => (
                    <button key={a} disabled={!!formatBusy} className={buttonClass("ghost", "sm")}
                      onClick={() => downloadFormat(visual, a, `vysify-${campaign.id.slice(0, 6)}-${i + 1}-${a.replace(":", "x")}.mp4`)}>
                      {formatBusy === `${visual.id}:${a}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} {a}
                    </button>
                  ))}
                </div>
              )}
            </article>
          );
        })}
      </div>

      {unitCost !== null && <WinnerDialog campaignId={campaign.id} creativeId={winnerFor} unitCost={unitCost} onClose={() => setWinnerFor(null)} />}

      <PublishDialog
        key={publishFor?.visual.id || "none"}
        open={!!publishFor}
        onClose={() => setPublishFor(null)}
        creative={publishFor ? { id: publishFor.visual.id, type: publishFor.visual.type, aspectRatio: publishFor.visual.aspectRatio } : null}
        defaultCaption={captionText(publishFor?.copy)}
        headline={publishFor?.copy?.headline || ""}
        onAdCreated={loadAds}
        info={publishing}
        onPublished={(p) => setPublications((list) => [p, ...list])}
      />

      <Dialog open={regenFor !== undefined} onOpenChange={(open) => { if (!open) { setRegenFor(undefined); setRegenNotice(null); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{regenFor ? t("regenTitleOne") : t("regenTitle")}</DialogTitle>
            <DialogDescription>
              {t.rich("regenDescription", { count: unitCost ?? 0, b: (chunks) => <strong>{chunks}</strong> })}
            </DialogDescription>
          </DialogHeader>
          {regenNotice && (
            <div role="alert" className="flex items-start gap-3 rounded-xl border border-warning/30 bg-warning/10 p-3">
              <PixelMascot mood="confused" size={40} />
              <div className="min-w-0 text-sm">
                <p className="font-semibold">{regenNotice.kind === "OUT_OF_SCOPE" ? tw("vyOutOfScopeTitle") : tw("vyPolicyTitle")}</p>
                <p className="mt-1">{regenNotice.message}</p>
                <p className="mt-1 text-xs text-muted-foreground">{tw("vyFooter")}</p>
              </div>
            </div>
          )}
          <div className="space-y-2">
            <label htmlFor="instr" className="label-base">{t("instructions")}</label>
            <textarea id="instr" className="input-base min-h-24 py-3" maxLength={500} value={instructions} onChange={(e) => setInstructions(e.target.value)}
              placeholder={t("instructionsPlaceholder")} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setRegenFor(undefined)} className={buttonClass("ghost")}>{tcom("cancel")}</button>
            <button onClick={regenerate} disabled={regenerating} className={buttonClass("brand")}>
              {regenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} {t("generate")}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
