"use client";

import { useEffect, useState } from "react";
import { ImageOff, Loader2, Search, Send } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { buttonClass } from "@/components/app/ui-bits";
import type { PublicationRow } from "./publish-dialog";

interface StoreItem { id: string; title: string; thumbnail: string | null; permalink: string | null; pictureCount: number; maxPictures: number | null }

/** Coloca a imagem do criativo num anúncio/produto de uma loja conectada. */
export function StorePanel({
  creativeId, isImage, stores, onPublished, onClose,
}: {
  creativeId: string;
  isImage: boolean;
  stores: { slug: string; label: string }[];
  onPublished: (p: PublicationRow) => void;
  onClose: () => void;
}) {
  const t = useTranslations("publish.store");
  const [slug, setSlug] = useState(stores[0]?.slug || "");
  const [q, setQ] = useState("");
  const [items, setItems] = useState<StoreItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [picked, setPicked] = useState<StoreItem | null>(null);
  const [asCover, setAsCover] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!slug || !isImage) return;
    const timer = setTimeout(async () => {
      setLoading(true);
      const res = await fetch(`/api/integrations/stores/${slug}?q=${encodeURIComponent(q)}`).catch(() => null);
      const data = await res?.json().catch(() => null);
      setLoading(false);
      if (!res?.ok) {
        setItems([]);
        toast.error(data?.error || t("loadError"));
        return;
      }
      setItems(data);
    }, 300);
    return () => clearTimeout(timer);
  }, [slug, q, isImage, t]);

  if (!isImage) return <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">{t("imagesOnly")}</p>;
  if (stores.length === 0) return <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">{t("noStores")}</p>;

  const publish = async () => {
    if (!picked) return;
    setSending(true);
    const res = await fetch("/api/publications/store", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creativeId, slug, itemId: picked.id, asCover }),
    });
    const data = await res.json().catch(() => ({}));
    setSending(false);
    if (!res.ok) return toast.error(data.error || t("error"));
    toast.success(t("sent", { title: picked.title }));
    onPublished({ ...data, createdAt: data.createdAt || new Date().toISOString() });
    onClose();
  };

  const full = picked && picked.maxPictures !== null && picked.pictureCount >= picked.maxPictures;

  return (
    <div className="space-y-4">
      {stores.length > 1 && (
        <div className="flex gap-1.5">
          {stores.map((s) => (
            <button key={s.slug} type="button" onClick={() => { setSlug(s.slug); setPicked(null); setItems(null); }} data-selected={slug === s.slug} className="choice px-3 py-1.5 text-sm">{s.label}</button>
          ))}
        </div>
      )}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input className="input-base pl-9" placeholder={t("search")} value={q} onChange={(e) => setQ(e.target.value)} aria-label={t("search")} />
      </div>
      <div className="max-h-64 space-y-1.5 overflow-y-auto">
        {loading && !items ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : items && items.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          items?.map((it) => (
            <button key={it.id} type="button" onClick={() => setPicked(it)} data-selected={picked?.id === it.id} className="choice flex w-full items-center gap-3 px-3 py-2 text-left text-sm">
              {it.thumbnail
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={it.thumbnail} alt="" className="h-10 w-10 shrink-0 rounded-lg bg-muted object-cover" />
                : <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted"><ImageOff className="h-4 w-4 text-muted-foreground" /></span>}
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{it.title}</span>
                <span className="text-xs text-muted-foreground">{t("photos", { count: it.pictureCount })}</span>
              </span>
            </button>
          ))
        )}
      </div>
      {picked && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={asCover} onChange={(e) => setAsCover(e.target.checked)} /> {t("asCover")}
        </label>
      )}
      {full && <p className="text-xs text-destructive">{t("full")}</p>}
      <div className="flex justify-end gap-2">
        <button onClick={onClose} className={buttonClass("ghost")}>{t("cancel")}</button>
        <button onClick={publish} disabled={!picked || sending || !!full} className={buttonClass("brand")}>
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {t("submit")}
        </button>
      </div>
    </div>
  );
}
