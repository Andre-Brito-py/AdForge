"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { PageHeader, buttonClass } from "@/components/app/ui-bits";
import { ImageDropzone, uploadImage } from "@/components/app/image-dropzone";

export default function NewProductPage() {
  const t = useTranslations("products.new");
  const tn = useTranslations("nav");
  const tc = useTranslations("common");
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState({ name: "", description: "", category: "", brandName: "", targetAudience: "", price: "" });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return toast.error(t("photoRequired"));
    if (!form.name.trim()) return toast.error(t("nameRequired"));

    setLoading(true);
    try {
      const imageUrl = await uploadImage(file);
      // Aceita "29.90" e "29,90".
      const price = form.price ? Number(form.price.replace(/\s/g, "").replace(/,(\d{1,2})$/, ".$1").replace(/,/g, "")) : null;
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, price: Number.isFinite(price) ? price : null, imageUrl }),
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

      <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="space-y-3">
          <span className="label-base">{t("photo")}</span>
          <ImageDropzone file={file} onChange={(f, err) => { if (err) toast.error(err); setFile(f); }} />
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
