"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, ExternalLink, Loader2, Send, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { buttonClass } from "@/components/app/ui-bits";
import { FacebookIcon, InstagramIcon } from "@/components/brand-icons";
import { IG_CAPTION_LIMIT, PUBLISH_TARGETS, allowedTargets, type PublishTarget } from "@/lib/publish-targets";

export interface PublishingInfo {
  available: boolean;
  connected: boolean;
  expired: boolean;
  instagram: { id: string; name: string }[];
  pages: { id: string; name: string }[];
}

export interface PublicationRow {
  id: string;
  creativeId: string;
  target: string;
  accountName: string | null;
  status: string;
  permalink: string | null;
  error: string | null;
  createdAt: string;
}

interface Destination { key: string; target: PublishTarget; accountId: string; label: string; network: "instagram" | "facebook" }

export function PublishDialog({
  open, onClose, creative, defaultCaption, info, onPublished,
}: {
  open: boolean;
  onClose: () => void;
  creative: { id: string; type: string; aspectRatio: string | null } | null;
  defaultCaption: string;
  info: PublishingInfo;
  onPublished: (p: PublicationRow) => void;
}) {
  const t = useTranslations("publish");
  const tc = useTranslations("common");
  const destinations = useMemo<Destination[]>(() => {
    if (!creative) return [];
    return allowedTargets(creative.type, creative.aspectRatio).flatMap((target) => {
      const network = PUBLISH_TARGETS[target].network;
      const accounts = network === "instagram" ? info.instagram : info.pages;
      return accounts.map((a) => ({ key: `${target}:${a.id}`, target, accountId: a.id, network, label: `${t(`targets.${target}`)} · ${a.name}` }));
    });
  }, [creative, info, t]);

  const [selected, setSelected] = useState<string>("");
  const [caption, setCaption] = useState(defaultCaption);
  const [sending, setSending] = useState(false);
  const dest = destinations.find((d) => d.key === selected) || destinations[0];
  const isStory = dest?.target === "INSTAGRAM_STORY";

  const publish = async () => {
    if (!creative || !dest) return;
    setSending(true);
    const res = await fetch("/api/publications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creativeId: creative.id, target: dest.target, accountId: dest.accountId, caption: isStory ? null : caption }),
    });
    const data = await res.json().catch(() => ({}));
    setSending(false);
    if (!res.ok) return toast.error(data.error || t("error"));
    toast.success(creative.type === "VIDEO" ? t("sentVideo") : t("sent"));
    onPublished({ ...data, createdAt: data.createdAt || new Date().toISOString() });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        {!info.available ? (
          <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">{t("unavailable")}</p>
        ) : !info.connected ? (
          <div className="space-y-3 rounded-xl bg-muted p-4 text-sm">
            <p>{info.expired ? t("expired") : t("connectPrompt")}</p>
            <Link href="/integrations" className={buttonClass("brand", "sm")}>{info.expired ? t("reconnect") : t("connect")}</Link>
          </div>
        ) : destinations.length === 0 ? (
          <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">
            {t.rich("noAccounts", { link: (chunks) => <Link href="/integrations" className="underline">{chunks}</Link> })}
          </p>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <span className="label-base">{t("where")}</span>
              <div className="max-h-56 space-y-1.5 overflow-y-auto">
                {destinations.map((d) => (
                  <button key={d.key} type="button" onClick={() => setSelected(d.key)} data-selected={dest?.key === d.key} className="choice flex w-full items-center gap-3 px-3 py-2.5 text-sm">
                    {d.network === "instagram" ? <InstagramIcon className="h-4 w-4 text-pink-500" /> : <FacebookIcon className="h-4 w-4 text-[#1877F2]" />}
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
            {isStory ? (
              <p className="rounded-xl bg-muted p-3 text-xs text-muted-foreground">{t("storyNoCaption")}</p>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="caption" className="label-base">{t("caption")}</label>
                  <span className={`text-xs tabular-nums ${caption.length > IG_CAPTION_LIMIT ? "text-destructive" : "text-muted-foreground"}`}>{caption.length}/{IG_CAPTION_LIMIT}</span>
                </div>
                <textarea id="caption" className="input-base min-h-36 py-3" value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={IG_CAPTION_LIMIT} />
              </div>
            )}
            <p className="text-xs text-muted-foreground">{t("responsibility")}</p>
            <div className="flex justify-end gap-2">
              <button onClick={onClose} className={buttonClass("ghost")}>{tc("cancel")}</button>
              <button onClick={publish} disabled={sending || caption.length > IG_CAPTION_LIMIT} className={buttonClass("brand")}>
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {t("submit")}
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function PublicationList({ items }: { items: PublicationRow[] }) {
  const t = useTranslations("publish");
  if (items.length === 0) return null;
  return (
    <ul className="space-y-1.5 border-t border-border px-4 py-3 text-xs">
      {items.map((p) => (
        <li key={p.id} className="flex items-start gap-2">
          {p.status === "PUBLISHED" ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
            : p.status === "FAILED" ? <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
            : <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin text-brand" />}
          <div className="min-w-0 flex-1">
            <p className="break-words">
              {t.has(`targets.${p.target}`) ? t(`targets.${p.target}`) : p.target} · {p.accountName}
              {p.status === "PUBLISHED" && p.permalink && (
                <a href={p.permalink} target="_blank" rel="noopener noreferrer" className="ml-1.5 inline-flex items-center gap-0.5 font-medium text-brand hover:underline">
                  {t("viewPost")} <ExternalLink className="h-3 w-3" />
                </a>
              )}
              {(p.status === "PENDING" || p.status === "PROCESSING") && <span className="ml-1.5 text-muted-foreground">{t("publishing")}</span>}
            </p>
            {p.status === "FAILED" && p.error && <p className="text-destructive">{p.error}</p>}
          </div>
        </li>
      ))}
    </ul>
  );
}
