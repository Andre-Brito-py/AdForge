"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Copy, Download, Loader2, MessageCircle, RefreshCw, Send, Sparkles, Volume2, Lightbulb } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader, StatusBadge, buttonClass } from "@/components/app/ui-bits";
import { DeleteButton } from "@/components/app/delete-button";
import { OBJECTIVES, PLATFORMS, STYLES, labelFor } from "@/lib/catalog";
import { timeAgo } from "@/lib/format";
import { setMascotMood } from "@/components/mascot/mascot-events";
import { PublicationList, PublishDialog, type PublicationRow, type PublishingInfo } from "./publish-dialog";

interface Creative {
  id: string; type: string; status: string; variantIndex: number; outputUrl: string | null; audioUrl: string | null;
  headline: string | null; text: string | null; cta: string | null; aspectRatio: string | null; creditsUsed: number;
}
interface Campaign {
  id: string; name: string; status: string; createdAt: string; objective: string; platform: string | null; style: string | null; quality: string;
  product: { id: string; name: string; originalImageUrl: string };
  creatives: Creative[];
}

const RATIO_CLASS: Record<string, string> = { "1:1": "aspect-square", "4:5": "aspect-[4/5]", "9:16": "aspect-[9/16]", "16:9": "aspect-video" };

function copyText(c: Creative | undefined) {
  if (!c) return "";
  return [c.headline, c.text, c.cta].filter(Boolean).join("\n\n");
}

export default function CreativeGalleryClient({
  campaign, strategy, unitCost, emailVerified, publishing, initialPublications,
}: {
  campaign: Campaign;
  strategy: { analysis: string; hooks: string[] } | null;
  unitCost: number | null;
  emailVerified: boolean;
  publishing: PublishingInfo;
  initialPublications: PublicationRow[];
}) {
  const router = useRouter();
  const [regenFor, setRegenFor] = useState<Creative | null | undefined>(undefined);
  const [instructions, setInstructions] = useState("");
  const [regenerating, setRegenerating] = useState(false);
  const [publishFor, setPublishFor] = useState<{ visual: Creative; copy?: Creative } | null>(null);
  const [publications, setPublications] = useState<PublicationRow[]>(initialPublications);
  const publishingNow = publications.some((p) => p.status === "PENDING" || p.status === "PROCESSING");

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

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    toast.success("Texto copiado");
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
    if (!res.ok) return toast.error(data.error || "Não foi possível gerar a nova versão");
    toast.success("Nova variação em geração. Ela aparece aqui em instantes.");
    setMascotMood("working", 8000);
    setRegenFor(undefined);
    setInstructions("");
    router.refresh();
  };

  return (
    <>
      <PageHeader
        back={{ href: "/campaigns", label: "Campanhas" }}
        title={campaign.name}
        description={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <StatusBadge status={pending ? "GENERATING" : campaign.status} />
            <span>{labelFor(OBJECTIVES, campaign.objective)} · {labelFor(PLATFORMS, campaign.platform)} · {labelFor(STYLES, campaign.style)} · criada {timeAgo(campaign.createdAt)}</span>
          </span>
        }
        actions={
          <>
            {!pending && (
              <DeleteButton endpoint={`/api/campaigns/${campaign.id}`} redirectTo="/campaigns" confirmText="Excluir esta campanha e todos os criativos? Esta ação não pode ser desfeita." />
            )}
            {unitCost !== null && (
              <button onClick={() => setRegenFor(null)} disabled={!emailVerified} className={buttonClass("brand")}>
                <Sparkles className="h-4 w-4" /> Nova variação
              </button>
            )}
          </>
        }
      />

      {failedCount > 0 && !pending && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-warning/30 bg-warning/10 p-4 text-sm">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <p>
            {failedCount === 1 ? "1 variação não pôde ser gerada" : `${failedCount} variações não puderam ser geradas`}. Os créditos correspondentes já voltaram para o seu saldo.
          </p>
        </div>
      )}

      {strategy && (strategy.analysis || strategy.hooks.length > 0) && (
        <details className="surface group mb-6 p-5">
          <summary className="flex cursor-pointer list-none items-center gap-2 font-medium">
            <Lightbulb className="h-4 w-4 text-brand" /> Estratégia criada pela IA
            <span className="ml-auto text-xs text-muted-foreground group-open:hidden">Mostrar</span>
          </summary>
          {strategy.analysis && <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{strategy.analysis}</p>}
          {strategy.hooks.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {strategy.hooks.map((h, i) => (
                <button key={i} onClick={() => copy(h)} className="rounded-full bg-muted px-3 py-1.5 text-left text-xs hover:bg-accent" title="Copiar gancho">
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
                    <video src={visual.outputUrl} controls playsInline preload="metadata" className="h-full w-full object-cover" />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={visual.outputUrl} alt={c?.headline || `Variação ${i + 1}`} className="h-full w-full object-cover" />
                  )
                ) : visual.status === "FAILED" ? (
                  <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted-foreground">
                    <AlertCircle className="h-6 w-6 text-destructive" />
                    Não foi possível gerar esta variação.<br />Os {visual.creditsUsed} créditos foram estornados.
                  </div>
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin text-brand" />
                    {visual.status === "QUEUED" ? "Na fila..." : visual.type === "VIDEO" ? "Gerando vídeo..." : "Gerando imagem..."}
                  </div>
                )}
                <span className="absolute left-3 top-3 rounded-full bg-background/90 px-2 py-0.5 text-xs font-medium backdrop-blur">#{i + 1}</span>
              </div>

              {visual.audioUrl && (
                <div className="flex items-center gap-2 border-t border-border px-4 py-2">
                  <Volume2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <audio src={visual.audioUrl} controls preload="none" className="h-8 w-full" />
                </div>
              )}

              {c && (
                <div className="flex-1 space-y-2 border-t border-border p-4">
                  {c.headline && <p className="font-semibold leading-snug">{c.headline}</p>}
                  {c.text && <p className="whitespace-pre-line text-sm text-muted-foreground">{c.text}</p>}
                  {c.cta && <p className="text-xs font-medium uppercase tracking-wide text-brand">{c.cta}</p>}
                </div>
              )}

              <PublicationList items={publications.filter((p) => p.creativeId === visual.id)} />

              <div className="flex flex-wrap gap-1.5 border-t border-border p-3">
                {visual.status === "COMPLETED" && visual.outputUrl && (
                  <button onClick={() => setPublishFor({ visual, copy: c })} className={buttonClass("brand", "sm")}>
                    <Send className="h-3.5 w-3.5" /> Publicar
                  </button>
                )}
                {visual.status === "COMPLETED" && visual.outputUrl && (
                  <button onClick={() => download(visual.outputUrl!, `vysify-${campaign.id.slice(0, 6)}-${i + 1}.${ext}`)} className={buttonClass("outline", "sm")}>
                    <Download className="h-3.5 w-3.5" /> Baixar
                  </button>
                )}
                {c && (
                  <button onClick={() => copy(copyText(c))} className={buttonClass("outline", "sm")}>
                    <Copy className="h-3.5 w-3.5" /> Copiar texto
                  </button>
                )}
                {c && (
                  <a href={`https://wa.me/?text=${encodeURIComponent(copyText(c))}`} target="_blank" rel="noopener noreferrer" className={buttonClass("ghost", "sm")}>
                    <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                  </a>
                )}
                {unitCost !== null && visual.status !== "QUEUED" && visual.status !== "PROCESSING" && (
                  <button onClick={() => setRegenFor(visual)} disabled={!emailVerified} className={`${buttonClass("ghost", "sm")} ml-auto`}>
                    <RefreshCw className="h-3.5 w-3.5" /> Nova versão
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>

      <PublishDialog
        key={publishFor?.visual.id || "none"}
        open={!!publishFor}
        onClose={() => setPublishFor(null)}
        creative={publishFor ? { id: publishFor.visual.id, type: publishFor.visual.type, aspectRatio: publishFor.visual.aspectRatio } : null}
        defaultCaption={copyText(publishFor?.copy)}
        info={publishing}
        onPublished={(p) => setPublications((list) => [p, ...list])}
      />

      <Dialog open={regenFor !== undefined} onOpenChange={(open) => !open && setRegenFor(undefined)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{regenFor ? "Nova versão deste criativo" : "Nova variação"}</DialogTitle>
            <DialogDescription>
              Gera mais um criativo nesta campanha por <strong>{unitCost} créditos</strong>. Se falhar, os créditos voltam automaticamente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label htmlFor="instr" className="label-base">Instruções extras (opcional)</label>
            <textarea id="instr" className="input-base min-h-24 py-3" maxLength={500} value={instructions} onChange={(e) => setInstructions(e.target.value)}
              placeholder="Ex.: fundo de mármore claro, luz de fim de tarde, produto em close" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setRegenFor(undefined)} className={buttonClass("ghost")}>Cancelar</button>
            <button onClick={regenerate} disabled={regenerating} className={buttonClass("brand")}>
              {regenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Gerar
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
