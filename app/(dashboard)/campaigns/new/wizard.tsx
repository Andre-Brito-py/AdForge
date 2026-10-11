"use client";

import { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Captions, Check, Globe, Image as ImageIcon, Loader2, Megaphone, Plus, Sparkles, Video, X } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import {
  MAX_REFERENCES, OBJECTIVES, PLATFORMS, QUALITIES, STYLES, VARIATION_OPTIONS, campaignCost, costPerVariation, resolveMedia, snapDuration,
  type AiCosts, type MediaKind, type ObjectiveKey, type PlatformKey, type QualityKey, type StyleKey,
} from "@/lib/catalog";
import { AD_LANGUAGES, type AdLanguage } from "@/lib/locale";
import { buttonClass } from "@/components/app/ui-bits";
import { setMascotMood } from "@/components/mascot/mascot-events";
import { PixelMascot } from "@/components/mascot/PixelMascot";
import { UploadError, uploadImage } from "@/components/app/image-dropzone";

interface Product { id: string; name: string; originalImageUrl: string; targetAudience: string | null; price: number | null }

export function CampaignWizard({
  products, initialProductId, balance, costs, availability, emailVerified, locale, logoUrl, videoDurations,
}: {
  /** Durações que o modelo de vídeo de cada qualidade gera sem desperdício (Veo: 8, 15, 22, 29 s). */
  videoDurations: Record<QualityKey, number[]>;
  logoUrl: string | null;
  products: Product[];
  initialProductId: string;
  balance: number;
  costs: AiCosts;
  availability: { IMAGE: boolean; VIDEO: boolean };
  emailVerified: boolean;
  locale: "pt" | "en";
}) {
  const t = useTranslations("campaigns.wizard");
  const tc = useTranslations("common");
  const tcat = useTranslations("catalog");
  const router = useRouter();
  const steps = t.raw("steps") as string[];
  const [step, setStep] = useState(initialProductId ? 1 : 0);
  const [loading, setLoading] = useState(false);
  const [productId, setProductId] = useState(initialProductId);
  const [objective, setObjective] = useState<ObjectiveKey | "">("");
  const [targetAudience, setTargetAudience] = useState("");
  const [offer, setOffer] = useState("");
  const [platform, setPlatform] = useState<PlatformKey | "">("");
  const [style, setStyle] = useState<StyleKey | "">("");
  const [quality, setQuality] = useState<QualityKey>("standard");
  const [variations, setVariations] = useState<number>(3);
  const [language, setLanguage] = useState<AdLanguage | "auto">("auto");
  const [briefing, setBriefing] = useState("");
  const [chosenDuration, setDuration] = useState<number>(videoDurations.standard[0]);
  const [mediaChoice, setMediaChoice] = useState<MediaKind | null>(null);
  const [applyLogo, setApplyLogo] = useState(!!logoUrl);
  const [captions, setCaptions] = useState(true);
  const [endCard, setEndCard] = useState(true);
  const [references, setReferences] = useState<string[]>([]);
  const [uploadingRef, setUploadingRef] = useState(false);
  const [imageRights, setImageRights] = useState(false);
  const refInput = useRef<HTMLInputElement>(null);
  // Recusa da IA (fora do escopo, contra as regras ou imagem proibida): o Vy explica.
  const [vyNotice, setVyNotice] = useState<{ kind: "OUT_OF_SCOPE" | "POLICY_VIOLATION" | "IMAGE_BLOCKED"; message: string } | null>(null);

  const addReference = async (file: File | undefined) => {
    if (!file) return;
    setUploadingRef(true);
    try {
      const url = await uploadImage(file);
      setReferences((r) => [...r, url].slice(0, MAX_REFERENCES));
    } catch (err) {
      if (err instanceof UploadError && err.code === "IMAGE_BLOCKED") {
        setMascotMood("confused", 6000);
        setVyNotice({ kind: "IMAGE_BLOCKED", message: err.message });
      } else {
        toast.error(err instanceof Error ? err.message : t("error"));
      }
    } finally {
      setUploadingRef(false);
      if (refInput.current) refInput.current.value = "";
    }
  };

  const product = products.find((p) => p.id === productId);
  // Imagem ou vídeo: Feed, Facebook e Stories aceitam os dois; Reels/TikTok é sempre vídeo.
  const media: MediaKind | null = platform ? resolveMedia(platform, mediaChoice) : null;
  const isVideo = media === "VIDEO";
  // Trocar a qualidade pode trocar o modelo (e as durações): fica na mais próxima da escolhida.
  const duration = snapDuration(chosenDuration, videoDurations[quality]);
  const total = platform ? campaignCost(costs, platform, quality, variations, isVideo ? duration : null, media) : 0;
  const enough = balance >= total;

  const canNext = useMemo(
    () => [!!productId, !!objective && !uploadingRef && (references.length === 0 || imageRights), !!platform && !!style, true][step],
    [step, productId, objective, platform, style, uploadingRef, references.length, imageRights]
  );

  const submit = async () => {
    if (!platform || !objective || !style) return;
    setLoading(true);
    setMascotMood("working");
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId, objective, targetAudience: targetAudience || null, offer: offer || null, platform, style, quality, variations, language,
          briefing: briefing.trim() || null, videoDuration: isVideo ? duration : 5, applyLogo: !!logoUrl && applyLogo,
          captions: isVideo && captions, endCard: isVideo && endCard,
          references, imageRights: references.length > 0 && imageRights, media,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok && (data.code === "OUT_OF_SCOPE" || data.code === "POLICY_VIOLATION")) {
        setMascotMood("confused", 6000);
        setVyNotice({ kind: data.code, message: data.error });
        setLoading(false);
        return;
      }
      if (!res.ok) throw new Error(data.error || t("error"));
      router.push(`/campaigns/${data.id}/generating`);
    } catch (err) {
      setMascotMood("confused", 4000);
      toast.error(err instanceof Error ? err.message : t("error"));
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <ol className="mb-6 grid grid-cols-4 gap-2" aria-label={t("stepsLabel")}>
        {steps.map((label, i) => (
          <li key={label}>
            <button type="button" disabled={i > step} onClick={() => setStep(i)} className="w-full text-left disabled:cursor-default" aria-current={i === step ? "step" : undefined}>
              <span className={`block h-1 rounded-full transition-colors ${i <= step ? "bg-brand" : "bg-border"}`} />
              <span className={`mt-2 block text-xs font-medium ${i === step ? "text-foreground" : "text-muted-foreground"}`}>
                {i + 1}. {label}
              </span>
            </button>
          </li>
        ))}
      </ol>

      <div className="surface min-h-[420px] p-5 sm:p-8">
        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.18 }}>
            {step === 0 && (
              <Section title={t("productTitle")}>
                {products.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border p-8 text-center">
                    <p className="text-sm text-muted-foreground">{t("noProducts")}</p>
                    <Link href="/products/new" className={`${buttonClass("brand")} mt-4`}>
                      <Plus className="h-4 w-4" /> {t("addProduct")}
                    </Link>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {products.map((p) => (
                      <button key={p.id} type="button" onClick={() => setProductId(p.id)} data-selected={productId === p.id} className="choice p-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p.originalImageUrl} alt="" className="aspect-[4/3] w-full rounded-xl bg-muted object-cover" />
                        <span className="mt-2 block truncate px-1 text-sm font-medium">{p.name}</span>
                      </button>
                    ))}
                    <Link href="/products/new" className="choice flex flex-col items-center justify-center gap-2 border-dashed text-sm text-muted-foreground">
                      <Plus className="h-5 w-5" /> {t("newProduct")}
                    </Link>
                  </div>
                )}
              </Section>
            )}

            {step === 1 && (
              <Section title={t("objectiveTitle")} subtitle={t("objectiveSub")}>
                <div className="mb-6 space-y-2">
                  <label htmlFor="briefing" className="label-base">{t("briefing")}</label>
                  <textarea id="briefing" className="input-base min-h-28 py-3" maxLength={1000} value={briefing} onChange={(e) => setBriefing(e.target.value)}
                    placeholder={t("briefingPlaceholder")} />
                  <p className="text-xs text-muted-foreground">{t("briefingHint")}</p>
                </div>

                <div className="mb-6 space-y-2">
                  <span className="label-base">{t("references")}</span>
                  <p className="text-xs text-muted-foreground">{t("referencesHint")}</p>
                  <div className="flex flex-wrap gap-3 pt-1">
                    {product && (
                      <figure className="w-24">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={product.originalImageUrl} alt="" className="aspect-square w-24 rounded-xl border border-border bg-muted object-cover" />
                        <figcaption className="mt-1 text-center text-[11px] text-muted-foreground">{t("referenceProduct")}</figcaption>
                      </figure>
                    )}
                    {references.map((url, i) => (
                      <figure key={url} className="relative w-24">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt="" className="aspect-square w-24 rounded-xl border border-border bg-muted object-cover" />
                        <button type="button" onClick={() => setReferences((r) => r.filter((u) => u !== url))} aria-label={t("referenceRemove", { n: i + 2 })}
                          className="absolute right-1 top-1 rounded-full bg-background/90 p-1 text-muted-foreground shadow hover:text-foreground">
                          <X className="h-3 w-3" />
                        </button>
                        <figcaption className="mt-1 text-center text-[11px] font-medium">{t("referenceN", { n: i + 2 })}</figcaption>
                      </figure>
                    ))}
                    {references.length < MAX_REFERENCES && (
                      <button type="button" onClick={() => refInput.current?.click()} disabled={uploadingRef}
                        className="flex aspect-square w-24 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border text-xs text-muted-foreground hover:border-brand hover:text-foreground disabled:opacity-60">
                        {uploadingRef ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
                        {uploadingRef ? t("referenceUploading") : t("referenceAdd")}
                      </button>
                    )}
                    <input ref={refInput} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => addReference(e.target.files?.[0])} />
                  </div>
                  {references.length > 0 && (
                    <label className="mt-2 flex cursor-pointer items-start gap-2 text-sm">
                      <input type="checkbox" checked={imageRights} onChange={(e) => setImageRights(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--brand)]" />
                      <span>{t("imageRights")}</span>
                    </label>
                  )}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {(Object.keys(OBJECTIVES) as ObjectiveKey[]).map((key) => (
                    <button key={key} type="button" onClick={() => setObjective(key)} data-selected={objective === key} className="choice">
                      <span className="block font-medium">{tcat(`objectives.${key}.label`)}</span>
                      <span className="mt-0.5 block text-sm text-muted-foreground">{tcat(`objectives.${key}.description`)}</span>
                    </button>
                  ))}
                </div>
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label htmlFor="aud" className="label-base">{t("audience")}</label>
                    <textarea id="aud" className="input-base min-h-24 py-3" maxLength={300} value={targetAudience} onChange={(e) => setTargetAudience(e.target.value)}
                      placeholder={product?.targetAudience || t("audiencePlaceholder")} />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="offer" className="label-base">{t("offer")}</label>
                    <textarea id="offer" className="input-base min-h-24 py-3" maxLength={500} value={offer} onChange={(e) => setOffer(e.target.value)} placeholder={t("offerPlaceholder")} />
                  </div>
                </div>
              </Section>
            )}

            {step === 2 && (
              <Section title={t("formatTitle")}>
                <div className="grid gap-3 sm:grid-cols-2">
                  {(Object.keys(PLATFORMS) as PlatformKey[]).map((key) => {
                    const p = PLATFORMS[key];
                    const available = (p.mediaOptions as readonly MediaKind[]).some((m) => availability[m]);
                    return (
                      <button key={key} type="button" disabled={!available} data-selected={platform === key}
                        onClick={() => { setPlatform(key); setMediaChoice(availability[p.media] ? p.media : (p.mediaOptions as readonly MediaKind[]).find((m) => availability[m]) || p.media); }}
                        className="choice flex items-start gap-3 disabled:cursor-not-allowed disabled:opacity-50">
                        {p.mediaOptions.length > 1 ? (
                          <span className="mt-0.5 flex shrink-0 gap-0.5"><ImageIcon className="h-5 w-5 text-brand" /><Video className="h-5 w-5 text-brand" /></span>
                        ) : p.media === "VIDEO" ? <Video className="mt-0.5 h-5 w-5 text-brand" /> : <ImageIcon className="mt-0.5 h-5 w-5 text-brand" />}
                        <span>
                          <span className="block font-medium">{tcat(`platforms.${key}.label`)}</span>
                          <span className="block text-sm text-muted-foreground">
                            {available ? `${tcat(`platforms.${key}.hint`)} · ${tc("credits", { count: costPerVariation(costs, key, "standard") })}` : t("unavailable")}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>

                {platform && PLATFORMS[platform].mediaOptions.length > 1 && (
                  <>
                    <h3 className="mb-3 mt-7 text-sm font-medium">{t("mediaTitle")}</h3>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {(PLATFORMS[platform].mediaOptions as readonly MediaKind[]).map((m) => (
                        <button key={m} type="button" disabled={!availability[m]} onClick={() => setMediaChoice(m)} data-selected={media === m}
                          className="choice flex items-start gap-3 disabled:cursor-not-allowed disabled:opacity-50">
                          {m === "VIDEO" ? <Video className="mt-0.5 h-5 w-5 text-brand" /> : <ImageIcon className="mt-0.5 h-5 w-5 text-brand" />}
                          <span>
                            <span className="block font-medium">{m === "VIDEO" ? t("mediaVideo") : t("mediaImage")}</span>
                            <span className="block text-sm text-muted-foreground">
                              {!availability[m] ? t("mediaUnavailable") : m === "VIDEO" ? t("mediaVideoHint", { aspect: PLATFORMS[platform].aspectRatio }) : t("mediaImageHint")}
                            </span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {isVideo && (
                  <>
                    <h3 className="mb-1 mt-7 text-sm font-medium">{t("duration")}</h3>
                    <p className="mb-3 text-xs text-muted-foreground">{t("durationHint")}</p>
                    <div className="grid grid-cols-[repeat(auto-fit,minmax(4.5rem,1fr))] gap-2">
                      {videoDurations[quality].map((s) => (
                        <button key={s} type="button" onClick={() => setDuration(s)} data-selected={duration === s} className="choice py-2.5 text-center">
                          <span className="block font-semibold tabular-nums">{t("durationOption", { s })}</span>
                          <span className="block text-xs text-muted-foreground">{tc("credits", { count: costPerVariation(costs, platform as PlatformKey, quality, s, "VIDEO") })}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}

                <h3 className="mb-3 mt-7 text-sm font-medium">{t("style")}</h3>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(STYLES) as StyleKey[]).map((key) => (
                    <button key={key} type="button" onClick={() => setStyle(key)} data-selected={style === key} className="choice rounded-full px-4 py-2 text-sm">
                      {tcat(`styles.${key}`)}
                    </button>
                  ))}
                </div>

                <h3 className="mb-3 mt-7 text-sm font-medium">{t("quality")}</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {(Object.keys(QUALITIES) as QualityKey[]).map((key) => (
                    <button key={key} type="button" onClick={() => setQuality(key)} data-selected={quality === key} className="choice">
                      <span className="flex items-center justify-between font-medium">
                        {tcat(`qualities.${key}.label`)}
                        {key === "premium" && <Sparkles className="h-4 w-4 text-brand" />}
                      </span>
                      <span className="mt-0.5 block text-sm text-muted-foreground">
                        {tcat(`qualities.${key}.description`)}
                        {platform ? ` · ${t("perVariation", { count: costPerVariation(costs, platform, key, isVideo ? snapDuration(chosenDuration, videoDurations[key]) : null, media) })}` : ""}
                      </span>
                    </button>
                  ))}
                </div>
              </Section>
            )}

            {step === 3 && platform && objective && style && (
              <Section title={t("reviewTitle")}>
                <h3 className="mb-3 text-sm font-medium">{t("variations")}</h3>
                <div className="grid grid-cols-4 gap-2">
                  {VARIATION_OPTIONS.map((v) => (
                    <button key={v} type="button" onClick={() => setVariations(v)} data-selected={variations === v} className="choice py-3 text-center text-lg font-semibold tabular-nums">
                      {v}
                    </button>
                  ))}
                </div>

                <div className="mt-6 space-y-2">
                  <label htmlFor="lang" className="label-base flex items-center gap-2"><Globe className="h-4 w-4 text-brand" /> {t("language")}</label>
                  <select id="lang" className="input-base" value={language} onChange={(e) => setLanguage(e.target.value as AdLanguage | "auto")}>
                    <option value="auto">{t("languageAuto")}</option>
                    {(Object.keys(AD_LANGUAGES) as AdLanguage[]).map((code) => (
                      <option key={code} value={code}>{AD_LANGUAGES[code][locale]}</option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">{t("languageHint")}</p>
                </div>

                <div className="mt-6 rounded-2xl border border-border p-4">
                  {logoUrl ? (
                    <label className="flex cursor-pointer items-center gap-4">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={logoUrl} alt="" className="h-10 w-16 shrink-0 rounded-lg bg-muted object-contain p-1" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium">{t("applyLogo")}</span>
                        <span className="block text-xs text-muted-foreground">{t("applyLogoHint")}</span>
                      </span>
                      <input type="checkbox" checked={applyLogo} onChange={(e) => setApplyLogo(e.target.checked)} className="h-5 w-5 shrink-0 accent-[var(--brand)]" />
                    </label>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {t.rich("noLogo", { link: (chunks) => <Link href="/brand" className="font-medium text-brand underline">{chunks}</Link> })}
                    </p>
                  )}
                </div>

                {isVideo && (
                  <div className="mt-3 divide-y divide-border rounded-2xl border border-border">
                    <label className="flex cursor-pointer items-center gap-4 p-4">
                      <Captions className="h-5 w-5 shrink-0 text-brand" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium">{t("captions")}</span>
                        <span className="block text-xs text-muted-foreground">{t("captionsHint")}</span>
                      </span>
                      <input type="checkbox" checked={captions} onChange={(e) => setCaptions(e.target.checked)} className="h-5 w-5 shrink-0 accent-[var(--brand)]" />
                    </label>
                    <label className="flex cursor-pointer items-center gap-4 p-4">
                      <Megaphone className="h-5 w-5 shrink-0 text-brand" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium">{t("endCard")}</span>
                        <span className="block text-xs text-muted-foreground">
                          {product?.price ? t("endCardHint") : t("endCardNoPrice")}
                        </span>
                      </span>
                      <input type="checkbox" checked={endCard} onChange={(e) => setEndCard(e.target.checked)} className="h-5 w-5 shrink-0 accent-[var(--brand)]" />
                    </label>
                  </div>
                )}

                <dl className="mt-6 grid gap-x-6 gap-y-3 rounded-2xl bg-muted/50 p-5 text-sm sm:grid-cols-2">
                  <Row k={t("summary.product")} v={product?.name} />
                  <Row k={t("summary.objective")} v={tcat(`objectives.${objective}.label`)} />
                  <Row k={t("summary.format")} v={`${tcat(`platforms.${platform}.label`)} · ${PLATFORMS[platform].aspectRatio} · ${isVideo ? t("mediaVideo") : t("mediaImage")}`} />
                  <Row k={t("summary.style")} v={`${tcat(`styles.${style}`)} · ${tcat(`qualities.${quality}.label`)}`} />
                  <Row k={t("summary.language")} v={language === "auto" ? t("languageAuto") : AD_LANGUAGES[language][locale]} />
                  {isVideo && <Row k={t("summaryDuration")} v={t("durationOption", { s: duration })} />}
                  {isVideo && <Row k={t("summaryFinish")} v={[captions && t("captions"), endCard && t("endCard")].filter(Boolean).join(" · ") || t("no")} />}
                  {logoUrl && <Row k={t("summaryLogo")} v={applyLogo ? t("yes") : t("no")} />}
                  {references.length > 0 && <Row k={t("summaryReferences")} v={String(references.length)} />}
                </dl>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border p-5">
                  <div>
                    <p className="text-sm text-muted-foreground">{t("totalCost")}</p>
                    <p className="text-2xl font-semibold tabular-nums">{tc("credits", { count: total })}</p>
                    <p className={`text-xs ${enough ? "text-muted-foreground" : "text-destructive"}`}>{t("yourBalance", { count: balance })}</p>
                  </div>
                  <p className="max-w-xs text-xs text-muted-foreground">
                    {t("refundNote")} {isVideo ? t("videoTime") : t("imageTime")}
                  </p>
                </div>

                {!emailVerified && <p className="mt-4 rounded-xl bg-warning/10 p-3 text-sm">{t("verifyFirst")}</p>}
                {emailVerified && !enough && (
                  <p className="mt-4 rounded-xl bg-destructive/10 p-3 text-sm">
                    {t.rich("notEnough", { buy: (chunks) => <Link href="/billing" className="font-semibold text-brand underline">{chunks}</Link> })}
                  </p>
                )}
              </Section>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Portal: um ancestral do painel tem transform, o que prenderia o "fixed" à área do conteúdo. */}
      {vyNotice && createPortal(
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center" role="alertdialog" aria-modal="true" aria-labelledby="vy-title">
          <div className="w-full max-w-md rounded-2xl border border-border bg-popover p-6 shadow-xl animate-in fade-in zoom-in-95">
            <div className="flex items-start gap-4">
              <PixelMascot mood="confused" size={64} />
              <div className="min-w-0">
                <p id="vy-title" className="text-lg font-semibold">
                  {vyNotice.kind === "OUT_OF_SCOPE" ? t("vyOutOfScopeTitle") : vyNotice.kind === "IMAGE_BLOCKED" ? t("vyImageTitle") : t("vyPolicyTitle")}
                </p>
                <p className="mt-2 text-sm">{vyNotice.message}</p>
                <p className="mt-3 text-xs text-muted-foreground">{vyNotice.kind === "IMAGE_BLOCKED" ? t("vyImageFooter") : t("vyFooter")}</p>
              </div>
            </div>
            <div className="mt-5 flex justify-end">
              <button type="button" autoFocus onClick={() => { const blockedUpload = vyNotice.kind === "IMAGE_BLOCKED"; setVyNotice(null); if (!blockedUpload) setStep(1); }} className={buttonClass("primary")}>{t("vyOk")}</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      <div className="mt-4 flex items-center justify-between">
        <button type="button" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0 || loading} className={buttonClass("ghost")}>
          <ArrowLeft className="h-4 w-4" /> {tc("back")}
        </button>
        {step < 3 ? (
          <button type="button" onClick={() => setStep((s) => s + 1)} disabled={!canNext} className={buttonClass("primary")}>
            {tc("continue")} <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
          <button type="button" onClick={submit} disabled={loading || !enough || !emailVerified} className={buttonClass("brand", "lg")}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {loading ? t("creating") : t("generate", { count: total })}
          </button>
        )}
      </div>
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      <div className="mt-5">{children}</div>
    </div>
  );
}

function Row({ k, v }: { k: string; v?: string }) {
  return (
    <div className="flex gap-2">
      <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
      <div>
        <dt className="text-xs text-muted-foreground">{k}</dt>
        <dd className="font-medium">{v}</dd>
      </div>
    </div>
  );
}
