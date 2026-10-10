"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Link2, Loader2, Star, X } from "lucide-react";
import { toast } from "sonner";
import { useLocale, useTranslations } from "next-intl";
import { setMascotMood } from "@/components/mascot/mascot-events";
import { PageHeader, buttonClass } from "@/components/app/ui-bits";
import { ImageDropzone, uploadImage } from "@/components/app/image-dropzone";

interface Imported {
  imageUrl: string | null;
  sourceUrl: string;
  source: "mercadolivre" | "shopify" | "page";
  currency: string | null;
  rating: { value: number; count: number } | null;
  reviews: { rating: number | null; text: string }[];
}

const SOURCE_LABEL: Record<Imported["source"], string> = { mercadolivre: "Mercado Livre", shopify: "Shopify", page: "" };

export default function NewProductPage() {
  const t = useTranslations("products.new");
  const tn = useTranslations("nav");
  const tc = useTranslations("common");
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState({ name: "", description: "", category: "", brandName: "", targetAudience: "", price: "" });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value });
  const locale = useLocale();
  const [link, setLink] = useState("");
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState<Imported | null>(null);

  // Lê o produto do link da loja e preenche o formulário (o cliente confere antes de salvar).
  const runImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!link.trim()) return;
    setImporting(true);
    setMascotMood("working");
    try {
      const res = await fetch("/api/products/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: link.trim() }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t("importError"));
      const price = typeof data.price === "number" ? (locale === "pt" ? data.price.toFixed(2).replace(".", ",") : data.price.toFixed(2)) : "";
      setForm((f) => ({
        ...f,
        name: data.name || f.name,
        description: data.description || f.description,
        category: data.category || f.category,
        brandName: data.brand || f.brandName,
        price: price || f.price,
      }));
      setFile(null);
      setImported({ imageUrl: data.imageUrl, sourceUrl: data.url, source: data.source, currency: data.currency, rating: data.rating, reviews: data.reviews || [] });
      setMascotMood("happy", 3000);
      toast.success(t("imported"));
    } catch (err) {
      setMascotMood("confused", 4000);
      toast.error(err instanceof Error ? err.message : t("importError"));
    } finally {
      setImporting(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file && !imported?.imageUrl) return toast.error(t("photoRequired"));
    if (!form.name.trim()) return toast.error(t("nameRequired"));

    setLoading(true);
    try {
      const imageUrl = file ? await uploadImage(file) : imported!.imageUrl!;
      // Aceita "29.90" e "29,90".
      const price = form.price ? Number(form.price.replace(/\s/g, "").replace(/,(\d{1,2})$/, ".$1").replace(/,/g, "")) : null;
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form, price: Number.isFinite(price) ? price : null, imageUrl,
          ...(imported && {
            sourceUrl: imported.sourceUrl,
            ...(["BRL", "USD", "EUR"].includes(imported.currency || "") && { currency: imported.currency }),
            reviews: { rating: imported.rating, items: imported.reviews },
          }),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t("error"));
      toast.success(t("created"));
      router.push(`/products/${data.id}`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tc("somethingWrong"));
      setLoading(false);
    }
  };

  return (
    <>
      <PageHeader back={{ href: "/products", label: tn("products") }} title={t("title")} description={t("subtitle")} />

      <section className="surface mb-6 p-5 sm:p-6">
        <h2 className="flex items-center gap-2 font-semibold"><Link2 className="h-4 w-4 text-brand" /> {t("importTitle")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("importHint")}</p>
        <form onSubmit={runImport} className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input type="url" inputMode="url" className="input-base flex-1" value={link} onChange={(e) => setLink(e.target.value)} placeholder={t("importPlaceholder")} aria-label={t("importTitle")} />
          <button type="submit" disabled={importing || !link.trim()} className={buttonClass("brand")}>
            {importing && <Loader2 className="h-4 w-4 animate-spin" />} {importing ? t("importing") : t("importButton")}
          </button>
        </form>
        {imported && (
          <div className="mt-4 rounded-xl bg-muted/50 p-4 text-sm">
            <p className="font-medium">
              {SOURCE_LABEL[imported.source] ? t("importedFrom", { source: SOURCE_LABEL[imported.source] }) : t("importedPage")}
              {imported.rating && (
                <span className="ml-2 inline-flex items-center gap-1 text-muted-foreground">
                  <Star className="h-3.5 w-3.5 fill-current text-warning" /> {t("importRating", { value: imported.rating.value, count: imported.rating.count })}
                </span>
              )}
            </p>
            {imported.reviews.length > 0 ? (
              <>
                <p className="mt-2 text-muted-foreground">{t("importReviews", { count: imported.reviews.length })}</p>
                <ul className="mt-2 space-y-1.5">
                  {imported.reviews.slice(0, 3).map((r, i) => (
                    <li key={i} className="line-clamp-2 text-muted-foreground">“{r.text}”{r.rating !== null && <span className="ml-1 text-xs">({r.rating}/5)</span>}</li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="mt-2 text-muted-foreground">{imported.rating ? t("importRatingOnly") : t("importNoReviews")}</p>
            )}
          </div>
        )}
      </section>

      <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="space-y-3">
          <span className="label-base">{t("photo")}</span>
          {imported?.imageUrl && !file ? (
            <div className="relative overflow-hidden rounded-2xl border border-border bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imported.imageUrl} alt="" className="aspect-square w-full object-contain" />
              <button type="button" onClick={() => setImported({ ...imported, imageUrl: null })}
                className={`${buttonClass("outline", "sm")} absolute right-3 top-3 bg-background/90 backdrop-blur`}>
                <X className="h-3.5 w-3.5" /> {t("changePhoto")}
              </button>
            </div>
          ) : (
            <ImageDropzone file={file} onChange={(f, err) => { if (err) toast.error(err); setFile(f); }} />
          )}
          <p className="text-xs text-muted-foreground">{t("photoTip")}</p>
        </div>

        <div className="surface space-y-5 p-5 sm:p-6">
          <div className="space-y-2">
            <label htmlFor="name" className="label-base">{t("name")}</label>
            <input id="name" className="input-base" value={form.name} onChange={set("name")} maxLength={120} placeholder={t("namePlaceholder")} required />
          </div>
          <div className="space-y-2">
            <label htmlFor="description" className="label-base">{t("description")}</label>
            <textarea id="description" className="input-base min-h-28 py-3" value={form.description} onChange={set("description")} maxLength={2000} placeholder={t("descriptionPlaceholder")} />
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="category" className="label-base">{t("category")}</label>
              <input id="category" className="input-base" value={form.category} onChange={set("category")} maxLength={80} placeholder={t("categoryPlaceholder")} />
            </div>
            <div className="space-y-2">
              <label htmlFor="brand" className="label-base">{t("brand")}</label>
              <input id="brand" className="input-base" value={form.brandName} onChange={set("brandName")} maxLength={80} placeholder={t("brandPlaceholder")} />
            </div>
            <div className="space-y-2">
              <label htmlFor="audience" className="label-base">{t("audience")}</label>
              <input id="audience" className="input-base" value={form.targetAudience} onChange={set("targetAudience")} maxLength={300} placeholder={t("audiencePlaceholder")} />
            </div>
            <div className="space-y-2">
              <label htmlFor="price" className="label-base">{t("price")}</label>
              <input id="price" className="input-base" inputMode="decimal" value={form.price} onChange={set("price")} placeholder={t("pricePlaceholder")} />
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <button type="submit" disabled={loading} className={buttonClass("brand", "lg")}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? tc("saving") : t("submit")}
            </button>
          </div>
        </div>
      </form>
    </>
  );
}
