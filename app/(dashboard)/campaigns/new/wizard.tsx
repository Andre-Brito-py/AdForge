"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, Image as ImageIcon, Loader2, Plus, Sparkles, Video } from "lucide-react";
import { toast } from "sonner";
import {
  OBJECTIVES, PLATFORMS, QUALITIES, STYLES, VARIATION_OPTIONS, campaignCost, costPerVariation,
  type AiCosts, type ObjectiveKey, type PlatformKey, type QualityKey, type StyleKey,
} from "@/lib/catalog";
import { buttonClass } from "@/components/app/ui-bits";
import { setMascotMood } from "@/components/mascot/mascot-events";

interface Product { id: string; name: string; originalImageUrl: string; targetAudience: string | null }

const STEPS = ["Produto", "Objetivo", "Formato", "Revisão"];

export function CampaignWizard({
  products, initialProductId, balance, costs, availability, emailVerified,
}: {
  products: Product[];
  initialProductId: string;
  balance: number;
  costs: AiCosts;
  availability: { IMAGE: boolean; VIDEO: boolean };
  emailVerified: boolean;
}) {
  const router = useRouter();
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

  const product = products.find((p) => p.id === productId);
  const total = platform ? campaignCost(costs, platform, quality, variations) : 0;
  const enough = balance >= total;

  const canNext = useMemo(() => [!!productId, !!objective, !!platform && !!style, true][step], [step, productId, objective, platform, style]);

  const submit = async () => {
    if (!platform || !objective || !style) return;
    setLoading(true);
    setMascotMood("working");
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, objective, targetAudience: targetAudience || null, offer: offer || null, platform, style, quality, variations }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Não foi possível iniciar a campanha");
      router.push(`/campaigns/${data.id}/generating`);
    } catch (err) {
      setMascotMood("confused", 4000);
      toast.error(err instanceof Error ? err.message : "Erro ao iniciar");
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <ol className="mb-6 grid grid-cols-4 gap-2" aria-label="Etapas">
        {STEPS.map((label, i) => (
          <li key={label}>
            <button
              type="button"
              disabled={i > step}
              onClick={() => setStep(i)}
              className="w-full text-left disabled:cursor-default"
              aria-current={i === step ? "step" : undefined}
            >
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
              <Section title="Qual produto vamos anunciar?">
                {products.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border p-8 text-center">
                    <p className="text-sm text-muted-foreground">Você ainda não tem produtos cadastrados.</p>
                    <Link href="/products/new" className={`${buttonClass("brand")} mt-4`}>
                      <Plus className="h-4 w-4" /> Cadastrar produto
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
                      <Plus className="h-5 w-5" /> Novo produto
                    </Link>
                  </div>
                )}
              </Section>
            )}

            {step === 1 && (
              <Section title="Qual é o objetivo?" subtitle="Isso orienta a estratégia e o tom dos textos.">
                <div className="grid gap-3 sm:grid-cols-2">
                  {(Object.keys(OBJECTIVES) as ObjectiveKey[]).map((key) => (
                    <button key={key} type="button" onClick={() => setObjective(key)} data-selected={objective === key} className="choice">
                      <span className="block font-medium">{OBJECTIVES[key].label}</span>
                      <span className="mt-0.5 block text-sm text-muted-foreground">{OBJECTIVES[key].description}</span>
                    </button>
                  ))}
                </div>
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label htmlFor="aud" className="label-base">Público (opcional)</label>
                    <textarea id="aud" className="input-base min-h-24 py-3" maxLength={300} value={targetAudience} onChange={(e) => setTargetAudience(e.target.value)}
                      placeholder={product?.targetAudience || "Deixe em branco para a IA definir a partir do produto"} />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="offer" className="label-base">Oferta (opcional)</label>
                    <textarea id="offer" className="input-base min-h-24 py-3" maxLength={500} value={offer} onChange={(e) => setOffer(e.target.value)}
                      placeholder="Ex.: 20% off na primeira compra e frete grátis" />
                  </div>
                </div>
              </Section>
            )}

            {step === 2 && (
              <Section title="Onde o anúncio vai rodar?">
                <div className="grid gap-3 sm:grid-cols-2">
                  {(Object.keys(PLATFORMS) as PlatformKey[]).map((key) => {
                    const p = PLATFORMS[key];
                    const available = availability[p.media];
                    return (
                      <button key={key} type="button" disabled={!available} onClick={() => setPlatform(key)} data-selected={platform === key}
                        className="choice flex items-start gap-3 disabled:cursor-not-allowed disabled:opacity-50">
                        {p.media === "VIDEO" ? <Video className="mt-0.5 h-5 w-5 text-brand" /> : <ImageIcon className="mt-0.5 h-5 w-5 text-brand" />}
                        <span>
                          <span className="block font-medium">{p.label}</span>
                          <span className="block text-sm text-muted-foreground">{available ? `${p.hint} · ${costPerVariation(costs, key, "standard")} créditos` : "Indisponível no momento"}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>

                <h3 className="mb-3 mt-7 text-sm font-medium">Estilo visual</h3>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(STYLES) as StyleKey[]).map((key) => (
                    <button key={key} type="button" onClick={() => setStyle(key)} data-selected={style === key} className="choice rounded-full px-4 py-2 text-sm">
                      {STYLES[key]}
                    </button>
                  ))}
                </div>

                <h3 className="mb-3 mt-7 text-sm font-medium">Qualidade</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {(Object.keys(QUALITIES) as QualityKey[]).map((key) => (
                    <button key={key} type="button" onClick={() => setQuality(key)} data-selected={quality === key} className="choice">
                      <span className="flex items-center justify-between font-medium">
                        {QUALITIES[key].label}
                        {key === "premium" && <Sparkles className="h-4 w-4 text-brand" />}
                      </span>
                      <span className="mt-0.5 block text-sm text-muted-foreground">
                        {QUALITIES[key].description}
                        {platform ? ` · ${costPerVariation(costs, platform, key)} créditos por variação` : ""}
                      </span>
                    </button>
                  ))}
                </div>
              </Section>
            )}

            {step === 3 && platform && objective && style && (
              <Section title="Revise e gere">
                <h3 className="mb-3 text-sm font-medium">Quantas variações?</h3>
                <div className="grid grid-cols-4 gap-2">
                  {VARIATION_OPTIONS.map((v) => (
                    <button key={v} type="button" onClick={() => setVariations(v)} data-selected={variations === v} className="choice py-3 text-center text-lg font-semibold tabular-nums">
                      {v}
                    </button>
                  ))}
                </div>

                <dl className="mt-6 grid gap-x-6 gap-y-3 rounded-2xl bg-muted/50 p-5 text-sm sm:grid-cols-2">
                  <Row k="Produto" v={product?.name} />
                  <Row k="Objetivo" v={OBJECTIVES[objective].label} />
                  <Row k="Formato" v={`${PLATFORMS[platform].label} (${PLATFORMS[platform].hint})`} />
                  <Row k="Estilo" v={`${STYLES[style]} · ${QUALITIES[quality].label}`} />
                </dl>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border p-5">
                  <div>
                    <p className="text-sm text-muted-foreground">Custo total</p>
                    <p className="text-2xl font-semibold tabular-nums">{total} créditos</p>
                    <p className={`text-xs ${enough ? "text-muted-foreground" : "text-destructive"}`}>Seu saldo: {balance} créditos</p>
                  </div>
                  <p className="max-w-xs text-xs text-muted-foreground">
                    Se alguma variação falhar, os créditos dela voltam automaticamente. {PLATFORMS[platform].media === "VIDEO" ? "Vídeos levam alguns minutos." : "Imagens levam cerca de 1 minuto."}
                  </p>
                </div>

                {!emailVerified && (
                  <p className="mt-4 rounded-xl bg-warning/10 p-3 text-sm">Confirme seu e-mail (link no aviso do topo) para gerar campanhas.</p>
                )}
                {emailVerified && !enough && (
                  <p className="mt-4 rounded-xl bg-destructive/10 p-3 text-sm">
                    Saldo insuficiente. <Link href="/billing" className="font-semibold text-brand underline">Comprar créditos</Link> ou reduza as variações.
                  </p>
                )}
              </Section>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <button type="button" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0 || loading} className={buttonClass("ghost")}>
          <ArrowLeft className="h-4 w-4" /> Voltar
        </button>
        {step < 3 ? (
          <button type="button" onClick={() => setStep((s) => s + 1)} disabled={!canNext} className={buttonClass("primary")}>
            Continuar <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
          <button type="button" onClick={submit} disabled={loading || !enough || !emailVerified} className={buttonClass("brand", "lg")}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {loading ? "Criando estratégia..." : `Gerar campanha · ${total} créditos`}
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
