"use client";

import { useState } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { buttonClass } from "@/components/app/ui-bits";
import { ImageDropzone, uploadImage } from "@/components/app/image-dropzone";

interface Brand { brandName: string; primaryColor: string; tone: string; website: string; logoUrl: string }

export function BrandForm({ initial }: { initial: Brand }) {
  const t = useTranslations("brand");
  const tc = useTranslations("common");
  const [brand, setBrand] = useState(initial);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof Brand) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setBrand({ ...brand, [k]: e.target.value });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const logoUrl = logoFile ? await uploadImage(logoFile) : brand.logoUrl;
      const res = await fetch("/api/brand", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...brand, logoUrl: logoUrl || null, primaryColor: /^#[0-9a-f]{6}$/i.test(brand.primaryColor) ? brand.primaryColor : null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t("error"));
      setBrand({ ...brand, logoUrl: logoUrl || "" });
      setLogoFile(null);
      toast.success(t("saved"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("error"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
      <div className="surface space-y-3 p-5">
        <span className="label-base">{t("logo")}</span>
        {brand.logoUrl && !logoFile ? (
          <div className="flex aspect-[4/3] items-center justify-center rounded-2xl bg-muted p-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={brand.logoUrl} alt={t("currentLogo")} className="max-h-full max-w-full object-contain" />
          </div>
        ) : null}
        <ImageDropzone file={logoFile} onChange={(f, err) => { if (err) toast.error(err); setLogoFile(f); }} label={brand.logoUrl ? t("changeLogo") : t("uploadLogo")} aspect="aspect-[4/2]" />
        <p className="text-xs text-muted-foreground">{t("logoHint")}</p>
      </div>

      <div className="surface space-y-5 p-5 sm:p-6">
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="bn" className="label-base">{t("name")}</label>
            <input id="bn" className="input-base" maxLength={80} value={brand.brandName} onChange={set("brandName")} placeholder="Ex.: Termix" />
            <p className="text-xs text-muted-foreground">{t("nameHint")}</p>
          </div>
          <div className="space-y-2">
            <label htmlFor="color" className="label-base">{t("color")}</label>
            <div className="flex gap-2">
              <input type="color" aria-label={t("pickColor")} value={/^#[0-9a-f]{6}$/i.test(brand.primaryColor) ? brand.primaryColor : "#7c3aed"} onChange={set("primaryColor")} className="h-11 w-14 cursor-pointer rounded-xl border border-input bg-background p-1" />
              <input id="color" className="input-base font-mono uppercase" maxLength={7} value={brand.primaryColor} onChange={set("primaryColor")} />
            </div>
            <p className="text-xs text-muted-foreground">{t("colorHint")}</p>
          </div>
        </div>
        <div className="space-y-2">
          <label htmlFor="tone" className="label-base">{t("tone")}</label>
          <textarea id="tone" className="input-base min-h-28 py-3" maxLength={1000} value={brand.tone} onChange={set("tone")}
            placeholder={t("tonePlaceholder")} />
          <p className="text-xs text-muted-foreground">{t("toneHint")}</p>
        </div>
        <div className="space-y-2">
          <label htmlFor="site" className="label-base">{t("website")}</label>
          <input id="site" type="url" className="input-base" maxLength={300} value={brand.website} onChange={set("website")} placeholder="https://" />
          <p className="text-xs text-muted-foreground">{t("websiteHint")}</p>
        </div>
        <div className="flex justify-end pt-2">
          <button type="submit" disabled={saving} className={buttonClass("brand", "lg")}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {tc("save")}
          </button>
        </div>
      </div>
    </form>
  );
}
