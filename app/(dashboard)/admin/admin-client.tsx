"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle, BarChart3, ChevronDown, Copy, CreditCard, Download, ExternalLink, Gift, ImageOff, KeyRound, Plug, Loader2, Package, Plus,
  ArrowDown, ArrowUp, RefreshCw, Save, Search, Settings2, ShieldCheck, Sparkles, TicketPercent, Trash2, Users,
} from "lucide-react";
import { toast } from "sonner";
import { useLocale } from "next-intl";
import { buttonClass } from "@/components/app/ui-bits";
import { formatDateTime, formatMoney } from "@/lib/format";
import { VIDEO_MODEL_PRESETS } from "@/lib/video-models";
import {
  defaultProviderPrices, estimateVariationUsd, resolveProviderPrices, worstRevenuePerCreditUsd,
  type ProviderPriceOverrides, type ProviderPrices,
} from "@/lib/provider-pricing";

type SecretInfo = { configured: boolean; hint: string | null; source: "painel" | "env" | null };
interface Plan {
  id: string; name: string; description?: string | null; description_en?: string | null; price_brl: number; price_usd: number; price_eur?: number | null;
  credits: number; interval?: "once" | "month"; isFeatured?: boolean; isFree?: boolean; isHidden?: boolean; features_pt: string[]; features_en: string[];
  stripe?: { mode: "test" | "live"; productId: string; prices: Partial<Record<"brl" | "usd" | "eur", { id: string; amount: number }>> } | null;
}
interface StripeSync { configured: boolean; mode: "test" | "live" | null; synced: number; errors: string[] }
interface ConfigResponse {
  secrets: Record<string, SecretInfo>;
  stripeMode: "test" | "live" | null;
  costs: { image: number; video: number; premiumMultiplier: number; usd?: ProviderPriceOverrides };
  models: Record<string, string | boolean>;
  defaultModels: Record<string, string | boolean>;
  plans: Plan[];
  freeTrial: { enabled: boolean; credits: number; planVisible: boolean };
  googleLogin: { enabled: boolean; active: boolean };
  signupsEnabled: boolean;
  settings: Partial<Record<SettingKey, string | boolean>>;
  effectiveSettings: {
    company: Record<string, string>;
    emailFrom: string;
    trackers: { gaId: string | null; metaPixelId: string | null };
    stripeAutomaticTax: boolean;
    brlGateway: "stripe" | "mercadopago";
    meta: { loginConfigId: string | null; graphVersion: string };
    elevenLabsVoiceId: string;
    elevenLabsVoiceIdMale: string;
  };
}
type SettingKey =
  | "companyName" | "companyCnpj" | "companyAddress" | "supportEmail" | "privacyEmail" | "euRepresentative" | "ukRepresentative"
  | "emailFrom" | "gaId" | "metaPixelId" | "stripeAutomaticTax" | "brlGateway" | "metaLoginConfigId" | "metaGraphVersion" | "elevenLabsVoiceId" | "elevenLabsVoiceIdMale";

/** Texto do painel no idioma do admin (o painel acompanha o idioma escolhido em Configurações). */
function useTr() {
  const en = useLocale() === "en";
  return useCallback((pt: string, english: string) => (en ? english : pt), [en]);
}

async function api(url: string, method = "GET", body?: unknown) {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Erro na requisição");
  return data;
}

const TABS = [
  { id: "overview", label: "Visão geral", icon: BarChart3 },
  { id: "users", label: "Usuários", icon: Users },
  { id: "ai", label: "IA e custos", icon: KeyRound },
  { id: "plans", label: "Pacotes", icon: Package },
  { id: "coupons", label: "Cupons", icon: TicketPercent },
  { id: "showcase", label: "Vitrine da landing", icon: Sparkles },
  { id: "trial", label: "Teste grátis", icon: Gift },
  { id: "payments", label: "Pagamentos", icon: CreditCard },
  { id: "integrations", label: "Integrações", icon: Plug },
  { id: "general", label: "Configurações gerais", icon: Settings2 },
  { id: "imageRights", label: "Autorizações de imagem", icon: ShieldCheck },
] as const;

export function AdminClient({ baseUrl }: { baseUrl: string }) {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("overview");
  const [config, setConfig] = useState<ConfigResponse | null>(null);

  const reload = useCallback(() => api("/api/admin/config").then(setConfig).catch((e) => toast.error(e.message)), []);
  useEffect(() => { reload(); }, [reload]);

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <nav className="flex gap-1 overflow-x-auto lg:w-52 lg:flex-col" aria-label="Seções do admin">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} aria-current={tab === t.id ? "page" : undefined}
            className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition ${tab === t.id ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </nav>
      <div className="min-w-0 flex-1">
        <ProviderAlerts />
        {tab === "overview" && <Overview />}
        {tab === "users" && <UsersTab />}
        {tab === "ai" && (config ? <AiTab config={config} onSaved={reload} /> : <Loading />)}
        {tab === "plans" && (config ? <PlansTab key={JSON.stringify(config.plans)} initial={config.plans} stripeMode={config.stripeMode} onSaved={reload} /> : <Loading />)}
        {tab === "coupons" && (config ? <CouponsTab plans={config.plans} /> : <Loading />)}
        {tab === "showcase" && <ShowcaseTab />}
        {tab === "trial" && (config ? <TrialTab initial={config.freeTrial} onSaved={reload} /> : <Loading />)}
        {tab === "payments" && (config ? <PaymentsTab config={config} onSaved={reload} baseUrl={baseUrl} /> : <Loading />)}
        {tab === "integrations" && (config ? <IntegrationsTab config={config} onSaved={reload} baseUrl={baseUrl} /> : <Loading />)}
        {tab === "general" && (config ? <GeneralTab config={config} onSaved={reload} /> : <Loading />)}
        {tab === "imageRights" && <ImageRightsTab />}
      </div>
    </div>
  );
}

// ---------------- Alertas de provedor (aparecem em todas as abas) ----------------
interface ProviderAlert { provider: string; label: string; message: string; failures: number; since: string; lastFailureAt: string; paused: boolean; billingUrl: string | null }

function ProviderAlerts() {
  const [alerts, setAlerts] = useState<ProviderAlert[]>([]);
  const load = useCallback(() => api("/api/admin/alerts").then((d) => setAlerts(d.alerts)).catch(() => undefined), []);
  useEffect(() => {
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [load]);

  const resolve = async (provider: string) => {
    try {
      await api("/api/admin/alerts", "POST", { provider });
      toast.success("Alerta encerrado: o provedor está liberado de novo");
      load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  if (alerts.length === 0) return null;
  return (
    <div className="mb-5 space-y-3" role="alert">
      {alerts.map((a) => (
        <div key={a.provider} className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-sm">
          <div className="flex flex-wrap items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            <div className="min-w-0 flex-1 space-y-1">
              <p className="font-semibold">{a.label}: sem saldo ou chave recusada</p>
              <p className="text-muted-foreground">
                {a.failures} falha(s) desde {formatDateTime(a.since)}.{" "}
                {a.paused
                  ? "Gerações que dependem dele estão pausadas (os clientes não são cobrados)."
                  : "A pausa acabou: a próxima geração vai testar de novo."}
              </p>
              <p className="break-words font-mono text-xs text-muted-foreground">{a.message}</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 pl-8">
            {a.billingUrl && (
              <a href={a.billingUrl} target="_blank" rel="noreferrer" className={buttonClass("outline", "sm")}>
                <ExternalLink className="h-3.5 w-3.5" /> Recarregar saldo
              </a>
            )}
            <button onClick={() => resolve(a.provider)} className={buttonClass("brand", "sm")}>Já recarreguei</button>
          </div>
        </div>
      ))}
    </div>
  );
}

function Loading() {
  return <div className="surface flex h-40 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
}

// ---------------- Visão geral ----------------
interface Overview {
  users: number; newUsers30d: number; campaigns: number; creatives: number; failedJobs30d: number; estimatedAiCostUsd30d: number;
  revenue: { currency: string; total: number; count: number }[];
  revenue30d: { currency: string; total: number; count: number }[];
  recentPayments: { id: string; provider: string; amount: number; currency: string; credits: number; createdAt: string; email: string }[];
}

function Overview() {
  const [data, setData] = useState<Overview | null>(null);
  useEffect(() => { api("/api/admin/overview").then(setData).catch((e) => toast.error(e.message)); }, []);
  if (!data) return <Loading />;

  const money = (rows: Overview["revenue"]) => rows.length ? rows.map((r) => formatMoney(r.total, r.currency)).join(" + ") : formatMoney(0);
  const stats = [
    ["Usuários", data.users.toLocaleString("pt-BR"), `+${data.newUsers30d} em 30 dias`],
    ["Receita (30 dias)", money(data.revenue30d), `${data.revenue30d.reduce((a, r) => a + r.count, 0)} pagamentos`],
    ["Receita total", money(data.revenue), `${data.revenue.reduce((a, r) => a + r.count, 0)} pagamentos`],
    ["Custo estimado de IA (30d)", formatMoney(data.estimatedAiCostUsd30d, "USD"), "Estimativa por operação"],
    ["Campanhas", data.campaigns.toLocaleString("pt-BR"), ""],
    ["Criativos entregues", data.creatives.toLocaleString("pt-BR"), `${data.failedJobs30d} falhas em 30 dias`],
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {stats.map(([label, value, hint]) => (
          <div key={label} className="surface p-5">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
            {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
          </div>
        ))}
      </div>
      <div className="surface overflow-x-auto">
        <h3 className="border-b border-border px-5 py-3 font-semibold">Últimos pagamentos</h3>
        {data.recentPayments.length === 0 ? <p className="p-5 text-sm text-muted-foreground">Nenhum pagamento ainda.</p> : (
          <table className="w-full text-sm">
            <tbody className="divide-y divide-border">
              {data.recentPayments.map((p) => (
                <tr key={p.id}>
                  <td className="whitespace-nowrap px-5 py-3">{formatDateTime(p.createdAt)}</td>
                  <td className="px-5 py-3">{p.email}</td>
                  <td className="px-5 py-3 tabular-nums">{formatMoney(p.amount, p.currency)}</td>
                  <td className="px-5 py-3 tabular-nums">+{p.credits} cr</td>
                  <td className="px-5 py-3 text-muted-foreground">{p.provider === "STRIPE" ? "Stripe" : "Mercado Pago"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ---------------- Usuários ----------------
interface AdminUser { id: string; email: string; name: string | null; role: string; createdAt: string; emailVerified: boolean; twoFactorEnabled: boolean; termsVersion: string | null; termsAcceptedAt: string | null; balance: number; campaigns: number }

function UsersTab() {
  const [q, setQ] = useState("");
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [adjust, setAdjust] = useState<{ user: AdminUser; amount: string; reason: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback((query: string) => api(`/api/admin/users?q=${encodeURIComponent(query)}`).then(setUsers).catch((e) => toast.error(e.message)), []);
  useEffect(() => { const t = setTimeout(() => load(q), 250); return () => clearTimeout(t); }, [q, load]);

  const submitAdjust = async () => {
    if (!adjust) return;
    setSaving(true);
    try {
      await api(`/api/admin/users/${adjust.user.id}/credits`, "POST", { amount: Number(adjust.amount), reason: adjust.reason });
      toast.success("Saldo ajustado");
      setAdjust(null);
      load(q);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <input className="input-base pl-9" placeholder="Buscar por e-mail ou nome" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {!users ? <Loading /> : (
        <div className="surface overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs text-muted-foreground">
              <tr><th className="px-4 py-3 font-medium">Usuário</th><th className="px-4 py-3 font-medium">Desde</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 font-medium">Campanhas</th><th className="px-4 py-3 font-medium">Saldo</th><th /></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-3"><p className="font-medium">{u.name || "—"}{u.role === "SUPERADMIN" && <span className="ml-2 rounded bg-brand-soft px-1.5 py-0.5 text-[10px] font-semibold text-brand">ADMIN</span>}</p><p className="text-xs text-muted-foreground">{u.email}</p></td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{formatDateTime(u.createdAt)}</td>
                  <td className="px-4 py-3 text-xs">{u.emailVerified ? "E-mail ok" : "Não verificado"}{u.twoFactorEnabled ? " · 2FA" : ""}
                    <span className="block text-muted-foreground" title={u.termsAcceptedAt ? `Aceite registrado em ${formatDateTime(u.termsAcceptedAt)}` : undefined}>
                      {u.termsVersion ? `Termos v${u.termsVersion}` : "Termos pendentes"}
                    </span>
                  </td>
                  <td className="px-4 py-3 tabular-nums">{u.campaigns}</td>
                  <td className="px-4 py-3 tabular-nums">{u.balance}</td>
                  <td className="px-4 py-3 text-right"><button onClick={() => setAdjust({ user: u, amount: "", reason: "" })} className={buttonClass("outline", "sm")}>Ajustar créditos</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {adjust && (
        <div className="surface space-y-3 p-5">
          <p className="font-medium">Ajustar créditos de {adjust.user.email} (saldo atual: {adjust.user.balance})</p>
          <div className="grid gap-3 sm:grid-cols-[140px_1fr]">
            <input className="input-base" type="number" placeholder="+50 ou -20" value={adjust.amount} onChange={(e) => setAdjust({ ...adjust, amount: e.target.value })} />
            <input className="input-base" placeholder="Motivo (fica no extrato do cliente)" value={adjust.reason} onChange={(e) => setAdjust({ ...adjust, reason: e.target.value })} />
          </div>
          <div className="flex gap-2">
            <button onClick={() => setAdjust(null)} className={buttonClass("ghost")}>Cancelar</button>
            <button onClick={submitAdjust} disabled={saving || !Number(adjust.amount) || adjust.reason.length < 3} className={buttonClass("brand")}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />} Aplicar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------- Segredos ----------------
function SecretField({ label, field, info, value, onChange, help }: {
  label: string; field: string; info?: SecretInfo; value: string | null | undefined; onChange: (field: string, v: string | null | undefined) => void; help?: string;
}) {
  const removing = value === null;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={field} className="label-base">{label}</label>
        <span className={`text-xs ${info?.configured ? "text-success" : "text-muted-foreground"}`}>
          {removing ? "será removida" : info?.configured ? `configurada ${info.hint} (${info.source === "env" ? "variável de ambiente" : "painel"})` : "não configurada"}
        </span>
      </div>
      <div className="flex gap-2">
        <input id={field} type="password" autoComplete="off" className="input-base font-mono" placeholder={info?.configured ? "Deixe em branco para manter" : "Cole a chave"}
          value={typeof value === "string" ? value : ""} onChange={(e) => onChange(field, e.target.value || undefined)} />
        {info?.source === "painel" && (
          <button type="button" onClick={() => onChange(field, removing ? undefined : null)} className={buttonClass("ghost")} title="Remover chave salva no painel">
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
      {help && <p className="text-xs text-muted-foreground">{help}</p>}
    </div>
  );
}

function useSecretDraft() {
  const [secrets, setSecrets] = useState<Record<string, string | null | undefined>>({});
  const change = (field: string, v: string | null | undefined) => setSecrets((s) => ({ ...s, [field]: v }));
  const payload = () => Object.fromEntries(Object.entries(secrets).filter(([, v]) => v !== undefined));
  return { secrets, change, payload, reset: () => setSecrets({}) };
}

function AiTab({ config, onSaved }: { config: ConfigResponse; onSaved: () => void }) {
  const draft = useSecretDraft();
  const [costs, setCosts] = useState(config.costs);
  const [models, setModels] = useState(config.models);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await api("/api/admin/config", "PUT", { secrets: draft.payload(), costs, models });
      toast.success("Configurações salvas");
      draft.reset();
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const modelGroups: { title: string; fields: Record<string, string> }[] = [
    { title: "Google Gemini", fields: { text: "Texto / estratégia / revisões", image: "Imagem (padrão)", imagePremium: "Imagem (premium e quadro de abertura)" } },
    { title: "OpenAI", fields: { openaiText: "Texto / estratégia / revisões", openaiImage: "Imagem (padrão)", openaiImagePremium: "Imagem (premium e quadro de abertura)" } },
    { title: "Vídeo", fields: { video: "Vídeo (padrão)", videoPremium: "Vídeo (premium)", lipsync: "Lip-sync final (fal.ai)" } },
  ];
  const providerOptions = [
    { value: "gemini", label: "Google Gemini", ok: config.secrets.geminiKey?.configured },
    { value: "openai", label: "OpenAI", ok: config.secrets.openAiKey?.configured },
  ];

  return (
    <div className="space-y-5">
      <section className="surface space-y-4 p-5 sm:p-6">
        <h3 className="font-semibold">Chaves dos provedores</h3>
        <p className="text-sm text-muted-foreground">Salvas criptografadas no banco. Por segurança, a chave nunca é exibida de novo, só os 4 últimos caracteres.</p>
        <SecretField label="Google Gemini" field="geminiKey" info={config.secrets.geminiKey} value={draft.secrets.geminiKey} onChange={draft.change} help="Textos e/ou imagens (conforme “Qual IA usar”). aistudio.google.com — ative o faturamento para os modelos de imagem." />
        <SecretField label="fal.ai (vídeo Wan)" field="wanKey" info={config.secrets.wanKey} value={draft.secrets.wanKey} onChange={draft.change} help="Obrigatória para vídeos. fal.ai/dashboard/keys" />
        <SecretField label="ElevenLabs (locução)" field="elevenLabsKey" info={config.secrets.elevenLabsKey} value={draft.secrets.elevenLabsKey} onChange={draft.change} help="Opcional: locução dos vídeos." />
        <SecretField label="OpenAI" field="openAiKey" info={config.secrets.openAiKey} value={draft.secrets.openAiKey} onChange={draft.change} help="Textos e/ou imagens (conforme “Qual IA usar”); também reserva da locução. platform.openai.com/api-keys" />
      </section>

      <section className="surface space-y-4 p-5 sm:p-6">
        <h3 className="font-semibold">Custos em créditos</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField label="Imagem" value={costs.image} onChange={(v) => setCosts({ ...costs, image: v })} />
          <NumberField label="Vídeo (a cada 5 s)" value={costs.video} onChange={(v) => setCosts({ ...costs, video: v })} />
          <NumberField label="Multiplicador Premium" value={costs.premiumMultiplier} step={0.5} onChange={(v) => setCosts({ ...costs, premiumMultiplier: v })} />
        </div>
      </section>

      <MarginSection costs={costs} setCosts={setCosts} models={models} plans={config.plans} hasFal={!!config.secrets.wanKey?.configured} />

      <section className="surface space-y-4 p-5 sm:p-6">
        <div>
          <h3 className="font-semibold">Qual IA usar</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Escolha o provedor de cada tarefa. Se ele falhar ou estiver sem chave, o outro (com chave) entra como reserva automaticamente.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {([["textProvider", "Textos, estratégia, moderação e revisões"], ["imageProvider", "Imagens e quadro de abertura dos vídeos"]] as const).map(([k, label]) => (
            <div key={k} className="space-y-1.5">
              <label className="label-base" htmlFor={`p-${k}`}>{label}</label>
              <select id={`p-${k}`} className="input-base" value={String(models[k] || config.defaultModels[k])} onChange={(e) => setModels({ ...models, [k]: e.target.value })}>
                {providerOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}{o.ok ? "" : " (sem chave)"}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
        <div className="space-y-1.5">
          <label className="label-base" htmlFor="p-video">Vídeos</label>
          <select
            id="p-video"
            className="input-base"
            value={VIDEO_MODEL_PRESETS.some((p) => p.id === models.video) ? String(models.video) : "custom"}
            onChange={(e) => e.target.value !== "custom" && setModels({ ...models, video: e.target.value, videoPremium: e.target.value })}
          >
            {VIDEO_MODEL_PRESETS.map((p) => {
              const veo = p.id.startsWith("veo-");
              const ok = veo ? config.secrets.geminiKey?.configured : config.secrets.wanKey?.configured;
              return <option key={p.id} value={p.id}>{p.label}{ok ? "" : veo ? " (sem chave do Gemini)" : " (sem chave da fal.ai)"}</option>;
            })}
            <option value="custom">Outro modelo (campo “Vídeo” abaixo)</option>
          </select>
          <p className="text-xs text-muted-foreground">
            Wan usa a chave da fal.ai; Veo usa a chave do Gemini (com faturamento ativo). Vale para padrão e premium; ajuste os modelos individualmente abaixo, se quiser.
          </p>
        </div>
        <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-border p-4">
          <span>
            <span className="block font-medium">Lip-sync final nos vídeos com apresentador</span>
            <span className="block text-sm text-muted-foreground">
              Quando alguém fala no vídeo, um modelo especializado refaz a boca no vídeo inteiro, sincronizada com a locução desde o primeiro quadro.
              Recomendado: sem ele, o modelo de vídeo às vezes deixa a pessoa calada nos primeiros segundos. Custo extra na fal.ai por vídeo.
            </span>
          </span>
          <Switch checked={models.lipsyncEnabled !== false} onChange={(v) => setModels({ ...models, lipsyncEnabled: v })} />
        </label>
      </section>

      <section className="surface space-y-5 p-5 sm:p-6">
        <div>
          <h3 className="font-semibold">Modelos</h3>
          <p className="mt-1 text-sm text-muted-foreground">Troque quando um provedor lançar uma versão nova, sem precisar de deploy.</p>
        </div>
        {modelGroups.map((g) => (
          <div key={g.title} className="space-y-3">
            <p className="text-sm font-medium">{g.title}</p>
            <div className="grid gap-4 sm:grid-cols-3">
              {Object.entries(g.fields).map(([k, label]) => (
                <div key={k} className="space-y-1.5">
                  <label className="label-base" htmlFor={`m-${k}`}>{label}</label>
                  <input id={`m-${k}`} className="input-base font-mono" value={String(models[k] ?? "")} placeholder={String(config.defaultModels[k] ?? "")} onChange={(e) => setModels({ ...models, [k]: e.target.value })} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>

      <button onClick={save} disabled={saving} className={buttonClass("brand", "lg")}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar
      </button>
    </div>
  );
}

// ---------------- Custo real e margem ----------------
const PRICE_FIELDS: { key: keyof ProviderPrices; label: string; step: number }[] = [
  { key: "videoPerSecond", label: "Vídeo padrão (US$/s)", step: 0.01 },
  { key: "videoPremiumPerSecond", label: "Vídeo premium (US$/s)", step: 0.01 },
  { key: "lipsyncPerSecond", label: "Lip-sync final (US$/s)", step: 0.005 },
  { key: "image", label: "Imagem padrão (US$)", step: 0.005 },
  { key: "imagePremium", label: "Imagem premium (US$)", step: 0.005 },
  { key: "keyframe", label: "Quadro de abertura do vídeo (US$)", step: 0.005 },
  { key: "voicePerVideo", label: "Locução de 20 s (US$)", step: 0.01 },
  { key: "textPerVariation", label: "Textos/revisões por variação (US$)", step: 0.005 },
  { key: "brlPerUsd", label: "Cotação R$ por US$", step: 0.05 },
  { key: "eurPerUsd", label: "Cotação € por US$", step: 0.01 },
];

type Costs = ConfigResponse["costs"];

function MarginSection({ costs, setCosts, models, plans, hasFal }: {
  costs: Costs; setCosts: (c: Costs) => void; models: Record<string, string | boolean>; plans: Plan[]; hasFal: boolean;
}) {
  const [target, setTarget] = useState(60);
  const m = Object.fromEntries(Object.entries(models).map(([k, v]) => [k, String(v)])) as Parameters<typeof defaultProviderPrices>[0];
  const defaults = defaultProviderPrices(m);
  const prices = resolveProviderPrices(defaults, costs.usd);
  const revenue = worstRevenuePerCreditUsd(plans, prices);
  const lipsync = models.lipsyncEnabled !== false && hasFal;
  const est = (media: "IMAGE" | "VIDEO", premium: boolean, seconds?: number) =>
    estimateVariationUsd(prices, { media, premium, seconds, videoModel: premium ? m.videoPremium : m.video, lipsync });

  const rows = [
    { label: "Imagem", credits: costs.image, cost: est("IMAGE", false) },
    { label: "Imagem premium", credits: Math.ceil(costs.image * costs.premiumMultiplier), cost: est("IMAGE", true) },
    { label: "Vídeo 10 s", credits: costs.video * 2, cost: est("VIDEO", false, 10) },
    { label: "Vídeo 20 s", credits: costs.video * 4, cost: est("VIDEO", false, 20) },
    { label: "Vídeo 20 s premium", credits: Math.ceil(costs.video * 4 * costs.premiumMultiplier), cost: est("VIDEO", true, 20) },
  ];

  const setPrice = (key: keyof ProviderPrices, raw: string) => {
    const usd = { ...(costs.usd || {}) };
    if (raw === "") delete usd[key];
    else usd[key] = Number(raw);
    setCosts({ ...costs, usd });
  };

  // Créditos que dão a margem alvo no pacote com o crédito mais barato (o pior caso).
  const suggest = () => {
    if (!revenue) return;
    const need = (cost: number) => cost / (revenue.usd * (1 - target / 100));
    const image = Math.max(1, Math.ceil(need(est("IMAGE", false))));
    const video = Math.max(1, Math.ceil(need(est("VIDEO", false, 20)) / 4));
    const ratio = Math.max(est("IMAGE", true) / est("IMAGE", false), est("VIDEO", true, 20) / est("VIDEO", false, 20));
    const premiumMultiplier = Math.min(10, Math.max(1, Math.ceil(ratio * 2) / 2));
    setCosts({ ...costs, image, video, premiumMultiplier });
    toast.success(`Sugestão aplicada (margem de ${target}%): imagem ${image}, vídeo ${video} a cada 5 s, premium ×${premiumMultiplier}. Revise e salve; ajuste também os textos dos pacotes ("~X vídeos").`, { duration: 10_000 });
  };

  return (
    <section className="surface space-y-5 p-5 sm:p-6">
      <div>
        <h3 className="font-semibold">Custo real e margem</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Estimativa do que cada geração custa nos provedores, comparada com o que o cliente paga no pacote de crédito mais barato
          {revenue ? ` (${plans[revenue.plan]?.name}: US$ ${revenue.usd.toFixed(4)} por crédito)` : ""}. Os valores vêm de uma tabela padrão por modelo;
          confira nas faturas dos provedores e corrija abaixo quando precisar. Vídeo conta os segundos realmente gerados (o Veo estende 8 + 7 + 7 s),
          o quadro de abertura, a locução{lipsync ? " e o lip-sync final" : ""}.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left text-xs text-muted-foreground">
            <tr>
              <th className="py-2 pr-4 font-medium">Geração</th>
              <th className="py-2 pr-4 font-medium">Créditos</th>
              <th className="py-2 pr-4 font-medium">Receita mínima</th>
              <th className="py-2 pr-4 font-medium">Custo estimado</th>
              <th className="py-2 font-medium">Margem</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border tabular-nums">
            {rows.map((r) => {
              const rev = revenue ? r.credits * revenue.usd : 0;
              const margin = rev > 0 ? (rev - r.cost) / rev : null;
              const tone = margin === null ? "" : margin < 0 ? "text-destructive font-semibold" : margin < 0.3 ? "text-amber-600 dark:text-amber-400 font-medium" : "text-emerald-700 dark:text-emerald-400";
              return (
                <tr key={r.label}>
                  <td className="py-2 pr-4">{r.label}</td>
                  <td className="py-2 pr-4">{r.credits}</td>
                  <td className="py-2 pr-4">{revenue ? `US$ ${rev.toFixed(2)}` : "—"}</td>
                  <td className="py-2 pr-4">US$ {r.cost.toFixed(2)}</td>
                  <td className={`py-2 ${tone}`}>{margin === null ? "—" : `${Math.round(margin * 100)}%${margin < 0 ? " (prejuízo)" : ""}`}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-36 space-y-1.5">
          <label className="label-base" htmlFor="m-target">Margem alvo (%)</label>
          <input id="m-target" type="number" min={0} max={95} className="input-base tabular-nums" value={target} onChange={(e) => setTarget(Math.min(95, Math.max(0, Number(e.target.value))))} />
        </div>
        <button onClick={suggest} disabled={!revenue} className={buttonClass("outline")}>Sugerir créditos para essa margem</button>
      </div>
      <details className="rounded-xl border border-border p-4">
        <summary className="cursor-pointer text-sm font-medium">Corrigir o custo dos provedores</summary>
        <p className="mt-2 text-xs text-muted-foreground">Em branco = valor padrão do modelo escolhido (mostrado no campo).</p>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          {PRICE_FIELDS.map((f) => (
            <div key={f.key} className="space-y-1.5">
              <label className="label-base" htmlFor={`usd-${f.key}`}>{f.label}</label>
              <input id={`usd-${f.key}`} type="number" min={0} step={f.step} className="input-base tabular-nums"
                placeholder={String(defaults[f.key])} value={costs.usd?.[f.key] ?? ""} onChange={(e) => setPrice(f.key, e.target.value)} />
            </div>
          ))}
        </div>
      </details>
    </section>
  );
}

function NumberField({ label, value, onChange, step = 1 }: { label: string; value: number; onChange: (v: number) => void; step?: number }) {
  return (
    <div className="space-y-1.5">
      <label className="label-base">{label}</label>
      <input type="number" min={0} step={step} className="input-base tabular-nums" value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}

// ---------------- Pacotes ----------------
function stripeToast(result: StripeSync | null | undefined, okText: string) {
  if (!result?.configured) return toast.success(`${okText}. Stripe não configurada: os pacotes serão criados nela quando a chave for salva em Pagamentos.`);
  const where = result.mode === "live" ? "produção" : "teste";
  if (result.errors.length) {
    return toast.error(`${okText}, mas a Stripe (${where}) recusou: ${result.errors.join(" · ")}`, { duration: 12_000 });
  }
  toast.success(`${okText} e sincronizados com a Stripe (${where}): ${result.synced} pacote(s).`);
}

function PlansTab({ initial, stripeMode, onSaved }: { initial: Plan[]; stripeMode: "test" | "live" | null; onSaved: () => void }) {
  const tr = useTr();
  const [plans, setPlans] = useState<Plan[]>(initial);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const update = (i: number, patch: Partial<Plan>) => setPlans((ps) => ps.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  const original = new Map(initial.map((p) => [p.id, p]));

  const save = async () => {
    setSaving(true);
    try {
      const clean = plans.map((p) => ({ ...p, features_pt: p.features_pt.filter((f) => f.trim()), features_en: p.features_en.filter((f) => f.trim()) }));
      const res = await api("/api/admin/config", "PUT", { plans: clean });
      stripeToast(res.stripe, "Pacotes salvos");
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const syncNow = async () => {
    setSyncing(true);
    try {
      stripeToast(await api("/api/admin/stripe/sync", "POST"), "Sincronização concluída");
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSyncing(false);
    }
  };

  /** Situação do pacote na Stripe (compara com o que está salvo, não com o rascunho). */
  const stripeBadge = (p: Plan) => {
    if (!stripeMode) return null;
    const saved = original.get(p.id);
    const ok = saved?.stripe?.mode === stripeMode;
    const dashboard = `https://dashboard.stripe.com/${stripeMode === "test" ? "test/" : ""}products/${saved?.stripe?.productId}`;
    return ok ? (
      <a href={dashboard} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
        Na Stripe ({stripeMode === "live" ? "produção" : "teste"}) <ExternalLink className="h-3 w-3" />
      </a>
    ) : (
      <span className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
        {saved ? "Ainda não está na Stripe" : "Novo: vai para a Stripe ao salvar"}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      <div className="surface flex flex-wrap items-center gap-3 p-4 text-sm">
        <p className="min-w-0 flex-1 text-muted-foreground">
          {stripeMode
            ? <>Ao salvar, cada pacote vira um produto na Stripe ({stripeMode === "live" ? "produção" : "teste"}) com um preço por moeda. Mudar o preço cria um preço novo e arquiva o antigo; ocultar ou remover arquiva o produto. Quem já pagou não é afetado.</>
            : <>Configure a Stripe em <strong>Pagamentos</strong> para os pacotes serem criados lá automaticamente. O Mercado Pago não precisa de cadastro de produto.</>}
        </p>
        {stripeMode && (
          <button onClick={syncNow} disabled={syncing} className={buttonClass("outline", "sm")}>
            {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Sincronizar agora
          </button>
        )}
      </div>
      {plans.map((p, i) => (
        <div key={i} className={`surface space-y-4 p-5 ${p.isFeatured ? "border-brand" : ""}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold">{p.name || "Novo pacote"}</p>
              {stripeBadge(p)}
            </div>
            <button onClick={() => setPlans(plans.filter((_, j) => j !== i))} className={buttonClass("ghost", "sm")}><Trash2 className="h-3.5 w-3.5" /> Remover</button>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <TextField label="ID (não mude após vender)" value={p.id} onChange={(v) => update(i, { id: v })} />
            <TextField label="Nome" value={p.name} onChange={(v) => update(i, { name: v })} />
            <div className="space-y-1.5">
              <label className="label-base">{tr("Tipo", "Type")}</label>
              <select className="input-base" value={p.interval || "once"} onChange={(e) => update(i, { interval: e.target.value as "once" | "month" })}>
                <option value="once">{tr("Pacote avulso", "One-off pack")}</option>
                <option value="month">{tr("Assinatura mensal (Stripe)", "Monthly subscription (Stripe)")}</option>
              </select>
            </div>
            <NumberField label={p.interval === "month" ? tr("Créditos por mês", "Credits per month") : tr("Créditos", "Credits")} value={p.credits} onChange={(v) => update(i, { credits: v })} />
            <NumberField label="Preço R$" value={p.price_brl} step={0.01} onChange={(v) => update(i, { price_brl: v })} />
            <NumberField label="Preço US$" value={p.price_usd} step={0.01} onChange={(v) => update(i, { price_usd: v })} />
            <NumberField label="Preço € (opcional)" value={p.price_eur || 0} step={0.01} onChange={(v) => update(i, { price_eur: v || null })} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField label="Descrição (PT)" value={p.description || ""} onChange={(v) => update(i, { description: v })} />
            <TextField label="Descrição (EN)" value={p.description_en || ""} onChange={(v) => update(i, { description_en: v })} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="label-base">Benefícios PT (um por linha)</label>
              <textarea className="input-base min-h-24 py-2" value={p.features_pt.join("\n")} onChange={(e) => update(i, { features_pt: e.target.value.split("\n") })} />
            </div>
            <div className="space-y-1.5">
              <label className="label-base">Benefícios EN (um por linha)</label>
              <textarea className="input-base min-h-24 py-2" value={p.features_en.join("\n")} onChange={(e) => update(i, { features_en: e.target.value.split("\n") })} />
            </div>
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={!!p.isFeatured} onChange={(e) => update(i, { isFeatured: e.target.checked })} /> Destacado</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={!!p.isHidden} onChange={(e) => update(i, { isHidden: e.target.checked })} /> Oculto</label>
          </div>
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setPlans([...plans, { id: `pack_${Date.now().toString(36)}`, name: "", price_brl: 0, price_usd: 0, credits: 100, interval: "once", features_pt: [], features_en: [] }])} className={buttonClass("outline")}>
          <Plus className="h-4 w-4" /> Adicionar pacote
        </button>
        <button onClick={save} disabled={saving} className={buttonClass("brand")}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar pacotes
        </button>
      </div>
    </div>
  );
}

// ---------------- Cupons ----------------
interface AdminCoupon {
  id: string; code: string; percentOff: number | null; amountOff: number | null; currency: string | null; planIds: string[];
  maxRedemptions: number | null; expiresAt: string | null; expired: boolean; active: boolean; createdAt: string; redemptions: number; totalDiscount: number; inStripe: boolean;
}

const EMPTY_COUPON = { code: "", kind: "percent" as "percent" | "amount", value: 10, currency: "BRL", planIds: [] as string[], maxRedemptions: "", expiresAt: "" };

function CouponsTab({ plans }: { plans: Plan[] }) {
  const [data, setData] = useState<{ stripeMode: "test" | "live" | null; coupons: AdminCoupon[] } | null>(null);
  const [form, setForm] = useState(EMPTY_COUPON);
  const [saving, setSaving] = useState(false);
  const load = useCallback(() => api("/api/admin/coupons").then(setData).catch((e) => toast.error(e.message)), []);
  useEffect(() => { load(); }, [load]);

  const create = async () => {
    setSaving(true);
    try {
      await api("/api/admin/coupons", "POST", {
        code: form.code,
        kind: form.kind,
        ...(form.kind === "percent" ? { percentOff: Math.round(form.value) } : { amountOff: form.value, currency: form.currency }),
        planIds: form.planIds,
        maxRedemptions: form.maxRedemptions ? Number(form.maxRedemptions) : null,
        // Vale até o fim do dia escolhido (horário de Brasília).
        expiresAt: form.expiresAt ? `${form.expiresAt}T23:59:59-03:00` : null,
      });
      toast.success(data?.stripeMode ? "Cupom criado (também na Stripe)" : "Cupom criado");
      setForm(EMPTY_COUPON);
      load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (c: AdminCoupon) => {
    try {
      await api(`/api/admin/coupons/${c.id}`, "PATCH", { active: !c.active });
      load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const remove = async (c: AdminCoupon) => {
    if (!confirm(c.redemptions ? `O cupom ${c.code} já foi usado: ele será desativado (fica no histórico).` : `Apagar o cupom ${c.code}?`)) return;
    try {
      const res = await api(`/api/admin/coupons/${c.id}`, "DELETE");
      toast.success(res.result === "deleted" ? "Cupom apagado" : "Cupom desativado");
      load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const discountLabel = (c: AdminCoupon) => (c.percentOff ? `${c.percentOff}%` : formatMoney(c.amountOff || 0, c.currency || "BRL"));
  const planNames = (ids: string[]) => (ids.length ? ids.map((id) => plans.find((p) => p.id === id)?.name || id).join(", ") : "Todos");

  return (
    <div className="space-y-5">
      <section className="surface space-y-4 p-5 sm:p-6">
        <div>
          <h3 className="font-semibold">Novo cupom</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            O cliente digita o código em Comprar créditos. Vale no Mercado Pago e na Stripe{data?.stripeMode ? " (onde também é criado como cupom e código promocional)" : ""}.
            Depois de criado, desconto, validade e limite não mudam: para alterar, desative e crie outro código.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <label className="label-base" htmlFor="c-code">Código</label>
            <input id="c-code" className="input-base font-mono uppercase" maxLength={40} placeholder="BEMVINDO10" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "") })} />
          </div>
          <div className="space-y-1.5">
            <label className="label-base" htmlFor="c-kind">Tipo de desconto</label>
            <select id="c-kind" className="input-base" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as "percent" | "amount" })}>
              <option value="percent">Porcentagem</option>
              <option value="amount">Valor fixo</option>
            </select>
          </div>
          <div className="flex gap-2">
            <div className="min-w-0 flex-1 space-y-1.5">
              <label className="label-base" htmlFor="c-value">{form.kind === "percent" ? "Desconto (%)" : "Desconto"}</label>
              <input id="c-value" type="number" min={form.kind === "percent" ? 1 : 0.01} max={form.kind === "percent" ? 95 : undefined} step={form.kind === "percent" ? 1 : 0.01}
                className="input-base tabular-nums" value={form.value} onChange={(e) => setForm({ ...form, value: Number(e.target.value) })} />
            </div>
            {form.kind === "amount" && (
              <div className="w-24 space-y-1.5">
                <label className="label-base" htmlFor="c-cur">Moeda</label>
                <select id="c-cur" className="input-base" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
                  <option>BRL</option><option>USD</option><option>EUR</option>
                </select>
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <label className="label-base" htmlFor="c-max">Limite de usos (opcional)</label>
            <input id="c-max" type="number" min={1} className="input-base tabular-nums" placeholder="Sem limite" value={form.maxRedemptions} onChange={(e) => setForm({ ...form, maxRedemptions: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <label className="label-base" htmlFor="c-exp">Válido até (opcional)</label>
            <input id="c-exp" type="date" className="input-base" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} />
          </div>
        </div>
        <fieldset className="space-y-2">
          <legend className="label-base">Pacotes em que vale (nenhum marcado = todos)</legend>
          <div className="flex flex-wrap gap-4 text-sm">
            {plans.map((p) => (
              <label key={p.id} className="flex items-center gap-2">
                <input type="checkbox" checked={form.planIds.includes(p.id)}
                  onChange={(e) => setForm({ ...form, planIds: e.target.checked ? [...form.planIds, p.id] : form.planIds.filter((x) => x !== p.id) })} />
                {p.name}
              </label>
            ))}
          </div>
        </fieldset>
        <button onClick={create} disabled={saving || form.code.length < 3 || !(form.value > 0)} className={buttonClass("brand")}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Criar cupom
        </button>
      </section>

      <section className="surface overflow-x-auto">
        <h3 className="border-b border-border px-5 py-3 font-semibold">Cupons</h3>
        {!data ? <Loading /> : data.coupons.length === 0 ? <p className="p-5 text-sm text-muted-foreground">Nenhum cupom ainda.</p> : (
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-5 py-2 font-medium">Código</th>
                <th className="px-5 py-2 font-medium">Desconto</th>
                <th className="px-5 py-2 font-medium">Pacotes</th>
                <th className="px-5 py-2 font-medium">Usos</th>
                <th className="px-5 py-2 font-medium">Validade</th>
                <th className="px-5 py-2 font-medium">Ativo</th>
                <th className="px-5 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.coupons.map((c) => {
                const expired = c.expired;
                return (
                  <tr key={c.id} className={c.active && !expired ? "" : "text-muted-foreground"}>
                    <td className="px-5 py-3">
                      <span className="font-mono font-medium">{c.code}</span>
                      {data.stripeMode && (
                        <span className={`ml-2 rounded-full px-2 py-0.5 text-[11px] ${c.inStripe ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-amber-500/10 text-amber-700 dark:text-amber-400"}`}>
                          {c.inStripe ? "Stripe" : "só no Vysify"}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 tabular-nums">{discountLabel(c)}</td>
                    <td className="px-5 py-3">{planNames(c.planIds)}</td>
                    <td className="px-5 py-3 tabular-nums">{c.redemptions}{c.maxRedemptions ? ` / ${c.maxRedemptions}` : ""}</td>
                    <td className="whitespace-nowrap px-5 py-3">{c.expiresAt ? `${formatDateTime(c.expiresAt)}${expired ? " (expirado)" : ""}` : "Sem prazo"}</td>
                    <td className="px-5 py-3"><Switch checked={c.active} onChange={() => toggle(c)} /></td>
                    <td className="px-5 py-3 text-right">
                      <button onClick={() => remove(c)} className={buttonClass("ghost", "sm")} aria-label={`Apagar ${c.code}`}><Trash2 className="h-3.5 w-3.5" /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <label className="label-base">{label}</label>
      <input className="input-base" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

// ---------------- Teste grátis ----------------
function Switch({ checked, disabled, onChange }: { checked: boolean; disabled?: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={checked} disabled={disabled} onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-40 ${checked ? "bg-brand" : "bg-muted-foreground/30"}`}>
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${checked ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}

function TrialTab({ initial, onSaved }: { initial: ConfigResponse["freeTrial"]; onSaved: () => void }) {
  const [trial, setTrial] = useState(initial);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await api("/api/admin/config", "PUT", { freeTrial: { ...trial, planVisible: trial.enabled && trial.planVisible } });
      toast.success(trial.enabled ? "Oferta de teste grátis salva" : "Ofertas grátis desativadas");
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <section className="surface space-y-5 p-5 sm:p-6">
        <div>
          <h3 className="font-semibold">Ofertas de teste grátis</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Desligadas por padrão. Enquanto estiverem desligadas, nenhum texto de “grátis” aparece no site e novas contas começam com 0 créditos.
          </p>
        </div>

        <div className="flex items-start justify-between gap-4 rounded-xl border border-border p-4">
          <div>
            <p className="font-medium">Dar créditos grátis no cadastro</p>
            <p className="text-sm text-muted-foreground">Cada conta nova recebe créditos para testar. Ativa o selo “créditos grátis” e o botão “Começar grátis”.</p>
          </div>
          <Switch checked={trial.enabled} onChange={(v) => setTrial({ ...trial, enabled: v })} />
        </div>

        {trial.enabled && (
          <div className="max-w-xs">
            <NumberField label="Créditos por conta nova" value={trial.credits} onChange={(v) => setTrial({ ...trial, credits: Math.max(1, Math.round(v)) })} />
          </div>
        )}

        <div className="flex items-start justify-between gap-4 rounded-xl border border-border p-4">
          <div>
            <p className="font-medium">Mostrar plano “Grátis” na página inicial</p>
            <p className="text-sm text-muted-foreground">
              {trial.enabled
                ? `Exibe um card “Grátis · ${trial.credits} créditos” ao lado dos pacotes pagos.`
                : "Disponível apenas com os créditos grátis ativados (para não anunciar algo que não existe)."}
            </p>
          </div>
          <Switch checked={trial.enabled && trial.planVisible} disabled={!trial.enabled} onChange={(v) => setTrial({ ...trial, planVisible: v })} />
        </div>

        <p className="text-xs text-muted-foreground">Alterações valem para novos cadastros. Contas já criadas não ganham nem perdem créditos.</p>
      </section>

      <button onClick={save} disabled={saving} className={buttonClass("brand", "lg")}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar
      </button>
    </div>
  );
}

// ---------------- Integrações (Meta) ----------------
function CopyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2">
        <code className="flex-1 break-all font-mono text-xs">{value}</code>
        <button type="button" onClick={() => { navigator.clipboard.writeText(value); toast.success("Copiado"); }} className="rounded-md p-1 text-muted-foreground hover:text-foreground" aria-label={`Copiar ${label}`}>
          <Copy className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function IntegrationsTab({ config, onSaved, baseUrl }: { config: ConfigResponse; onSaved: () => void; baseUrl: string }) {
  const tr = useTr();
  const draft = useSecretDraft();
  const [saving, setSaving] = useState(false);
  const configured = config.secrets.metaAppId?.configured && config.secrets.metaAppSecret?.configured;

  const save = async () => {
    setSaving(true);
    try {
      await api("/api/admin/config", "PUT", { secrets: draft.payload() });
      toast.success(tr("Credenciais salvas", "Credentials saved"));
      draft.reset();
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <GoogleLoginSection config={config} onSaved={onSaved} baseUrl={baseUrl} />

      <section className="surface space-y-4 p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold">App da Meta (Instagram + Facebook)</h3>
            <p className="mt-1 text-sm text-muted-foreground">Em developers.facebook.com › seu app › Configurações › Básico.</p>
          </div>
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${configured ? "bg-success/12 text-success" : "bg-muted text-muted-foreground"}`}>
            {configured ? "Ativo para clientes" : "Não configurado"}
          </span>
        </div>
        <SecretField label="App ID" field="metaAppId" info={config.secrets.metaAppId} value={draft.secrets.metaAppId} onChange={draft.change} />
        <SecretField label="App Secret" field="metaAppSecret" info={config.secrets.metaAppSecret} value={draft.secrets.metaAppSecret} onChange={draft.change}
          help="Enquanto o app estiver em modo de desenvolvimento, só quem tem função no app (admin, desenvolvedor, testador) consegue conectar." />
        <button onClick={save} disabled={saving} className={buttonClass("brand")}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar
        </button>
      </section>

      <section className="surface space-y-3 p-5 sm:p-6">
        <h3 className="font-semibold">URLs para cadastrar no painel da Meta</h3>
        <CopyRow label="URI de redirecionamento do OAuth válido (Login do Facebook › Configurações)" value={`${baseUrl}/api/integrations/meta/callback`} />
        <CopyRow label="URL de retorno de chamada para cancelar autorização" value={`${baseUrl}/api/integrations/meta/deauthorize`} />
        <CopyRow label="URL de solicitação de exclusão de dados" value={`${baseUrl}/api/integrations/meta/data-deletion`} />
        <CopyRow label="URL da Política de Privacidade" value={`${baseUrl}/legal/privacy`} />
        <CopyRow label="URL dos Termos de Serviço" value={`${baseUrl}/legal/terms`} />
        <CopyRow label="Domínio do app" value={baseUrl.replace(/^https?:\/\//, "")} />
        <p className="text-xs text-muted-foreground">Passo a passo completo, incluindo o App Review: docs/META_SETUP.md no repositório.</p>
        <p className="text-xs text-muted-foreground">{tr("Anúncios pagos usam também as permissões ads_management e ads_read (peça no App Review). Clientes que conectaram antes precisam reconectar para conceder.", "Paid ads also use the ads_management and ads_read permissions (request them in App Review). Customers who connected before need to reconnect to grant them.")}</p>
      </section>

      <section className="surface space-y-4 p-5 sm:p-6">
        <div>
          <h3 className="font-semibold">{tr("Lojas virtuais", "Online stores")}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{tr("Com as credenciais do app de cada plataforma, os clientes conectam a loja em Integrações e colocam as imagens geradas direto nos anúncios/produtos.", "With each platform's app credentials, customers connect their store in Integrations and push generated images straight to their listings/products.")}</p>
        </div>
        <p className="text-sm font-medium">Mercado Livre <span className="font-normal text-muted-foreground">· developers.mercadolivre.com.br › Suas aplicações</span></p>
        <SecretField label="App ID (client_id)" field="mercadoLivreAppId" info={config.secrets.mercadoLivreAppId} value={draft.secrets.mercadoLivreAppId} onChange={draft.change} />
        <SecretField label="Secret key" field="mercadoLivreSecret" info={config.secrets.mercadoLivreSecret} value={draft.secrets.mercadoLivreSecret} onChange={draft.change} />
        <CopyRow label={tr("URI de redirecionamento", "Redirect URI")} value={`${baseUrl}/api/integrations/stores/mercadolivre/callback`} />
        <p className="pt-2 text-sm font-medium">Nuvemshop <span className="font-normal text-muted-foreground">· partners.nuvemshop.com.br › Aplicativos</span></p>
        <SecretField label="App ID" field="nuvemshopAppId" info={config.secrets.nuvemshopAppId} value={draft.secrets.nuvemshopAppId} onChange={draft.change} />
        <SecretField label="Client secret" field="nuvemshopSecret" info={config.secrets.nuvemshopSecret} value={draft.secrets.nuvemshopSecret} onChange={draft.change} />
        <CopyRow label={tr("URL de redirecionamento (cadastrada no app)", "Redirect URL (set in the app)")} value={`${baseUrl}/api/integrations/stores/nuvemshop/callback`} />
        <p className="pt-2 text-sm font-medium">Shopify <span className="font-normal text-muted-foreground">· partners.shopify.com › Apps (escopos: read_products, write_products)</span></p>
        <SecretField label="Client ID" field="shopifyClientId" info={config.secrets.shopifyClientId} value={draft.secrets.shopifyClientId} onChange={draft.change} />
        <SecretField label="Client secret" field="shopifyClientSecret" info={config.secrets.shopifyClientSecret} value={draft.secrets.shopifyClientSecret} onChange={draft.change} />
        <CopyRow label={tr("URL de redirecionamento permitida", "Allowed redirection URL")} value={`${baseUrl}/api/integrations/stores/shopify/callback`} />
        <button onClick={save} disabled={saving} className={buttonClass("brand")}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {tr("Salvar", "Save")}
        </button>
      </section>
    </div>
  );
}

function GoogleLoginSection({ config, onSaved, baseUrl }: { config: ConfigResponse; onSaved: () => void; baseUrl: string }) {
  const draft = useSecretDraft();
  const [enabled, setEnabled] = useState(config.googleLogin.enabled);
  const [saving, setSaving] = useState(false);
  const hasCredentials = config.secrets.googleClientId?.configured && config.secrets.googleClientSecret?.configured;

  const save = async () => {
    setSaving(true);
    try {
      await api("/api/admin/config", "PUT", { secrets: draft.payload(), googleLogin: { enabled } });
      toast.success(enabled ? "Login com Google salvo" : "Login com Google desligado");
      draft.reset();
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="surface space-y-4 p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">Login com Google</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Mostra “Continuar com Google” no login e no cadastro. Vale na hora, sem redeploy (até 15 s para todos os servidores).
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${config.googleLogin.active ? "bg-success/12 text-success" : "bg-muted text-muted-foreground"}`}>
          {config.googleLogin.active ? "Visível para clientes" : !hasCredentials ? "Sem credenciais" : "Desligado"}
        </span>
      </div>

      <div className="flex items-start justify-between gap-4 rounded-xl border border-border p-4">
        <div>
          <p className="font-medium">Exibir botão do Google</p>
          <p className="text-sm text-muted-foreground">
            {hasCredentials ? "Desligar não afeta quem já tem conta: essas pessoas entram com e-mail e senha ou criam uma senha em “Esqueci minha senha”." : "Preencha o Client ID e o Client Secret abaixo para o botão aparecer."}
          </p>
        </div>
        <Switch checked={enabled} onChange={setEnabled} />
      </div>

      <SecretField label="Client ID" field="googleClientId" info={config.secrets.googleClientId} value={draft.secrets.googleClientId} onChange={draft.change} />
      <SecretField label="Client Secret" field="googleClientSecret" info={config.secrets.googleClientSecret} value={draft.secrets.googleClientSecret} onChange={draft.change}
        help="Google Cloud Console › APIs e serviços › Credenciais › ID do cliente OAuth (Aplicativo da Web)." />
      <CopyRow label="URI de redirecionamento autorizado (cadastre no Google Cloud)" value={`${baseUrl}/api/auth/callback/google`} />

      <button onClick={save} disabled={saving} className={buttonClass("brand")}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar
      </button>
    </section>
  );
}

// ---------------- Configurações gerais ----------------
function SettingInput({ label, value, inUse, onChange, help, type = "text" }: {
  label: string; value: string; inUse?: string | null; onChange: (v: string) => void; help?: string; type?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="label-base">{label}</label>
      <input className="input-base" type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={inUse || ""} />
      {!value && inUse && <p className="text-xs text-muted-foreground">Em uso (variável de ambiente ou padrão): {inUse}</p>}
      {help && <p className="text-xs text-muted-foreground">{help}</p>}
    </div>
  );
}

function SettingSwitch({ title, text, checked, onChange }: { title: string; text: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-border p-4">
      <div>
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{text}</p>
      </div>
      <Switch checked={checked} onChange={onChange} />
    </div>
  );
}

function GeneralTab({ config, onSaved }: { config: ConfigResponse; onSaved: () => void }) {
  const eff = config.effectiveSettings;
  const draft = useSecretDraft();
  const [signupsEnabled, setSignupsEnabled] = useState(config.signupsEnabled);
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(Object.entries(config.settings).filter(([, v]) => typeof v === "string")) as Record<string, string>
  );
  const [autoTax, setAutoTax] = useState(eff.stripeAutomaticTax);
  const [saving, setSaving] = useState(false);
  const v = (k: SettingKey) => values[k] ?? "";
  const set = (k: SettingKey) => (val: string) => setValues((s) => ({ ...s, [k]: val }));
  const placeholder = (s: string) => (s.startsWith("[") ? null : s);

  const save = async () => {
    setSaving(true);
    try {
      await api("/api/admin/config", "PUT", {
        signupsEnabled,
        secrets: draft.payload(),
        settings: { ...values, stripeAutomaticTax: autoTax },
      });
      toast.success("Configurações salvas. Valem em até 15 segundos, sem redeploy.");
      draft.reset();
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const missingCompany = ["name", "cnpj", "address"].filter((k) => eff.company[k]?.startsWith("["));

  return (
    <div className="space-y-5">
      <section className="surface space-y-4 p-5 sm:p-6">
        <h3 className="font-semibold">Cadastros</h3>
        <SettingSwitch title="Aceitar novas contas" checked={signupsEnabled} onChange={setSignupsEnabled}
          text="Desligado: a página de cadastro mostra “Cadastros fechados” e o login com Google não cria contas novas. Quem já tem conta continua entrando normalmente." />
      </section>

      <section className="surface space-y-4 p-5 sm:p-6">
        <div>
          <h3 className="font-semibold">Dados da empresa</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Exibidos nos Termos, na Política de Privacidade e no rodapé das páginas legais. A razão social, o CNPJ, o endereço e um e-mail de contato são obrigatórios (Decreto 7.962/2013 e LGPD).
          </p>
          {missingCompany.length > 0 && (
            <p className="mt-2 rounded-xl bg-warning/12 p-3 text-sm text-warning">Faltam dados obrigatórios: hoje os documentos legais mostram textos como “[CNPJ]”. Preencha antes de abrir para clientes.</p>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <SettingInput label="Razão social" value={v("companyName")} inUse={placeholder(eff.company.name)} onChange={set("companyName")} />
          <SettingInput label="CNPJ" value={v("companyCnpj")} inUse={placeholder(eff.company.cnpj)} onChange={set("companyCnpj")} />
        </div>
        <SettingInput label="Endereço completo" value={v("companyAddress")} inUse={placeholder(eff.company.address)} onChange={set("companyAddress")} />
        <div className="grid gap-4 sm:grid-cols-2">
          <SettingInput label="E-mail de suporte" type="email" value={v("supportEmail")} inUse={eff.company.supportEmail} onChange={set("supportEmail")} />
          <SettingInput label="E-mail de privacidade (encarregado/DPO)" type="email" value={v("privacyEmail")} inUse={eff.company.privacyEmail} onChange={set("privacyEmail")} />
        </div>
        <SettingInput label="Representante na União Europeia (GDPR art. 27)" value={v("euRepresentative")} inUse={eff.company.euRepresentative} onChange={set("euRepresentative")}
          help="Nome e endereço do representante contratado. Vazio = a seção não aparece na Privacy Policy em inglês." />
        <SettingInput label="Representante no Reino Unido (UK GDPR)" value={v("ukRepresentative")} inUse={eff.company.ukRepresentative} onChange={set("ukRepresentative")} />
      </section>

      <section className="surface space-y-4 p-5 sm:p-6">
        <div>
          <h3 className="font-semibold">E-mails (Resend)</h3>
          <p className="mt-1 text-sm text-muted-foreground">Confirmação de e-mail, recuperação de senha, boas-vindas, recibos e avisos de campanha pronta.</p>
        </div>
        <SecretField label="API key do Resend" field="resendKey" info={config.secrets.resendKey} value={draft.secrets.resendKey} onChange={draft.change}
          help="resend.com › API Keys. Sem ela, nenhum e-mail é enviado (os links só aparecem no log do servidor)." />
        <SettingInput label="Remetente" value={v("emailFrom")} inUse={eff.emailFrom} onChange={set("emailFrom")}
          help="Formato: Vysify <nao-responda@seudominio.com>. O domínio precisa estar verificado no Resend." />
      </section>

      <section className="surface space-y-4 p-5 sm:p-6">
        <div>
          <h3 className="font-semibold">Análise e marketing</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Só carregam depois que o visitante aceita no banner de cookies (LGPD/GDPR). Com os dois vazios, o banner nem aparece.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <SettingInput label="Google Analytics 4 (ID de medição)" value={v("gaId")} inUse={eff.trackers.gaId} onChange={set("gaId")} help="Formato G-XXXXXXX." />
          <SettingInput label="Pixel da Meta (ID)" value={v("metaPixelId")} inUse={eff.trackers.metaPixelId} onChange={set("metaPixelId")} help="Apenas números." />
        </div>
      </section>

      <section className="surface space-y-4 p-5 sm:p-6">
        <h3 className="font-semibold">Impostos (Stripe)</h3>
        <SettingSwitch title="Calcular impostos automaticamente (Stripe Tax)" checked={autoTax} onChange={setAutoTax}
          text="Soma IVA/VAT/sales tax no checkout internacional conforme o endereço do cliente. Só ligue depois de ativar o Stripe Tax e fazer os registros fiscais no painel da Stripe." />
      </section>

      <section className="surface space-y-4 p-5 sm:p-6">
        <div>
          <h3 className="font-semibold">Avançado</h3>
          <p className="mt-1 text-sm text-muted-foreground">Raramente precisa mudar. Vazio = padrão.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <SettingInput label="Meta: ID da configuração do login" value={v("metaLoginConfigId")} inUse={eff.meta.loginConfigId} onChange={set("metaLoginConfigId")}
            help="“Login do Facebook para Empresas”. Vazio = usa as permissões padrão." />
          <SettingInput label="Meta: versão da Graph API" value={v("metaGraphVersion")} inUse={eff.meta.graphVersion} onChange={set("metaGraphVersion")} help="Ex.: v23.0" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <SettingInput label="ElevenLabs: voz feminina / padrão" value={v("elevenLabsVoiceId")} inUse={eff.elevenLabsVoiceId} onChange={set("elevenLabsVoiceId")} />
          <SettingInput label="ElevenLabs: voz masculina" value={v("elevenLabsVoiceIdMale")} inUse={eff.elevenLabsVoiceIdMale} onChange={set("elevenLabsVoiceIdMale")}
            help="Usada quando quem apresenta o produto no vídeo é um homem." />
        </div>
      </section>

      <button onClick={save} disabled={saving} className={buttonClass("brand", "lg")}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar
      </button>
    </div>
  );
}

// ---------------- Autorizações de imagem ----------------
interface ImageRightsItem {
  id: string; createdAt: string; userEmail: string; userName: string | null; campaignId: string | null; campaignName: string | null;
  declarationVersion: string; declarationText: string; locale: string; imageUrls: string[]; imageHashes: string[];
  ipAddress: string | null; userAgent: string | null; campaignExists: boolean; accountExists: boolean;
}

function RefThumb({ url, n }: { url: string; n: number }) {
  const [broken, setBroken] = useState(false);
  return (
    <figure className="w-16 shrink-0">
      {broken ? (
        <div className="flex aspect-square w-16 flex-col items-center justify-center rounded-lg bg-muted text-[10px] text-muted-foreground" title="O arquivo foi apagado; o hash continua no registro.">
          <ImageOff className="h-4 w-4" /> apagada
        </div>
      ) : (
        <a href={url} target="_blank" rel="noopener">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={`Imagem ${n}`} onError={() => setBroken(true)} className="aspect-square w-16 rounded-lg border border-border bg-muted object-cover" />
        </a>
      )}
      <figcaption className="mt-0.5 text-center text-[10px] text-muted-foreground">Imagem {n}</figcaption>
    </figure>
  );
}

function ImageRightsTab() {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ total: number; pageSize: number; items: ImageRightsItem[] } | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      api(`/api/admin/image-rights?q=${encodeURIComponent(q)}&page=${page}`).then(setData).catch((e) => toast.error(e.message));
    }, 250);
    return () => clearTimeout(t);
  }, [q, page]);

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="space-y-5">
      <section className="surface space-y-2 p-5 sm:p-6">
        <h3 className="flex items-center gap-2 font-semibold"><ShieldCheck className="h-4 w-4 text-brand" /> Autorizações de uso de imagem</h3>
        <p className="text-sm text-muted-foreground">
          Toda vez que um cliente anexa imagens de referência, ele declara ter autorização para usar a imagem das pessoas nas fotos. Cada declaração fica
          registrada aqui com data e hora, o texto exato que ele aceitou, IP, navegador e a impressão digital (SHA-256) de cada imagem.
        </p>
        <p className="text-xs text-muted-foreground">
          Use estes registros só para defesa da plataforma (reclamações, processos, pedidos de autoridades). Base legal: LGPD art. 7º, VI, e art. 16;
          Marco Civil art. 15. Guardados por 5 anos, mesmo se a campanha ou a conta forem apagadas, e depois excluídos automaticamente. Cada consulta fica no log do servidor.
        </p>
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-60 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input className="input-base pl-9" placeholder="Buscar por e-mail, nome, campanha ou código do registro" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        </div>
        <a href={`/api/admin/image-rights?format=csv&q=${encodeURIComponent(q)}`} className={buttonClass("outline")}>
          <Download className="h-4 w-4" /> Exportar CSV
        </a>
      </div>

      {!data ? <Loading /> : data.items.length === 0 ? (
        <div className="surface p-8 text-center text-sm text-muted-foreground">{q ? "Nenhum registro encontrado para essa busca." : "Nenhuma declaração registrada ainda."}</div>
      ) : (
        <div className="surface divide-y divide-border">
          {data.items.map((r) => (
            <div key={r.id} className="p-4">
              <button type="button" onClick={() => setOpen(open === r.id ? null : r.id)} className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 text-left" aria-expanded={open === r.id}>
                <span className="w-36 shrink-0 text-sm tabular-nums">{formatDateTime(r.createdAt)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {r.userEmail}
                    {!r.accountExists && <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[10px] font-normal text-muted-foreground">conta excluída</span>}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {r.campaignName || "—"}
                    {!r.campaignExists && " · campanha apagada"}
                  </span>
                </span>
                <span className="text-xs text-muted-foreground">{r.imageUrls.length} {r.imageUrls.length === 1 ? "imagem" : "imagens"}</span>
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition ${open === r.id ? "rotate-180" : ""}`} />
              </button>

              {open === r.id && (
                <div className="mt-4 space-y-4 rounded-xl bg-muted/40 p-4 text-sm">
                  <div className="flex flex-wrap gap-3">
                    {r.imageUrls.map((u, i) => <RefThumb key={u} url={u} n={i + 2} />)}
                  </div>
                  <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[10rem_1fr]">
                    <dt className="text-muted-foreground">Texto aceito</dt><dd>“{r.declarationText}” <span className="text-xs text-muted-foreground">(versão {r.declarationVersion}, {r.locale === "en" ? "inglês" : "português"})</span></dd>
                    <dt className="text-muted-foreground">Cliente</dt><dd>{r.userName ? `${r.userName} · ` : ""}{r.userEmail}</dd>
                    <dt className="text-muted-foreground">Data e hora (UTC)</dt><dd className="font-mono text-xs">{r.createdAt}</dd>
                    <dt className="text-muted-foreground">IP</dt><dd className="font-mono text-xs">{r.ipAddress || "não disponível"}</dd>
                    <dt className="text-muted-foreground">Navegador</dt><dd className="break-all text-xs">{r.userAgent || "não disponível"}</dd>
                    <dt className="text-muted-foreground">Campanha</dt><dd className="break-all text-xs">{r.campaignName || "—"} <span className="font-mono text-muted-foreground">{r.campaignId}</span></dd>
                    <dt className="text-muted-foreground">SHA-256</dt>
                    <dd className="space-y-1">{r.imageHashes.map((h, i) => <p key={h + i} className="break-all font-mono text-[11px]">Imagem {i + 2}: {h}</p>)}</dd>
                    <dt className="text-muted-foreground">Código do registro</dt><dd className="font-mono text-xs">{r.id}</dd>
                  </dl>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {data && pages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{data.total} registros · página {page} de {pages}</span>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className={buttonClass("outline", "sm")}>Anterior</button>
            <button onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page >= pages} className={buttonClass("outline", "sm")}>Próxima</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------- Vitrine da landing ----------------
interface ShowcaseItemUi {
  creativeId: string; mediaType: "IMAGE" | "VIDEO"; mediaUrl: string; posterUrl?: string | null; aspectRatio: string; platformLabel: string;
  headline: string; caption: string; hashtags: string;
}
interface ShowcaseCandidate { id: string; type: string; url: string; posterUrl: string | null; aspectRatio: string | null; campaignName: string; platform: string; headline: string | null; createdAt: string }

function ShowcaseTab() {
  const tr = useTr();
  const [data, setData] = useState<{ max: number; candidates: ShowcaseCandidate[] } | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [items, setItems] = useState<(ShowcaseItemUi | { creativeId: string; pending: ShowcaseCandidate; headline: string; caption: string; hashtags: string })[]>([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => api("/api/admin/showcase").then((d) => {
    setData({ max: d.max, candidates: d.candidates });
    setEnabled(d.showcase.enabled);
    setItems(d.showcase.items);
  }).catch((e) => toast.error(e.message)), []);
  useEffect(() => { load(); }, [load]);

  const add = (c: ShowcaseCandidate) => {
    if (!data || items.length >= data.max || items.some((i) => i.creativeId === c.id)) return;
    setItems([...items, { creativeId: c.id, pending: c, headline: c.headline || "", caption: "", hashtags: "" }]);
  };
  const move = (i: number, d: -1 | 1) => setItems((list) => {
    const next = [...list];
    const j = i + d;
    if (j < 0 || j >= next.length) return list;
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });
  const edit = (i: number, patch: Partial<{ headline: string; caption: string; hashtags: string }>) => setItems((list) => list.map((it, j) => (j === i ? { ...it, ...patch } : it)));

  const save = async () => {
    setSaving(true);
    try {
      await api("/api/admin/showcase", "PUT", {
        enabled,
        // Item novo: o servidor copia a mídia e preenche legenda e hashtags do próprio criativo (dá para editar depois).
        items: items.map((it) => "pending" in it
          ? { creativeId: it.creativeId, ...(it.headline ? { headline: it.headline } : {}) }
          : { creativeId: it.creativeId, headline: it.headline, caption: it.caption, hashtags: it.hashtags }),
      });
      toast.success(tr("Vitrine salva. Abra a landing para conferir.", "Showcase saved. Open the landing page to check it."));
      load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (!data) return <Loading />;
  const chosen = new Set(items.map((i) => i.creativeId));

  return (
    <div className="space-y-5">
      <section className="surface space-y-3 p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-semibold">{tr("Vitrine da landing", "Landing showcase")}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {tr(
                `Mostre na página inicial até ${data.max} anúncios reais feitos no Vysify: a foto do produto, o anúncio (imagem ou vídeo), a legenda e as hashtags. Só aparecem criativos do seu próprio workspace — nunca de clientes. Os arquivos são copiados, então a vitrine continua no ar mesmo se a campanha for apagada.`,
                `Show up to ${data.max} real ads made with Vysify on the home page: the product photo, the ad (image or video), the caption and hashtags. Only creatives from your own workspace are listed — never customers'. Files are copied, so the showcase stays up even if the campaign is deleted.`
              )}
            </p>
          </div>
          <Switch checked={enabled} onChange={setEnabled} />
        </div>
      </section>

      {items.length > 0 && (
        <section className="space-y-3">
          {items.map((it, i) => {
            const media = "pending" in it ? { type: it.pending.type, url: it.pending.url, poster: it.pending.posterUrl } : { type: it.mediaType, url: it.mediaUrl, poster: it.posterUrl };
            return (
              <div key={it.creativeId} className="surface grid gap-4 p-4 sm:grid-cols-[120px_1fr]">
                <div className="aspect-[4/5] overflow-hidden rounded-lg bg-muted">
                  {media.type === "VIDEO"
                    ? <video src={media.url} poster={media.poster || undefined} muted playsInline preload="metadata" className="h-full w-full object-cover" />
                    // eslint-disable-next-line @next/next/no-img-element
                    : <img src={media.url} alt="" className="h-full w-full object-cover" />}
                </div>
                <div className="min-w-0 space-y-2">
                  <div className="flex items-center gap-1">
                    <span className="mr-auto text-xs text-muted-foreground">#{i + 1}{"pending" in it ? ` · ${tr("novo (salve para publicar)", "new (save to publish)")}` : ""}</span>
                    <button onClick={() => move(i, -1)} disabled={i === 0} className={buttonClass("ghost", "sm")} aria-label={tr("Subir", "Move up")}><ArrowUp className="h-3.5 w-3.5" /></button>
                    <button onClick={() => move(i, 1)} disabled={i === items.length - 1} className={buttonClass("ghost", "sm")} aria-label={tr("Descer", "Move down")}><ArrowDown className="h-3.5 w-3.5" /></button>
                    <button onClick={() => setItems(items.filter((_, j) => j !== i))} className={buttonClass("ghost", "sm")} aria-label={tr("Remover", "Remove")}><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                  <TextField label={tr("Título", "Headline")} value={it.headline} onChange={(v) => edit(i, { headline: v })} />
                  {!("pending" in it) && (
                    <>
                      <div className="space-y-1.5">
                        <label className="label-base">{tr("Legenda", "Caption")}</label>
                        <textarea className="input-base min-h-20 py-2" value={it.caption} onChange={(e) => edit(i, { caption: e.target.value })} />
                      </div>
                      <TextField label="Hashtags" value={it.hashtags} onChange={(v) => edit(i, { hashtags: v })} />
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </section>
      )}

      <section className="surface space-y-3 p-5 sm:p-6">
        <h3 className="font-semibold">{tr("Seus criativos prontos", "Your finished creatives")}</h3>
        {data.candidates.length === 0 ? (
          <p className="text-sm text-muted-foreground">{tr("Gere uma campanha com a sua conta admin para ter o que mostrar.", "Generate a campaign with your admin account to have something to show.")}</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {data.candidates.map((c) => (
              <button key={c.id} onClick={() => add(c)} disabled={chosen.has(c.id) || items.length >= data.max}
                className={`overflow-hidden rounded-xl border text-left transition ${chosen.has(c.id) ? "border-brand ring-1 ring-brand" : "border-border hover:border-foreground/30"} disabled:cursor-default`}>
                <div className="aspect-square bg-muted">
                  {c.type === "VIDEO"
                    ? <video src={c.url} poster={c.posterUrl || undefined} muted playsInline preload="metadata" className="h-full w-full object-cover" />
                    // eslint-disable-next-line @next/next/no-img-element
                    : <img src={c.url} alt="" loading="lazy" className="h-full w-full object-cover" />}
                </div>
                <div className="p-2">
                  <p className="truncate text-xs font-medium">{c.headline || c.campaignName}</p>
                  <p className="text-[11px] text-muted-foreground">{c.type === "VIDEO" ? tr("Vídeo", "Video") : tr("Imagem", "Image")} · {c.platform}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      <button onClick={save} disabled={saving} className={buttonClass("brand", "lg")}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {tr("Salvar vitrine", "Save showcase")}
      </button>
    </div>
  );
}

// ---------------- Pagamentos ----------------
interface StripeStatus {
  configured: boolean; ok?: boolean; mode?: "test" | "live"; error?: string;
  account?: { name: string; country: string | null; currency: string | null; chargesEnabled: boolean; payoutsEnabled: boolean };
  webhook?: { url: string; exists: boolean; enabled: boolean; missingEvents: string[]; secretSaved: boolean };
}

function PaymentsTab({ config, onSaved, baseUrl }: { config: ConfigResponse; onSaved: () => void; baseUrl: string }) {
  const tr = useTr();
  const draft = useSecretDraft();
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<StripeStatus | null>(null);
  const [hooking, setHooking] = useState(false);
  const [gateway, setGateway] = useState<"stripe" | "mercadopago">(config.effectiveSettings.brlGateway);
  const [showMp, setShowMp] = useState(gateway === "mercadopago" || !!config.secrets.mercadoPagoAccessToken?.configured);

  const loadStatus = useCallback(() => api("/api/admin/stripe").then(setStatus).catch(() => setStatus(null)), []);
  useEffect(() => { loadStatus(); }, [loadStatus]);

  const save = async () => {
    setSaving(true);
    try {
      const res = await api("/api/admin/config", "PUT", {
        secrets: draft.payload(),
        // As configurações gerais são salvas inteiras: junta a escolha do gateway com o que já existe.
        settings: { ...config.settings, brlGateway: gateway },
      });
      if (res.stripe?.configured) stripeToast(res.stripe, tr("Pagamentos salvos", "Payments saved"));
      else toast.success(tr("Pagamentos salvos", "Payments saved"));
      draft.reset();
      onSaved();
      loadStatus();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const createWebhook = async () => {
    setHooking(true);
    try {
      await api("/api/admin/stripe", "POST", { action: "webhook" });
      toast.success(tr("Webhook criado na Stripe e segredo salvo", "Webhook created in Stripe and secret saved"));
      onSaved();
      loadStatus();
    } catch (e) {
      toast.error((e as Error).message, { duration: 12_000 });
    } finally {
      setHooking(false);
    }
  };

  const dash = status?.mode === "test" ? "https://dashboard.stripe.com/test" : "https://dashboard.stripe.com";

  return (
    <div className="space-y-5">
      <section className="surface space-y-4 p-5 sm:p-6">
        <div>
          <h3 className="font-semibold">{tr("Stripe (gateway principal)", "Stripe (main gateway)")}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {tr(
              "Cole só a Secret key (Desenvolvedores › Chaves de API). Depois, um clique cria o webhook na Stripe e salva o segredo sozinho. Comece com a chave de teste (sk_test_…) e troque pela de produção (sk_live_…) quando for lançar.",
              "Paste only the Secret key (Developers › API keys). Then one click creates the webhook in Stripe and saves its secret. Start with the test key (sk_test_…) and switch to the live key (sk_live_…) at launch."
            )}
          </p>
        </div>
        <SecretField label="Secret key (sk_…)" field="stripeSecretKey" info={config.secrets.stripeSecretKey} value={draft.secrets.stripeSecretKey} onChange={draft.change} />

        {status?.configured && (
          <div className="space-y-3 rounded-xl border border-border p-4 text-sm">
            {status.ok && status.account ? (
              <>
                <p className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{status.account.name}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${status.mode === "live" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-amber-500/10 text-amber-700 dark:text-amber-400"}`}>
                    {status.mode === "live" ? tr("Produção", "Live") : tr("Teste", "Test")}
                  </span>
                  <span className="text-muted-foreground">{status.account.country} · {status.account.currency?.toUpperCase()}</span>
                </p>
                <p className={status.account.chargesEnabled ? "text-muted-foreground" : "text-destructive"}>
                  {status.account.chargesEnabled
                    ? tr("A conta já pode receber pagamentos.", "The account can accept payments.")
                    : tr("A conta ainda não pode cobrar: termine o cadastro da empresa no painel da Stripe.", "The account can't charge yet: finish the business onboarding in the Stripe dashboard.")}
                </p>
                <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
                  {status.webhook?.exists && status.webhook.enabled && status.webhook.missingEvents.length === 0 && status.webhook.secretSaved ? (
                    <span className="text-emerald-700 dark:text-emerald-400">{tr("Webhook ativo", "Webhook active")}: <span className="font-mono text-xs">{status.webhook.url}</span></span>
                  ) : (
                    <span className="text-amber-700 dark:text-amber-400">
                      {!status.webhook?.exists
                        ? tr("Webhook ainda não criado.", "Webhook not created yet.")
                        : !status.webhook.secretSaved
                          ? tr("Webhook existe, mas o segredo não está salvo aqui.", "Webhook exists, but its secret isn't saved here.")
                          : tr(`Faltam eventos: ${status.webhook.missingEvents.join(", ")}`, `Missing events: ${status.webhook.missingEvents.join(", ")}`)}
                    </span>
                  )}
                  <button onClick={createWebhook} disabled={hooking} className={`${buttonClass("outline", "sm")} ml-auto`}>
                    {hooking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                    {status.webhook?.exists ? tr("Recriar webhook", "Recreate webhook") : tr("Criar webhook automaticamente", "Create webhook automatically")}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {tr("Pix, boleto, Google Pay e Apple Pay aparecem no checkout quando ativados em ", "Pix, boleto, Google Pay and Apple Pay show up at checkout when enabled in ")}
                  <a className="underline" href={`${dash}/settings/payment_methods`} target="_blank" rel="noreferrer">{tr("Stripe › Formas de pagamento", "Stripe › Payment methods")}</a>.
                </p>
              </>
            ) : (
              <p className="text-destructive">{tr("A Stripe recusou a chave", "Stripe rejected the key")}: {status.error}</p>
            )}
          </div>
        )}

        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground">{tr("Configurar o webhook manualmente", "Set up the webhook manually")}</summary>
          <div className="mt-3 space-y-3">
            <p className="rounded-xl bg-muted p-3 font-mono text-xs">{baseUrl}/api/webhooks/stripe</p>
            <SecretField label="Webhook signing secret (whsec_…)" field="stripeWebhookSecret" info={config.secrets.stripeWebhookSecret} value={draft.secrets.stripeWebhookSecret} onChange={draft.change}
              help={tr(
                "Eventos: checkout.session.completed, checkout.session.async_payment_succeeded, charge.refunded, charge.dispute.created, invoice.paid, customer.subscription.updated e customer.subscription.deleted.",
                "Events: checkout.session.completed, checkout.session.async_payment_succeeded, charge.refunded, charge.dispute.created, invoice.paid, customer.subscription.updated and customer.subscription.deleted."
              )} />
          </div>
        </details>
      </section>

      <section className="surface space-y-3 p-5 sm:p-6">
        <h3 className="font-semibold">{tr("Pagamentos em reais", "Payments in BRL")}</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          {([
            ["stripe", tr("Stripe", "Stripe"), tr("Cartão, Pix e boleto pela Stripe (conforme o painel dela). Assinaturas também.", "Card, Pix and boleto through Stripe (per its dashboard). Subscriptions too.")],
            ["mercadopago", "Mercado Pago", tr("Pix, cartão e boleto pelo Mercado Pago. Só pacotes avulsos.", "Pix, card and boleto through Mercado Pago. One-off packs only.")],
          ] as const).map(([value, label, text]) => (
            <label key={value} className={`cursor-pointer rounded-xl border p-4 text-sm ${gateway === value ? "border-brand ring-1 ring-brand" : "border-border"}`}>
              <input type="radio" name="brl-gateway" className="sr-only" checked={gateway === value} onChange={() => { setGateway(value); if (value === "mercadopago") setShowMp(true); }} />
              <span className="block font-medium">{label}</span>
              <span className="mt-1 block text-muted-foreground">{text}</span>
            </label>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{tr("Dólar e euro são sempre cobrados pela Stripe.", "USD and EUR are always charged through Stripe.")}</p>
      </section>

      {showMp ? (
        <section className="surface space-y-4 p-5 sm:p-6">
          <h3 className="font-semibold">Mercado Pago</h3>
          <SecretField label="Access Token" field="mercadoPagoAccessToken" info={config.secrets.mercadoPagoAccessToken} value={draft.secrets.mercadoPagoAccessToken} onChange={draft.change} />
          <SecretField label={tr("Assinatura secreta do webhook", "Webhook secret signature")} field="mercadoPagoWebhookSecret" info={config.secrets.mercadoPagoWebhookSecret} value={draft.secrets.mercadoPagoWebhookSecret} onChange={draft.change}
            help={tr(
              "Em Suas integrações › Webhooks (evento: Pagamentos). Estornos e contestações feitos no Mercado Pago retiram os créditos automaticamente.",
              "In Your integrations › Webhooks (event: Payments). Refunds and chargebacks made in Mercado Pago remove the credits automatically."
            )} />
          <p className="rounded-xl bg-muted p-3 font-mono text-xs">{baseUrl}/api/webhooks/mercadopago</p>
        </section>
      ) : (
        <button onClick={() => setShowMp(true)} className={buttonClass("ghost", "sm")}>{tr("Usar também o Mercado Pago", "Also use Mercado Pago")}</button>
      )}

      <button onClick={save} disabled={saving} className={buttonClass("brand", "lg")}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {tr("Salvar", "Save")}
      </button>
    </div>
  );
}
