"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle, BarChart3, ChevronDown, Copy, CreditCard, Download, ExternalLink, Gift, ImageOff, KeyRound, Plug, Loader2, Package, Plus,
  ArrowDown, ArrowUp, FileText, RefreshCw, Save, Search, Settings2, ShieldCheck, Sparkles, TicketPercent, Trash2, Users,
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
    maxMembers: number;
    support: { whatsapp: string | null; start: string; end: string; days: number[]; timezone: string; message: string };
    cancellationFeePercent: number;
    fiscal: { enabled: boolean; companyId: string | null; cityServiceCode: string | null; description: string };
    meta: { loginConfigId: string | null; graphVersion: string };
    elevenLabsVoiceId: string;
    elevenLabsVoiceIdMale: string;
  };
}
type SettingKey =
  | "companyName" | "companyCnpj" | "companyAddress" | "supportEmail" | "privacyEmail" | "euRepresentative" | "ukRepresentative"
  | "emailFrom" | "gaId" | "metaPixelId" | "stripeAutomaticTax" | "brlGateway" | "maxMembers" | "supportWhatsapp" | "supportStart" | "supportEnd" | "supportDays" | "supportMessage" | "cancellationFeePercent" | "fiscalEnabled" | "nfeioCompanyId" | "fiscalCityServiceCode" | "fiscalDescription" | "metaLoginConfigId" | "metaGraphVersion" | "elevenLabsVoiceId" | "elevenLabsVoiceIdMale";

/** Texto do painel no idioma do admin (o painel acompanha o idioma escolhido em Configurações). */
function useTr() {
  const en = useLocale() === "en";
  return useCallback((pt: string, english: string) => (en ? english : pt), [en]);
}

async function api(url: string, method = "GET", body?: unknown) {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Erro / Error");
  return data;
}

const TABS = [
  { id: "overview", label: ["Visão geral", "Overview"], icon: BarChart3 },
  { id: "users", label: ["Usuários", "Users"], icon: Users },
  { id: "ai", label: ["IA e custos", "AI and costs"], icon: KeyRound },
  { id: "plans", label: ["Pacotes", "Packs"], icon: Package },
  { id: "coupons", label: ["Cupons", "Coupons"], icon: TicketPercent },
  { id: "showcase", label: ["Vitrine da landing", "Landing showcase"], icon: Sparkles },
  { id: "trial", label: ["Teste grátis", "Free trial"], icon: Gift },
  { id: "payments", label: ["Pagamentos", "Payments"], icon: CreditCard },
  { id: "fiscal", label: ["Fiscal", "Tax"], icon: FileText },
  { id: "integrations", label: ["Integrações", "Integrations"], icon: Plug },
  { id: "general", label: ["Configurações gerais", "General settings"], icon: Settings2 },
  { id: "imageRights", label: ["Autorizações de imagem", "Image authorizations"], icon: ShieldCheck },
] as const;

export function AdminClient({ baseUrl }: { baseUrl: string }) {
  const tr = useTr();
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("overview");
  const [config, setConfig] = useState<ConfigResponse | null>(null);

  const reload = useCallback(() => api("/api/admin/config").then(setConfig).catch((e) => toast.error(e.message)), []);
  useEffect(() => { reload(); }, [reload]);

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <nav className="flex gap-1 overflow-x-auto lg:w-52 lg:flex-col" aria-label={tr("Seções do admin", "Admin sections")}>
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} aria-current={tab === t.id ? "page" : undefined}
            className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition ${tab === t.id ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
            <t.icon className="h-4 w-4" /> {tr(t.label[0], t.label[1])}
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
        {tab === "fiscal" && (config ? <FiscalTab config={config} onSaved={reload} /> : <Loading />)}
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
  const tr = useTr();
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
      toast.success(tr("Alerta encerrado: o provedor está liberado de novo", "Alert closed: the provider is enabled again"));
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
              <p className="font-semibold">{a.label}: {tr("sem saldo ou chave recusada", "out of balance or key rejected")}</p>
              <p className="text-muted-foreground">
                {tr(`${a.failures} falha(s) desde ${formatDateTime(a.since)}.`, `${a.failures} failure(s) since ${formatDateTime(a.since)}.`)}{" "}
                {a.paused
                  ? tr("Gerações que dependem dele estão pausadas (os clientes não são cobrados).", "Generations that depend on it are paused (customers aren't charged).")
                  : tr("A pausa acabou: a próxima geração vai testar de novo.", "The pause is over: the next generation will try again.")}
              </p>
              <p className="break-words font-mono text-xs text-muted-foreground">{a.message}</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 pl-8">
            {a.billingUrl && (
              <a href={a.billingUrl} target="_blank" rel="noreferrer" className={buttonClass("outline", "sm")}>
                <ExternalLink className="h-3.5 w-3.5" /> {tr("Recarregar saldo", "Top up balance")}
              </a>
            )}
            <button onClick={() => resolve(a.provider)} className={buttonClass("brand", "sm")}>{tr("Já recarreguei", "I've topped up")}</button>
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
  const tr = useTr();
  const [data, setData] = useState<Overview | null>(null);
  useEffect(() => { api("/api/admin/overview").then(setData).catch((e) => toast.error(e.message)); }, []);
  if (!data) return <Loading />;

  const money = (rows: Overview["revenue"]) => rows.length ? rows.map((r) => formatMoney(r.total, r.currency)).join(" + ") : formatMoney(0);
  const stats = [
    [tr("Usuários", "Users"), data.users.toLocaleString(), tr(`+${data.newUsers30d} em 30 dias`, `+${data.newUsers30d} in 30 days`)],
    [tr("Receita (30 dias)", "Revenue (30 days)"), money(data.revenue30d), tr(`${data.revenue30d.reduce((a, r) => a + r.count, 0)} pagamentos`, `${data.revenue30d.reduce((a, r) => a + r.count, 0)} payments`)],
    [tr("Receita total", "Total revenue"), money(data.revenue), tr(`${data.revenue.reduce((a, r) => a + r.count, 0)} pagamentos`, `${data.revenue.reduce((a, r) => a + r.count, 0)} payments`)],
    [tr("Custo estimado de IA (30d)", "Estimated AI cost (30d)"), formatMoney(data.estimatedAiCostUsd30d, "USD"), tr("Estimativa por operação", "Estimate per operation")],
    [tr("Campanhas", "Campaigns"), data.campaigns.toLocaleString(), ""],
    [tr("Criativos entregues", "Creatives delivered"), data.creatives.toLocaleString(), tr(`${data.failedJobs30d} falhas em 30 dias`, `${data.failedJobs30d} failures in 30 days`)],
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
        <h3 className="border-b border-border px-5 py-3 font-semibold">{tr("Últimos pagamentos", "Latest payments")}</h3>
        {data.recentPayments.length === 0 ? <p className="p-5 text-sm text-muted-foreground">{tr("Nenhum pagamento ainda.", "No payments yet.")}</p> : (
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
  const tr = useTr();
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
      toast.success(tr("Saldo ajustado", "Balance adjusted"));
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
        <input className="input-base pl-9" placeholder={tr("Buscar por e-mail ou nome", "Search by email or name")} value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {!users ? <Loading /> : (
        <div className="surface overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs text-muted-foreground">
              <tr><th className="px-4 py-3 font-medium">{tr("Usuário", "User")}</th><th className="px-4 py-3 font-medium">{tr("Desde", "Since")}</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 font-medium">{tr("Campanhas", "Campaigns")}</th><th className="px-4 py-3 font-medium">{tr("Saldo", "Balance")}</th><th /></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-3"><p className="font-medium">{u.name || "—"}{u.role === "SUPERADMIN" && <span className="ml-2 rounded bg-brand-soft px-1.5 py-0.5 text-[10px] font-semibold text-brand">ADMIN</span>}</p><p className="text-xs text-muted-foreground">{u.email}</p></td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{formatDateTime(u.createdAt)}</td>
                  <td className="px-4 py-3 text-xs">{u.emailVerified ? tr("E-mail ok", "Email ok") : tr("Não verificado", "Not verified")}{u.twoFactorEnabled ? " · 2FA" : ""}
                    <span className="block text-muted-foreground" title={u.termsAcceptedAt ? tr(`Aceite registrado em ${formatDateTime(u.termsAcceptedAt)}`, `Accepted on ${formatDateTime(u.termsAcceptedAt)}`) : undefined}>
                      {u.termsVersion ? tr(`Termos v${u.termsVersion}`, `Terms v${u.termsVersion}`) : tr("Termos pendentes", "Terms pending")}
                    </span>
                  </td>
                  <td className="px-4 py-3 tabular-nums">{u.campaigns}</td>
                  <td className="px-4 py-3 tabular-nums">{u.balance}</td>
                  <td className="px-4 py-3 text-right"><button onClick={() => setAdjust({ user: u, amount: "", reason: "" })} className={buttonClass("outline", "sm")}>{tr("Ajustar créditos", "Adjust credits")}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {adjust && (
        <div className="surface space-y-3 p-5">
          <p className="font-medium">{tr(`Ajustar créditos de ${adjust.user.email} (saldo atual: ${adjust.user.balance})`, `Adjust credits for ${adjust.user.email} (current balance: ${adjust.user.balance})`)}</p>
          <div className="grid gap-3 sm:grid-cols-[140px_1fr]">
            <input className="input-base" type="number" placeholder={tr("+50 ou -20", "+50 or -20")} value={adjust.amount} onChange={(e) => setAdjust({ ...adjust, amount: e.target.value })} />
            <input className="input-base" placeholder={tr("Motivo (fica no extrato do cliente)", "Reason (shown in the customer's statement)")} value={adjust.reason} onChange={(e) => setAdjust({ ...adjust, reason: e.target.value })} />
          </div>
          <div className="flex gap-2">
            <button onClick={() => setAdjust(null)} className={buttonClass("ghost")}>{tr("Cancelar", "Cancel")}</button>
            <button onClick={submitAdjust} disabled={saving || !Number(adjust.amount) || adjust.reason.length < 3} className={buttonClass("brand")}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />} {tr("Aplicar", "Apply")}
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
  const tr = useTr();
  const removing = value === null;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={field} className="label-base">{label}</label>
        <span className={`text-xs ${info?.configured ? "text-success" : "text-muted-foreground"}`}>
          {removing
            ? tr("será removida", "will be removed")
            : info?.configured
              ? tr(`configurada ${info.hint} (${info.source === "env" ? "variável de ambiente" : "painel"})`, `set ${info.hint} (${info.source === "env" ? "environment variable" : "panel"})`)
              : tr("não configurada", "not set")}
        </span>
      </div>
      <div className="flex gap-2">
        <input id={field} type="password" autoComplete="off" className="input-base font-mono" placeholder={info?.configured ? tr("Deixe em branco para manter", "Leave blank to keep") : tr("Cole a chave", "Paste the key")}
          value={typeof value === "string" ? value : ""} onChange={(e) => onChange(field, e.target.value || undefined)} />
        {info?.source === "painel" && (
          <button type="button" onClick={() => onChange(field, removing ? undefined : null)} className={buttonClass("ghost")} title={tr("Remover chave salva no painel", "Remove key saved in the panel")}>
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
  const tr = useTr();
  const draft = useSecretDraft();
  const [costs, setCosts] = useState(config.costs);
  const [models, setModels] = useState(config.models);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await api("/api/admin/config", "PUT", { secrets: draft.payload(), costs, models });
      toast.success(tr("Configurações salvas", "Settings saved"));
      draft.reset();
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const textLabel = tr("Texto / estratégia / revisões", "Text / strategy / reviews");
  const imageLabel = tr("Imagem (padrão)", "Image (standard)");
  const imagePremiumLabel = tr("Imagem (premium e quadro de abertura)", "Image (premium and opening frame)");
  const modelGroups: { title: string; fields: Record<string, string> }[] = [
    { title: "Google Gemini", fields: { text: textLabel, image: imageLabel, imagePremium: imagePremiumLabel } },
    { title: "OpenAI", fields: { openaiText: textLabel, openaiImage: imageLabel, openaiImagePremium: imagePremiumLabel } },
    { title: tr("Vídeo", "Video"), fields: { video: tr("Vídeo (padrão)", "Video (standard)"), videoPremium: tr("Vídeo (premium)", "Video (premium)"), lipsync: tr("Lip-sync final (fal.ai)", "Final lip-sync (fal.ai)") } },
  ];
  const providerOptions = [
    { value: "gemini", label: "Google Gemini", ok: config.secrets.geminiKey?.configured },
    { value: "openai", label: "OpenAI", ok: config.secrets.openAiKey?.configured },
  ];

  return (
    <div className="space-y-5">
      <section className="surface space-y-4 p-5 sm:p-6">
        <h3 className="font-semibold">{tr("Chaves dos provedores", "Provider keys")}</h3>
        <p className="text-sm text-muted-foreground">{tr("Salvas criptografadas no banco. Por segurança, a chave nunca é exibida de novo, só os 4 últimos caracteres.", "Stored encrypted in the database. For security, a key is never shown again, only its last 4 characters.")}</p>
        <SecretField label="Google Gemini" field="geminiKey" info={config.secrets.geminiKey} value={draft.secrets.geminiKey} onChange={draft.change}
          help={tr("Textos e/ou imagens (conforme “Qual IA usar”) e o vídeo Veo. aistudio.google.com — ative o faturamento.", "Text and/or images (per “Which AI to use”) and Veo video. aistudio.google.com — enable billing.")} />
        <SecretField label={tr("fal.ai (vídeo Wan/Kling e lip-sync)", "fal.ai (Wan/Kling video and lip-sync)")} field="wanKey" info={config.secrets.wanKey} value={draft.secrets.wanKey} onChange={draft.change}
          help={tr("Vídeos com Wan ou Kling e o lip-sync final. fal.ai/dashboard/keys", "Wan or Kling videos and the final lip-sync. fal.ai/dashboard/keys")} />
        <SecretField label={tr("ElevenLabs (locução)", "ElevenLabs (voiceover)")} field="elevenLabsKey" info={config.secrets.elevenLabsKey} value={draft.secrets.elevenLabsKey} onChange={draft.change}
          help={tr("Opcional: locução dos vídeos (plano Creator ou superior para uso comercial).", "Optional: video voiceover (Creator plan or higher for commercial use).")} />
        <SecretField label="OpenAI" field="openAiKey" info={config.secrets.openAiKey} value={draft.secrets.openAiKey} onChange={draft.change}
          help={tr("Textos e/ou imagens (conforme “Qual IA usar”); também reserva da locução. platform.openai.com/api-keys", "Text and/or images (per “Which AI to use”); also voiceover fallback. platform.openai.com/api-keys")} />
      </section>

      <section className="surface space-y-4 p-5 sm:p-6">
        <h3 className="font-semibold">{tr("Custos em créditos", "Costs in credits")}</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField label={tr("Imagem", "Image")} value={costs.image} onChange={(v) => setCosts({ ...costs, image: v })} />
          <NumberField label={tr("Vídeo (a cada 5 s)", "Video (per 5 s)")} value={costs.video} onChange={(v) => setCosts({ ...costs, video: v })} />
          <NumberField label={tr("Multiplicador Premium", "Premium multiplier")} value={costs.premiumMultiplier} step={0.5} onChange={(v) => setCosts({ ...costs, premiumMultiplier: v })} />
        </div>
      </section>

      <MarginSection costs={costs} setCosts={setCosts} models={models} plans={config.plans} hasFal={!!config.secrets.wanKey?.configured} />

      <section className="surface space-y-4 p-5 sm:p-6">
        <div>
          <h3 className="font-semibold">{tr("Qual IA usar", "Which AI to use")}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {tr("Escolha o provedor de cada tarefa. Se ele falhar ou estiver sem chave, o outro (com chave) entra como reserva automaticamente.", "Pick the provider for each task. If it fails or has no key, the other one (with a key) takes over automatically.")}
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {([["textProvider", tr("Textos, estratégia, moderação e revisões", "Text, strategy, moderation and reviews")], ["imageProvider", tr("Imagens e quadro de abertura dos vídeos", "Images and video opening frames")]] as const).map(([k, label]) => (
            <div key={k} className="space-y-1.5">
              <label className="label-base" htmlFor={`p-${k}`}>{label}</label>
              <select id={`p-${k}`} className="input-base" value={String(models[k] || config.defaultModels[k])} onChange={(e) => setModels({ ...models, [k]: e.target.value })}>
                {providerOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}{o.ok ? "" : tr(" (sem chave)", " (no key)")}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
        <div className="space-y-1.5">
          <label className="label-base" htmlFor="p-video">{tr("Vídeos", "Videos")}</label>
          <select
            id="p-video"
            className="input-base"
            value={VIDEO_MODEL_PRESETS.some((p) => p.id === models.video) ? String(models.video) : "custom"}
            onChange={(e) => e.target.value !== "custom" && setModels({ ...models, video: e.target.value, videoPremium: e.target.value })}
          >
            {VIDEO_MODEL_PRESETS.map((p) => {
              const veo = p.id.startsWith("veo-");
              const ok = veo ? config.secrets.geminiKey?.configured : config.secrets.wanKey?.configured;
              return <option key={p.id} value={p.id}>{p.label}{ok ? "" : veo ? tr(" (sem chave do Gemini)", " (no Gemini key)") : tr(" (sem chave da fal.ai)", " (no fal.ai key)")}</option>;
            })}
            <option value="custom">{tr("Outro modelo (campo “Vídeo” abaixo)", "Other model (“Video” field below)")}</option>
          </select>
          <p className="text-xs text-muted-foreground">
            {tr("Wan e Kling usam a chave da fal.ai; Veo usa a chave do Gemini (com faturamento ativo). Vale para padrão e premium; ajuste os modelos individualmente abaixo, se quiser.", "Wan and Kling use the fal.ai key; Veo uses the Gemini key (with billing on). Applies to standard and premium; tweak each model below if you want.")}
          </p>
        </div>
        <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-border p-4">
          <span>
            <span className="block font-medium">{tr("Lip-sync final nos vídeos com apresentador", "Final lip-sync on presenter videos")}</span>
            <span className="block text-sm text-muted-foreground">
              {tr(
                "Quando alguém fala no vídeo, um modelo especializado refaz a boca no vídeo inteiro, sincronizada com a locução desde o primeiro quadro. Recomendado: sem ele, o modelo de vídeo às vezes deixa a pessoa calada nos primeiros segundos. Custo extra na fal.ai por vídeo.",
                "When someone speaks in the video, a specialized model redoes the mouth across the whole video, synced with the voiceover from the first frame. Recommended: without it, the video model sometimes leaves the person silent in the first seconds. Extra fal.ai cost per video."
              )}
            </span>
          </span>
          <Switch checked={models.lipsyncEnabled !== false} onChange={(v) => setModels({ ...models, lipsyncEnabled: v })} />
        </label>
      </section>

      <section className="surface space-y-5 p-5 sm:p-6">
        <div>
          <h3 className="font-semibold">{tr("Modelos", "Models")}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{tr("Troque quando um provedor lançar uma versão nova, sem precisar de deploy.", "Change them when a provider ships a new version, no deploy needed.")}</p>
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
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {tr("Salvar", "Save")}
      </button>
    </div>
  );
}

// ---------------- Custo real e margem ----------------
const PRICE_FIELDS: { key: keyof ProviderPrices; label: [string, string]; step: number }[] = [
  { key: "videoPerSecond", label: ["Vídeo padrão (US$/s)", "Standard video (US$/s)"], step: 0.01 },
  { key: "videoPremiumPerSecond", label: ["Vídeo premium (US$/s)", "Premium video (US$/s)"], step: 0.01 },
  { key: "lipsyncPerSecond", label: ["Lip-sync final (US$/s)", "Final lip-sync (US$/s)"], step: 0.005 },
  { key: "image", label: ["Imagem padrão (US$)", "Standard image (US$)"], step: 0.005 },
  { key: "imagePremium", label: ["Imagem premium (US$)", "Premium image (US$)"], step: 0.005 },
  { key: "keyframe", label: ["Quadro de abertura do vídeo (US$)", "Video opening frame (US$)"], step: 0.005 },
  { key: "voicePerVideo", label: ["Locução de 20 s (US$)", "20 s voiceover (US$)"], step: 0.01 },
  { key: "textPerVariation", label: ["Textos/revisões por variação (US$)", "Text/reviews per variation (US$)"], step: 0.005 },
  { key: "brlPerUsd", label: ["Cotação R$ por US$", "BRL per USD rate"], step: 0.05 },
  { key: "eurPerUsd", label: ["Cotação € por US$", "EUR per USD rate"], step: 0.01 },
];

type Costs = ConfigResponse["costs"];

function MarginSection({ costs, setCosts, models, plans, hasFal }: {
  costs: Costs; setCosts: (c: Costs) => void; models: Record<string, string | boolean>; plans: Plan[]; hasFal: boolean;
}) {
  const tr = useTr();
  const [target, setTarget] = useState(60);
  const m = Object.fromEntries(Object.entries(models).map(([k, v]) => [k, String(v)])) as Parameters<typeof defaultProviderPrices>[0];
  const defaults = defaultProviderPrices(m);
  const prices = resolveProviderPrices(defaults, costs.usd);
  const revenue = worstRevenuePerCreditUsd(plans, prices);
  const lipsync = models.lipsyncEnabled !== false && hasFal;
  const est = (media: "IMAGE" | "VIDEO", premium: boolean, seconds?: number) =>
    estimateVariationUsd(prices, { media, premium, seconds, videoModel: premium ? m.videoPremium : m.video, lipsync });

  const rows = [
    { label: tr("Imagem", "Image"), credits: costs.image, cost: est("IMAGE", false) },
    { label: tr("Imagem premium", "Premium image"), credits: Math.ceil(costs.image * costs.premiumMultiplier), cost: est("IMAGE", true) },
    { label: tr("Vídeo 10 s", "10 s video"), credits: costs.video * 2, cost: est("VIDEO", false, 10) },
    { label: tr("Vídeo 20 s", "20 s video"), credits: costs.video * 4, cost: est("VIDEO", false, 20) },
    { label: tr("Vídeo 20 s premium", "20 s premium video"), credits: Math.ceil(costs.video * 4 * costs.premiumMultiplier), cost: est("VIDEO", true, 20) },
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
    toast.success(tr(
      `Sugestão aplicada (margem de ${target}%): imagem ${image}, vídeo ${video} a cada 5 s, premium ×${premiumMultiplier}. Revise e salve; ajuste também os textos dos pacotes ("~X vídeos").`,
      `Suggestion applied (${target}% margin): image ${image}, video ${video} per 5 s, premium ×${premiumMultiplier}. Review and save; also update the pack texts ("~X videos").`
    ), { duration: 10_000 });
  };

  return (
    <section className="surface space-y-5 p-5 sm:p-6">
      <div>
        <h3 className="font-semibold">{tr("Custo real e margem", "Real cost and margin")}</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {tr(
            `Estimativa do que cada geração custa nos provedores, comparada com o que o cliente paga no pacote de crédito mais barato${revenue ? ` (${plans[revenue.plan]?.name}: US$ ${revenue.usd.toFixed(4)} por crédito)` : ""}. Os valores vêm de uma tabela padrão por modelo; confira nas faturas dos provedores e corrija abaixo quando precisar. Vídeo conta os segundos realmente gerados (o Veo estende 8 + 7 + 7 s), o quadro de abertura, a locução${lipsync ? " e o lip-sync final" : ""}.`,
            `Estimate of what each generation costs at the providers, compared with what the customer pays in the cheapest-per-credit pack${revenue ? ` (${plans[revenue.plan]?.name}: US$ ${revenue.usd.toFixed(4)} per credit)` : ""}. Values come from a default table per model; check the provider invoices and correct them below when needed. Video counts the seconds actually generated (Veo extends 8 + 7 + 7 s), the opening frame, the voiceover${lipsync ? " and the final lip-sync" : ""}.`
          )}
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left text-xs text-muted-foreground">
            <tr>
              <th className="py-2 pr-4 font-medium">{tr("Geração", "Generation")}</th>
              <th className="py-2 pr-4 font-medium">{tr("Créditos", "Credits")}</th>
              <th className="py-2 pr-4 font-medium">{tr("Receita mínima", "Minimum revenue")}</th>
              <th className="py-2 pr-4 font-medium">{tr("Custo estimado", "Estimated cost")}</th>
              <th className="py-2 font-medium">{tr("Margem", "Margin")}</th>
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
                  <td className={`py-2 ${tone}`}>{margin === null ? "—" : `${Math.round(margin * 100)}%${margin < 0 ? tr(" (prejuízo)", " (loss)") : ""}`}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-36 space-y-1.5">
          <label className="label-base" htmlFor="m-target">{tr("Margem alvo (%)", "Target margin (%)")}</label>
          <input id="m-target" type="number" min={0} max={95} className="input-base tabular-nums" value={target} onChange={(e) => setTarget(Math.min(95, Math.max(0, Number(e.target.value))))} />
        </div>
        <button onClick={suggest} disabled={!revenue} className={buttonClass("outline")}>{tr("Sugerir créditos para essa margem", "Suggest credits for this margin")}</button>
      </div>
      <details className="rounded-xl border border-border p-4">
        <summary className="cursor-pointer text-sm font-medium">{tr("Corrigir o custo dos provedores", "Correct provider costs")}</summary>
        <p className="mt-2 text-xs text-muted-foreground">{tr("Em branco = valor padrão do modelo escolhido (mostrado no campo).", "Blank = default value for the chosen model (shown in the field).")}</p>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          {PRICE_FIELDS.map((f) => (
            <div key={f.key} className="space-y-1.5">
              <label className="label-base" htmlFor={`usd-${f.key}`}>{tr(f.label[0], f.label[1])}</label>
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
function stripeToast(result: StripeSync | null | undefined, okText: string, en = false) {
  const tr = (pt: string, english: string) => (en ? english : pt);
  if (!result?.configured) return toast.success(tr(`${okText}. Stripe não configurada: os pacotes serão criados nela quando a chave for salva em Pagamentos.`, `${okText}. Stripe not set up: packs will be created there once the key is saved in Payments.`));
  const where = result.mode === "live" ? tr("produção", "live") : tr("teste", "test");
  if (result.errors.length) {
    return toast.error(tr(`${okText}, mas a Stripe (${where}) recusou: ${result.errors.join(" · ")}`, `${okText}, but Stripe (${where}) rejected: ${result.errors.join(" · ")}`), { duration: 12_000 });
  }
  toast.success(tr(`${okText} e sincronizados com a Stripe (${where}): ${result.synced} pacote(s).`, `${okText} and synced with Stripe (${where}): ${result.synced} pack(s).`));
}

function PlansTab({ initial, stripeMode, onSaved }: { initial: Plan[]; stripeMode: "test" | "live" | null; onSaved: () => void }) {
  const tr = useTr();
  const en = useLocale() === "en";
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
      stripeToast(res.stripe, tr("Pacotes salvos", "Packs saved"), en);
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
      stripeToast(await api("/api/admin/stripe/sync", "POST"), tr("Sincronização concluída", "Sync complete"), en);
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
        {tr("Na Stripe", "In Stripe")} ({stripeMode === "live" ? tr("produção", "live") : tr("teste", "test")}) <ExternalLink className="h-3 w-3" />
      </a>
    ) : (
      <span className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
        {saved ? tr("Ainda não está na Stripe", "Not in Stripe yet") : tr("Novo: vai para a Stripe ao salvar", "New: goes to Stripe on save")}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      <div className="surface flex flex-wrap items-center gap-3 p-4 text-sm">
        <p className="min-w-0 flex-1 text-muted-foreground">
          {stripeMode
            ? tr(
                `Ao salvar, cada pacote vira um produto na Stripe (${stripeMode === "live" ? "produção" : "teste"}) com um preço por moeda. Mudar o preço cria um preço novo e arquiva o antigo; ocultar ou remover arquiva o produto. Quem já pagou não é afetado.`,
                `On save, each pack becomes a Stripe product (${stripeMode}) with one price per currency. Changing a price creates a new one and archives the old; hiding or removing archives the product. Past buyers aren't affected.`
              )
            : tr("Configure a Stripe em Pagamentos para os pacotes serem criados lá automaticamente. O Mercado Pago não precisa de cadastro de produto.", "Set up Stripe in Payments so packs are created there automatically. Mercado Pago needs no product setup.")}
        </p>
        {stripeMode && (
          <button onClick={syncNow} disabled={syncing} className={buttonClass("outline", "sm")}>
            {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} {tr("Sincronizar agora", "Sync now")}
          </button>
        )}
      </div>
      {plans.map((p, i) => (
        <div key={i} className={`surface space-y-4 p-5 ${p.isFeatured ? "border-brand" : ""}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold">{p.name || tr("Novo pacote", "New pack")}</p>
              {stripeBadge(p)}
            </div>
            <button onClick={() => setPlans(plans.filter((_, j) => j !== i))} className={buttonClass("ghost", "sm")}><Trash2 className="h-3.5 w-3.5" /> {tr("Remover", "Remove")}</button>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <TextField label={tr("ID (não mude após vender)", "ID (don't change after selling)")} value={p.id} onChange={(v) => update(i, { id: v })} />
            <TextField label={tr("Nome", "Name")} value={p.name} onChange={(v) => update(i, { name: v })} />
            <div className="space-y-1.5">
              <label className="label-base">{tr("Tipo", "Type")}</label>
              <select className="input-base" value={p.interval || "once"} onChange={(e) => update(i, { interval: e.target.value as "once" | "month" })}>
                <option value="once">{tr("Pacote avulso", "One-off pack")}</option>
                <option value="month">{tr("Assinatura mensal (Stripe)", "Monthly subscription (Stripe)")}</option>
              </select>
            </div>
            <NumberField label={p.interval === "month" ? tr("Créditos por mês", "Credits per month") : tr("Créditos", "Credits")} value={p.credits} onChange={(v) => update(i, { credits: v })} />
            <NumberField label={tr("Preço R$", "Price R$")} value={p.price_brl} step={0.01} onChange={(v) => update(i, { price_brl: v })} />
            <NumberField label={tr("Preço US$", "Price US$")} value={p.price_usd} step={0.01} onChange={(v) => update(i, { price_usd: v })} />
            <NumberField label={tr("Preço € (opcional)", "Price € (optional)")} value={p.price_eur || 0} step={0.01} onChange={(v) => update(i, { price_eur: v || null })} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField label={tr("Descrição (PT)", "Description (PT)")} value={p.description || ""} onChange={(v) => update(i, { description: v })} />
            <TextField label={tr("Descrição (EN)", "Description (EN)")} value={p.description_en || ""} onChange={(v) => update(i, { description_en: v })} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="label-base">{tr("Benefícios PT (um por linha)", "Benefits PT (one per line)")}</label>
              <textarea className="input-base min-h-24 py-2" value={p.features_pt.join("\n")} onChange={(e) => update(i, { features_pt: e.target.value.split("\n") })} />
            </div>
            <div className="space-y-1.5">
              <label className="label-base">{tr("Benefícios EN (um por linha)", "Benefits EN (one per line)")}</label>
              <textarea className="input-base min-h-24 py-2" value={p.features_en.join("\n")} onChange={(e) => update(i, { features_en: e.target.value.split("\n") })} />
            </div>
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={!!p.isFeatured} onChange={(e) => update(i, { isFeatured: e.target.checked })} /> {tr("Destacado", "Featured")}</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={!!p.isHidden} onChange={(e) => update(i, { isHidden: e.target.checked })} /> {tr("Oculto", "Hidden")}</label>
          </div>
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setPlans([...plans, { id: `pack_${Date.now().toString(36)}`, name: "", price_brl: 0, price_usd: 0, credits: 100, interval: "once", features_pt: [], features_en: [] }])} className={buttonClass("outline")}>
          <Plus className="h-4 w-4" /> {tr("Adicionar pacote", "Add pack")}
        </button>
        <button onClick={save} disabled={saving} className={buttonClass("brand")}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {tr("Salvar pacotes", "Save packs")}
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
  const tr = useTr();
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
      toast.success(data?.stripeMode ? tr("Cupom criado (também na Stripe)", "Coupon created (also in Stripe)") : tr("Cupom criado", "Coupon created"));
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
    if (!confirm(c.redemptions
      ? tr(`O cupom ${c.code} já foi usado: ele será desativado (fica no histórico).`, `Coupon ${c.code} was already used: it will be deactivated (kept in history).`)
      : tr(`Apagar o cupom ${c.code}?`, `Delete coupon ${c.code}?`))) return;
    try {
      const res = await api(`/api/admin/coupons/${c.id}`, "DELETE");
      toast.success(res.result === "deleted" ? tr("Cupom apagado", "Coupon deleted") : tr("Cupom desativado", "Coupon deactivated"));
      load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const discountLabel = (c: AdminCoupon) => (c.percentOff ? `${c.percentOff}%` : formatMoney(c.amountOff || 0, c.currency || "BRL"));
  const planNames = (ids: string[]) => (ids.length ? ids.map((id) => plans.find((p) => p.id === id)?.name || id).join(", ") : tr("Todos", "All"));

  return (
    <div className="space-y-5">
      <section className="surface space-y-4 p-5 sm:p-6">
        <div>
          <h3 className="font-semibold">{tr("Novo cupom", "New coupon")}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {tr(
              `O cliente digita o código em Comprar créditos. Vale no Mercado Pago e na Stripe${data?.stripeMode ? " (onde também é criado como cupom e código promocional)" : ""}. Depois de criado, desconto, validade e limite não mudam: para alterar, desative e crie outro código.`,
              `Customers enter the code in Buy credits. Works on Mercado Pago and Stripe${data?.stripeMode ? " (where it is also created as a coupon and promotion code)" : ""}. Once created, discount, expiry and limit can't change: to change them, deactivate and create another code.`
            )}
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <label className="label-base" htmlFor="c-code">{tr("Código", "Code")}</label>
            <input id="c-code" className="input-base font-mono uppercase" maxLength={40} placeholder="BEMVINDO10" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "") })} />
          </div>
          <div className="space-y-1.5">
            <label className="label-base" htmlFor="c-kind">{tr("Tipo de desconto", "Discount type")}</label>
            <select id="c-kind" className="input-base" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as "percent" | "amount" })}>
              <option value="percent">{tr("Porcentagem", "Percentage")}</option>
              <option value="amount">{tr("Valor fixo", "Fixed amount")}</option>
            </select>
          </div>
          <div className="flex gap-2">
            <div className="min-w-0 flex-1 space-y-1.5">
              <label className="label-base" htmlFor="c-value">{form.kind === "percent" ? tr("Desconto (%)", "Discount (%)") : tr("Desconto", "Discount")}</label>
              <input id="c-value" type="number" min={form.kind === "percent" ? 1 : 0.01} max={form.kind === "percent" ? 95 : undefined} step={form.kind === "percent" ? 1 : 0.01}
                className="input-base tabular-nums" value={form.value} onChange={(e) => setForm({ ...form, value: Number(e.target.value) })} />
            </div>
            {form.kind === "amount" && (
              <div className="w-24 space-y-1.5">
                <label className="label-base" htmlFor="c-cur">{tr("Moeda", "Currency")}</label>
                <select id="c-cur" className="input-base" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
                  <option>BRL</option><option>USD</option><option>EUR</option>
                </select>
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <label className="label-base" htmlFor="c-max">{tr("Limite de usos (opcional)", "Usage limit (optional)")}</label>
            <input id="c-max" type="number" min={1} className="input-base tabular-nums" placeholder={tr("Sem limite", "No limit")} value={form.maxRedemptions} onChange={(e) => setForm({ ...form, maxRedemptions: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <label className="label-base" htmlFor="c-exp">{tr("Válido até (opcional)", "Valid until (optional)")}</label>
            <input id="c-exp" type="date" className="input-base" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} />
          </div>
        </div>
        <fieldset className="space-y-2">
          <legend className="label-base">{tr("Pacotes em que vale (nenhum marcado = todos)", "Packs it applies to (none checked = all)")}</legend>
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
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} {tr("Criar cupom", "Create coupon")}
        </button>
      </section>

      <section className="surface overflow-x-auto">
        <h3 className="border-b border-border px-5 py-3 font-semibold">{tr("Cupons", "Coupons")}</h3>
        {!data ? <Loading /> : data.coupons.length === 0 ? <p className="p-5 text-sm text-muted-foreground">{tr("Nenhum cupom ainda.", "No coupons yet.")}</p> : (
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-5 py-2 font-medium">{tr("Código", "Code")}</th>
                <th className="px-5 py-2 font-medium">{tr("Desconto", "Discount")}</th>
                <th className="px-5 py-2 font-medium">{tr("Pacotes", "Packs")}</th>
                <th className="px-5 py-2 font-medium">{tr("Usos", "Uses")}</th>
                <th className="px-5 py-2 font-medium">{tr("Validade", "Expires")}</th>
                <th className="px-5 py-2 font-medium">{tr("Ativo", "Active")}</th>
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
                          {c.inStripe ? "Stripe" : tr("só no Vysify", "Vysify only")}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 tabular-nums">{discountLabel(c)}</td>
                    <td className="px-5 py-3">{planNames(c.planIds)}</td>
                    <td className="px-5 py-3 tabular-nums">{c.redemptions}{c.maxRedemptions ? ` / ${c.maxRedemptions}` : ""}</td>
                    <td className="whitespace-nowrap px-5 py-3">{c.expiresAt ? `${formatDateTime(c.expiresAt)}${expired ? tr(" (expirado)", " (expired)") : ""}` : tr("Sem prazo", "No expiry")}</td>
                    <td className="px-5 py-3"><Switch checked={c.active} onChange={() => toggle(c)} /></td>
                    <td className="px-5 py-3 text-right">
                      <button onClick={() => remove(c)} className={buttonClass("ghost", "sm")} aria-label={tr(`Apagar ${c.code}`, `Delete ${c.code}`)}><Trash2 className="h-3.5 w-3.5" /></button>
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
  const tr = useTr();
  const [trial, setTrial] = useState(initial);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await api("/api/admin/config", "PUT", { freeTrial: { ...trial, planVisible: trial.enabled && trial.planVisible } });
      toast.success(trial.enabled ? tr("Oferta de teste grátis salva", "Free trial offer saved") : tr("Ofertas grátis desativadas", "Free offers turned off"));
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
          <h3 className="font-semibold">{tr("Ofertas de teste grátis", "Free trial offers")}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {tr("Desligadas por padrão. Enquanto estiverem desligadas, nenhum texto de “grátis” aparece no site e novas contas começam com 0 créditos.", "Off by default. While off, no “free” text appears on the site and new accounts start with 0 credits.")}
          </p>
        </div>

        <div className="flex items-start justify-between gap-4 rounded-xl border border-border p-4">
          <div>
            <p className="font-medium">{tr("Dar créditos grátis no cadastro", "Give free credits at signup")}</p>
            <p className="text-sm text-muted-foreground">{tr("Cada conta nova recebe créditos para testar. Ativa o selo “créditos grátis” e o botão “Começar grátis”.", "Each new account gets credits to try. Enables the “free credits” badge and the “Start free” button.")}</p>
          </div>
          <Switch checked={trial.enabled} onChange={(v) => setTrial({ ...trial, enabled: v })} />
        </div>

        {trial.enabled && (
          <div className="max-w-xs">
            <NumberField label={tr("Créditos por conta nova", "Credits per new account")} value={trial.credits} onChange={(v) => setTrial({ ...trial, credits: Math.max(1, Math.round(v)) })} />
          </div>
        )}

        <div className="flex items-start justify-between gap-4 rounded-xl border border-border p-4">
          <div>
            <p className="font-medium">{tr("Mostrar plano “Grátis” na página inicial", "Show a “Free” plan on the home page")}</p>
            <p className="text-sm text-muted-foreground">
              {trial.enabled
                ? tr(`Exibe um card “Grátis · ${trial.credits} créditos” ao lado dos pacotes pagos.`, `Shows a “Free · ${trial.credits} credits” card next to the paid packs.`)
                : tr("Disponível apenas com os créditos grátis ativados (para não anunciar algo que não existe).", "Only available with free credits on (so nothing that doesn't exist is advertised).")}
            </p>
          </div>
          <Switch checked={trial.enabled && trial.planVisible} disabled={!trial.enabled} onChange={(v) => setTrial({ ...trial, planVisible: v })} />
        </div>

        <p className="text-xs text-muted-foreground">{tr("Alterações valem para novos cadastros. Contas já criadas não ganham nem perdem créditos.", "Changes apply to new signups. Existing accounts don't gain or lose credits.")}</p>
      </section>

      <button onClick={save} disabled={saving} className={buttonClass("brand", "lg")}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {tr("Salvar", "Save")}
      </button>
    </div>
  );
}

// ---------------- Integrações (Meta) ----------------
function CopyRow({ label, value }: { label: string; value: string }) {
  const tr = useTr();
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2">
        <code className="flex-1 break-all font-mono text-xs">{value}</code>
        <button type="button" onClick={() => { navigator.clipboard.writeText(value); toast.success(tr("Copiado", "Copied")); }} className="rounded-md p-1 text-muted-foreground hover:text-foreground" aria-label={tr(`Copiar ${label}`, `Copy ${label}`)}>
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
            <h3 className="font-semibold">{tr("App da Meta (Instagram + Facebook)", "Meta app (Instagram + Facebook)")}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{tr("Em developers.facebook.com › seu app › Configurações › Básico.", "At developers.facebook.com › your app › Settings › Basic.")}</p>
          </div>
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${configured ? "bg-success/12 text-success" : "bg-muted text-muted-foreground"}`}>
            {configured ? tr("Ativo para clientes", "Live for customers") : tr("Não configurado", "Not set up")}
          </span>
        </div>
        <SecretField label="App ID" field="metaAppId" info={config.secrets.metaAppId} value={draft.secrets.metaAppId} onChange={draft.change} />
        <SecretField label="App Secret" field="metaAppSecret" info={config.secrets.metaAppSecret} value={draft.secrets.metaAppSecret} onChange={draft.change}
          help={tr("Enquanto o app estiver em modo de desenvolvimento, só quem tem função no app (admin, desenvolvedor, testador) consegue conectar.", "While the app is in development mode, only people with an app role (admin, developer, tester) can connect.")} />
        <button onClick={save} disabled={saving} className={buttonClass("brand")}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {tr("Salvar", "Save")}
        </button>
      </section>

      <section className="surface space-y-3 p-5 sm:p-6">
        <h3 className="font-semibold">{tr("URLs para cadastrar no painel da Meta", "URLs to register in the Meta dashboard")}</h3>
        <CopyRow label={tr("URI de redirecionamento do OAuth válido (Login do Facebook › Configurações)", "Valid OAuth redirect URI (Facebook Login › Settings)")} value={`${baseUrl}/api/integrations/meta/callback`} />
        <CopyRow label={tr("URL de retorno de chamada para cancelar autorização", "Deauthorize callback URL")} value={`${baseUrl}/api/integrations/meta/deauthorize`} />
        <CopyRow label={tr("URL de solicitação de exclusão de dados", "Data deletion request URL")} value={`${baseUrl}/api/integrations/meta/data-deletion`} />
        <CopyRow label={tr("URL da Política de Privacidade", "Privacy Policy URL")} value={`${baseUrl}/legal/privacy`} />
        <CopyRow label={tr("URL dos Termos de Serviço", "Terms of Service URL")} value={`${baseUrl}/legal/terms`} />
        <CopyRow label={tr("Domínio do app", "App domain")} value={baseUrl.replace(/^https?:\/\//, "")} />
        <p className="text-xs text-muted-foreground">{tr("Passo a passo completo, incluindo o App Review: docs/META_SETUP.md no repositório.", "Full walkthrough, including App Review: docs/META_SETUP.md in the repository.")}</p>
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
  const tr = useTr();
  const draft = useSecretDraft();
  const [enabled, setEnabled] = useState(config.googleLogin.enabled);
  const [saving, setSaving] = useState(false);
  const hasCredentials = config.secrets.googleClientId?.configured && config.secrets.googleClientSecret?.configured;

  const save = async () => {
    setSaving(true);
    try {
      await api("/api/admin/config", "PUT", { secrets: draft.payload(), googleLogin: { enabled } });
      toast.success(enabled ? tr("Login com Google salvo", "Google login saved") : tr("Login com Google desligado", "Google login turned off"));
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
          <h3 className="font-semibold">{tr("Login com Google", "Google login")}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {tr("Mostra “Continuar com Google” no login e no cadastro. Vale na hora, sem redeploy (até 15 s para todos os servidores).", "Shows “Continue with Google” on sign-in and sign-up. Takes effect right away, no redeploy (up to 15 s for every server).")}
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${config.googleLogin.active ? "bg-success/12 text-success" : "bg-muted text-muted-foreground"}`}>
          {config.googleLogin.active ? tr("Visível para clientes", "Visible to customers") : !hasCredentials ? tr("Sem credenciais", "No credentials") : tr("Desligado", "Off")}
        </span>
      </div>

      <div className="flex items-start justify-between gap-4 rounded-xl border border-border p-4">
        <div>
          <p className="font-medium">{tr("Exibir botão do Google", "Show the Google button")}</p>
          <p className="text-sm text-muted-foreground">
            {hasCredentials
              ? tr("Desligar não afeta quem já tem conta: essas pessoas entram com e-mail e senha ou criam uma senha em “Esqueci minha senha”.", "Turning it off doesn't affect existing accounts: they sign in with email and password or create one via “Forgot password”.")
              : tr("Preencha o Client ID e o Client Secret abaixo para o botão aparecer.", "Fill in the Client ID and Client Secret below for the button to show up.")}
          </p>
        </div>
        <Switch checked={enabled} onChange={setEnabled} />
      </div>

      <SecretField label="Client ID" field="googleClientId" info={config.secrets.googleClientId} value={draft.secrets.googleClientId} onChange={draft.change} />
      <SecretField label="Client Secret" field="googleClientSecret" info={config.secrets.googleClientSecret} value={draft.secrets.googleClientSecret} onChange={draft.change}
        help={tr("Google Cloud Console › APIs e serviços › Credenciais › ID do cliente OAuth (Aplicativo da Web).", "Google Cloud Console › APIs & Services › Credentials › OAuth client ID (Web application).")} />
      <CopyRow label={tr("URI de redirecionamento autorizado (cadastre no Google Cloud)", "Authorized redirect URI (register it in Google Cloud)")} value={`${baseUrl}/api/auth/callback/google`} />

      <button onClick={save} disabled={saving} className={buttonClass("brand")}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {tr("Salvar", "Save")}
      </button>
    </section>
  );
}

// ---------------- Configurações gerais ----------------
function SettingInput({ label, value, inUse, onChange, help, type = "text" }: {
  label: string; value: string; inUse?: string | null; onChange: (v: string) => void; help?: string; type?: string;
}) {
  const tr = useTr();
  return (
    <div className="space-y-1.5">
      <label className="label-base">{label}</label>
      <input className="input-base" type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={inUse || ""} />
      {!value && inUse && <p className="text-xs text-muted-foreground">{tr("Em uso (variável de ambiente ou padrão)", "In use (environment variable or default)")}: {inUse}</p>}
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
  const tr = useTr();
  const eff = config.effectiveSettings;
  const draft = useSecretDraft();
  const [signupsEnabled, setSignupsEnabled] = useState(config.signupsEnabled);
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(Object.entries(config.settings).filter(([, v]) => typeof v === "string")) as Record<string, string>
  );
  const [autoTax, setAutoTax] = useState(eff.stripeAutomaticTax);
  const [maxMembers, setMaxMembers] = useState(eff.maxMembers);
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
        // As configurações são salvas inteiras: mantém as que não são texto (gateway, fiscal...) e aplica as desta aba.
        settings: { ...config.settings, ...values, stripeAutomaticTax: autoTax, maxMembers: Math.min(200, Math.max(1, Math.round(maxMembers))) },
      });
      toast.success(tr("Configurações salvas. Valem em até 15 segundos, sem redeploy.", "Settings saved. They apply within 15 seconds, no redeploy."));
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
        <h3 className="font-semibold">{tr("Cadastros e equipes", "Sign-ups and teams")}</h3>
        <SettingSwitch title={tr("Aceitar novas contas", "Accept new accounts")} checked={signupsEnabled} onChange={setSignupsEnabled}
          text={tr("Desligado: a página de cadastro mostra “Cadastros fechados” e o login com Google não cria contas novas. Quem já tem conta continua entrando normalmente.", "Off: the sign-up page shows “Sign-ups closed” and Google login doesn't create new accounts. Existing users keep signing in normally.")} />
        <div className="max-w-xs">
          <NumberField label={tr("Pessoas por workspace (com o dono)", "People per workspace (incl. owner)")} value={maxMembers} onChange={setMaxMembers} />
        </div>
      </section>

      <section className="surface space-y-4 p-5 sm:p-6">
        <div>
          <h3 className="font-semibold">{tr("Suporte no WhatsApp", "WhatsApp support")}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {tr("Aparece para os clientes no menu do painel e no rodapé do site, com o status “online” dentro do horário e a hora em que o atendimento volta fora dele. Horário de Brasília; pode passar da meia-noite (ex.: 07:00 às 02:30).", "Shown to customers in the app menu and the site footer, with an “online” status during hours and when support is back outside them. Brasília time; may cross midnight (e.g. 07:00 to 02:30).")}
          </p>
        </div>
        <SettingInput label={tr("Número do WhatsApp (com DDI e DDD, só números)", "WhatsApp number (country and area code, digits only)")} value={v("supportWhatsapp")} inUse={eff.support.whatsapp} onChange={(val) => set("supportWhatsapp")(val.replace(/\D/g, ""))}
          help={tr("Ex.: 5511999998888. Vazio = o botão de suporte não aparece.", "E.g. 5511999998888. Empty = the support button doesn't show.")} />
        <div className="grid gap-4 sm:grid-cols-2">
          <SettingInput label={tr("Início do atendimento", "Support opens at")} type="time" value={v("supportStart") || eff.support.start} onChange={set("supportStart")} />
          <SettingInput label={tr("Fim do atendimento", "Support closes at")} type="time" value={v("supportEnd") || eff.support.end} onChange={set("supportEnd")} />
        </div>
        <fieldset className="space-y-2">
          <legend className="label-base">{tr("Dias em que o atendimento começa", "Days support opens")}</legend>
          <div className="flex flex-wrap gap-3 text-sm">
            {[tr("Dom", "Sun"), tr("Seg", "Mon"), tr("Ter", "Tue"), tr("Qua", "Wed"), tr("Qui", "Thu"), tr("Sex", "Fri"), tr("Sáb", "Sat")].map((label, d) => {
              const days = (v("supportDays") || eff.support.days.join("")).split("").map(Number);
              return (
                <label key={d} className="flex items-center gap-1.5">
                  <input type="checkbox" checked={days.includes(d)}
                    onChange={(e) => set("supportDays")((e.target.checked ? [...days, d] : days.filter((x) => x !== d)).sort().join(""))} />
                  {label}
                </label>
              );
            })}
          </div>
        </fieldset>
        <SettingInput label={tr("Mensagem inicial", "Opening message")} value={v("supportMessage")} inUse={eff.support.message} onChange={set("supportMessage")}
          help={tr("Já vem escrita quando o cliente abre o WhatsApp (o e-mail da conta é adicionado sozinho).", "Prefilled when the customer opens WhatsApp (the account email is added automatically).")} />
      </section>

      <section className="surface space-y-4 p-5 sm:p-6">
        <div>
          <h3 className="font-semibold">{tr("Dados da empresa", "Company details")}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {tr("Exibidos nos Termos, na Política de Privacidade e no rodapé das páginas legais. A razão social, o CNPJ, o endereço e um e-mail de contato são obrigatórios (Decreto 7.962/2013 e LGPD).", "Shown in the Terms, the Privacy Policy and the legal pages' footer. Legal name, CNPJ (tax id), address and a contact email are required in Brazil (Decree 7.962/2013 and LGPD).")}
          </p>
          {missingCompany.length > 0 && (
            <p className="mt-2 rounded-xl bg-warning/12 p-3 text-sm text-warning">{tr("Faltam dados obrigatórios: hoje os documentos legais mostram textos como “[CNPJ]”. Preencha antes de abrir para clientes.", "Required details are missing: the legal documents currently show placeholders like “[CNPJ]”. Fill them in before opening to customers.")}</p>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <SettingInput label={tr("Razão social", "Legal name")} value={v("companyName")} inUse={placeholder(eff.company.name)} onChange={set("companyName")} />
          <SettingInput label={tr("CNPJ", "CNPJ (tax id)")} value={v("companyCnpj")} inUse={placeholder(eff.company.cnpj)} onChange={set("companyCnpj")} />
        </div>
        <SettingInput label={tr("Endereço completo", "Full address")} value={v("companyAddress")} inUse={placeholder(eff.company.address)} onChange={set("companyAddress")} />
        <div className="grid gap-4 sm:grid-cols-2">
          <SettingInput label={tr("E-mail de suporte", "Support email")} type="email" value={v("supportEmail")} inUse={eff.company.supportEmail} onChange={set("supportEmail")} />
          <SettingInput label={tr("E-mail de privacidade (encarregado/DPO)", "Privacy email (DPO)")} type="email" value={v("privacyEmail")} inUse={eff.company.privacyEmail} onChange={set("privacyEmail")} />
        </div>
        <SettingInput label={tr("Representante na União Europeia (GDPR art. 27)", "EU representative (GDPR art. 27)")} value={v("euRepresentative")} inUse={eff.company.euRepresentative} onChange={set("euRepresentative")}
          help={tr("Nome e endereço do representante contratado. Vazio = a seção não aparece na Privacy Policy em inglês.", "Name and address of the appointed representative. Empty = the section doesn't appear in the English Privacy Policy.")} />
        <SettingInput label={tr("Representante no Reino Unido (UK GDPR)", "UK representative (UK GDPR)")} value={v("ukRepresentative")} inUse={eff.company.ukRepresentative} onChange={set("ukRepresentative")} />
      </section>

      <section className="surface space-y-4 p-5 sm:p-6">
        <div>
          <h3 className="font-semibold">{tr("E-mails (Resend)", "Emails (Resend)")}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{tr("Confirmação de e-mail, recuperação de senha, boas-vindas, recibos, convites, avisos de campanha pronta e alertas para os admins.", "Email confirmation, password reset, welcome, receipts, invitations, campaign-ready notices and admin alerts.")}</p>
        </div>
        <SecretField label={tr("API key do Resend", "Resend API key")} field="resendKey" info={config.secrets.resendKey} value={draft.secrets.resendKey} onChange={draft.change}
          help={tr("resend.com › API Keys. Sem ela, nenhum e-mail é enviado (os links só aparecem no log do servidor).", "resend.com › API Keys. Without it no email is sent (links only show up in the server log).")} />
        <SettingInput label={tr("Remetente", "Sender")} value={v("emailFrom")} inUse={eff.emailFrom} onChange={set("emailFrom")}
          help={tr("Formato: Vysify <nao-responda@seudominio.com>. O domínio precisa estar verificado no Resend.", "Format: Vysify <no-reply@yourdomain.com>. The domain must be verified in Resend.")} />
      </section>

      <section className="surface space-y-4 p-5 sm:p-6">
        <div>
          <h3 className="font-semibold">{tr("Análise e marketing", "Analytics and marketing")}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {tr("Só carregam depois que o visitante aceita no banner de cookies (LGPD/GDPR). Com os dois vazios, o banner nem aparece.", "They only load after the visitor accepts the cookie banner (LGPD/GDPR). With both empty, the banner doesn't even show.")}
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <SettingInput label={tr("Google Analytics 4 (ID de medição)", "Google Analytics 4 (measurement ID)")} value={v("gaId")} inUse={eff.trackers.gaId} onChange={set("gaId")} help={tr("Formato G-XXXXXXX.", "Format G-XXXXXXX.")} />
          <SettingInput label={tr("Pixel da Meta (ID)", "Meta Pixel (ID)")} value={v("metaPixelId")} inUse={eff.trackers.metaPixelId} onChange={set("metaPixelId")} help={tr("Apenas números.", "Digits only.")} />
        </div>
      </section>

      <section className="surface space-y-4 p-5 sm:p-6">
        <h3 className="font-semibold">{tr("Impostos (Stripe)", "Taxes (Stripe)")}</h3>
        <SettingSwitch title={tr("Calcular impostos automaticamente (Stripe Tax)", "Calculate taxes automatically (Stripe Tax)")} checked={autoTax} onChange={setAutoTax}
          text={tr("Soma IVA/VAT/sales tax no checkout internacional conforme o endereço do cliente. Só ligue depois de ativar o Stripe Tax e fazer os registros fiscais no painel da Stripe.", "Adds VAT/sales tax at international checkout based on the customer's address. Only turn on after enabling Stripe Tax and registering in the Stripe dashboard.")} />
      </section>

      <section className="surface space-y-4 p-5 sm:p-6">
        <div>
          <h3 className="font-semibold">{tr("Avançado", "Advanced")}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{tr("Raramente precisa mudar. Vazio = padrão.", "Rarely needs changing. Empty = default.")}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <SettingInput label={tr("Meta: ID da configuração do login", "Meta: login configuration ID")} value={v("metaLoginConfigId")} inUse={eff.meta.loginConfigId} onChange={set("metaLoginConfigId")}
            help={tr("“Login do Facebook para Empresas”. Vazio = usa as permissões padrão.", "“Facebook Login for Business”. Empty = uses the default permissions.")} />
          <SettingInput label={tr("Meta: versão da Graph API", "Meta: Graph API version")} value={v("metaGraphVersion")} inUse={eff.meta.graphVersion} onChange={set("metaGraphVersion")} help={tr("Ex.: v23.0", "E.g. v23.0")} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <SettingInput label={tr("ElevenLabs: voz feminina / padrão", "ElevenLabs: female / default voice")} value={v("elevenLabsVoiceId")} inUse={eff.elevenLabsVoiceId} onChange={set("elevenLabsVoiceId")} />
          <SettingInput label={tr("ElevenLabs: voz masculina", "ElevenLabs: male voice")} value={v("elevenLabsVoiceIdMale")} inUse={eff.elevenLabsVoiceIdMale} onChange={set("elevenLabsVoiceIdMale")}
            help={tr("Usada quando quem apresenta o produto no vídeo é um homem.", "Used when the person presenting the product in the video is a man.")} />
        </div>
      </section>

      <button onClick={save} disabled={saving} className={buttonClass("brand", "lg")}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {tr("Salvar", "Save")}
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
  const tr = useTr();
  const [broken, setBroken] = useState(false);
  return (
    <figure className="w-16 shrink-0">
      {broken ? (
        <div className="flex aspect-square w-16 flex-col items-center justify-center rounded-lg bg-muted text-[10px] text-muted-foreground" title={tr("O arquivo foi apagado; o hash continua no registro.", "The file was deleted; the hash stays in the record.")}>
          <ImageOff className="h-4 w-4" /> {tr("apagada", "deleted")}
        </div>
      ) : (
        <a href={url} target="_blank" rel="noopener">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={tr(`Imagem ${n}`, `Image ${n}`)} onError={() => setBroken(true)} className="aspect-square w-16 rounded-lg border border-border bg-muted object-cover" />
        </a>
      )}
      <figcaption className="mt-0.5 text-center text-[10px] text-muted-foreground">{tr("Imagem", "Image")} {n}</figcaption>
    </figure>
  );
}

function ImageRightsTab() {
  const tr = useTr();
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
        <h3 className="flex items-center gap-2 font-semibold"><ShieldCheck className="h-4 w-4 text-brand" /> {tr("Autorizações de uso de imagem", "Image use authorizations")}</h3>
        <p className="text-sm text-muted-foreground">
          {tr("Toda vez que um cliente anexa imagens de referência, ele declara ter autorização para usar a imagem das pessoas nas fotos. Cada declaração fica registrada aqui com data e hora, o texto exato que ele aceitou, IP, navegador e a impressão digital (SHA-256) de cada imagem.", "Every time a customer attaches reference images, they declare they're authorized to use the image of the people in the photos. Each declaration is recorded here with date and time, the exact text accepted, IP, browser and the fingerprint (SHA-256) of each image.")}
        </p>
        <p className="text-xs text-muted-foreground">
          {tr("Use estes registros só para defesa da plataforma (reclamações, processos, pedidos de autoridades). Base legal: LGPD art. 7º, VI, e art. 16; Marco Civil art. 15. Guardados por 5 anos, mesmo se a campanha ou a conta forem apagadas, e depois excluídos automaticamente. Cada consulta fica no log do servidor.", "Use these records only to defend the platform (complaints, lawsuits, authority requests). Legal basis: LGPD art. 7, VI and art. 16; Marco Civil art. 15. Kept for 5 years, even if the campaign or account is deleted, then removed automatically. Every lookup is logged on the server.")}
        </p>
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-60 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input className="input-base pl-9" placeholder={tr("Buscar por e-mail, nome, campanha ou código do registro", "Search by email, name, campaign or record code")} value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        </div>
        <a href={`/api/admin/image-rights?format=csv&q=${encodeURIComponent(q)}`} className={buttonClass("outline")}>
          <Download className="h-4 w-4" /> {tr("Exportar CSV", "Export CSV")}
        </a>
      </div>

      {!data ? <Loading /> : data.items.length === 0 ? (
        <div className="surface p-8 text-center text-sm text-muted-foreground">{q ? tr("Nenhum registro encontrado para essa busca.", "No records match this search.") : tr("Nenhuma declaração registrada ainda.", "No declarations recorded yet.")}</div>
      ) : (
        <div className="surface divide-y divide-border">
          {data.items.map((r) => (
            <div key={r.id} className="p-4">
              <button type="button" onClick={() => setOpen(open === r.id ? null : r.id)} className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 text-left" aria-expanded={open === r.id}>
                <span className="w-36 shrink-0 text-sm tabular-nums">{formatDateTime(r.createdAt)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {r.userEmail}
                    {!r.accountExists && <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[10px] font-normal text-muted-foreground">{tr("conta excluída", "account deleted")}</span>}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {r.campaignName || "—"}
                    {!r.campaignExists && tr(" · campanha apagada", " · campaign deleted")}
                  </span>
                </span>
                <span className="text-xs text-muted-foreground">{r.imageUrls.length} {r.imageUrls.length === 1 ? tr("imagem", "image") : tr("imagens", "images")}</span>
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition ${open === r.id ? "rotate-180" : ""}`} />
              </button>

              {open === r.id && (
                <div className="mt-4 space-y-4 rounded-xl bg-muted/40 p-4 text-sm">
                  <div className="flex flex-wrap gap-3">
                    {r.imageUrls.map((u, i) => <RefThumb key={u} url={u} n={i + 2} />)}
                  </div>
                  <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[10rem_1fr]">
                    <dt className="text-muted-foreground">{tr("Texto aceito", "Accepted text")}</dt><dd>“{r.declarationText}” <span className="text-xs text-muted-foreground">({tr("versão", "version")} {r.declarationVersion}, {r.locale === "en" ? tr("inglês", "English") : tr("português", "Portuguese")})</span></dd>
                    <dt className="text-muted-foreground">{tr("Cliente", "Customer")}</dt><dd>{r.userName ? `${r.userName} · ` : ""}{r.userEmail}</dd>
                    <dt className="text-muted-foreground">{tr("Data e hora (UTC)", "Date and time (UTC)")}</dt><dd className="font-mono text-xs">{r.createdAt}</dd>
                    <dt className="text-muted-foreground">IP</dt><dd className="font-mono text-xs">{r.ipAddress || tr("não disponível", "not available")}</dd>
                    <dt className="text-muted-foreground">{tr("Navegador", "Browser")}</dt><dd className="break-all text-xs">{r.userAgent || tr("não disponível", "not available")}</dd>
                    <dt className="text-muted-foreground">{tr("Campanha", "Campaign")}</dt><dd className="break-all text-xs">{r.campaignName || "—"} <span className="font-mono text-muted-foreground">{r.campaignId}</span></dd>
                    <dt className="text-muted-foreground">SHA-256</dt>
                    <dd className="space-y-1">{r.imageHashes.map((h, i) => <p key={h + i} className="break-all font-mono text-[11px]">{tr("Imagem", "Image")} {i + 2}: {h}</p>)}</dd>
                    <dt className="text-muted-foreground">{tr("Código do registro", "Record code")}</dt><dd className="font-mono text-xs">{r.id}</dd>
                  </dl>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {data && pages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{tr(`${data.total} registros · página ${page} de ${pages}`, `${data.total} records · page ${page} of ${pages}`)}</span>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className={buttonClass("outline", "sm")}>{tr("Anterior", "Previous")}</button>
            <button onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page >= pages} className={buttonClass("outline", "sm")}>{tr("Próxima", "Next")}</button>
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

// ---------------- Fiscal ----------------
interface FiscalData {
  year: number;
  months: { month: string; currency: string; count: number; gross: number; discounts: number; refunds: number; net: number }[];
  invoices: { id: string; status: string; number: string | null; error: string | null; createdAt: string; payment: { amount: number; currency: string; customerName: string | null } | null }[];
}

function FiscalTab({ config, onSaved }: { config: ConfigResponse; onSaved: () => void }) {
  const tr = useTr();
  const draft = useSecretDraft();
  const [year, setYear] = useState(new Date().getFullYear());
  const [data, setData] = useState<FiscalData | null>(null);
  const f = config.effectiveSettings.fiscal;
  const [form, setForm] = useState({ enabled: f.enabled, companyId: f.companyId || "", cityServiceCode: f.cityServiceCode || "", description: f.description });
  const [saving, setSaving] = useState(false);
  const load = useCallback(() => api(`/api/admin/fiscal?year=${year}`).then(setData).catch((e) => toast.error(e.message)), [year]);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      await api("/api/admin/config", "PUT", {
        secrets: draft.payload(),
        settings: { ...config.settings, fiscalEnabled: form.enabled, nfeioCompanyId: form.companyId, fiscalCityServiceCode: form.cityServiceCode, fiscalDescription: form.description },
      });
      toast.success(tr("Configuração fiscal salva", "Tax settings saved"));
      draft.reset();
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const retry = async (id: string) => {
    try {
      await api(`/api/admin/fiscal/${id}`, "POST");
      toast.success(tr("Nota de volta na fila", "Invoice queued again"));
      load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const ready = form.enabled && config.secrets.nfeioApiKey?.configured && form.companyId && form.cityServiceCode;

  return (
    <div className="space-y-5">
      <section className="surface space-y-2 p-5 sm:p-6">
        <h3 className="font-semibold">{tr("Vendas e notas fiscais", "Sales and invoices")}</h3>
        <p className="text-sm text-muted-foreground">
          {tr(
            "Sem CNPJ: use o relatório mensal abaixo para declarar a renda (carnê-leão) ou entregar ao contador. Com CNPJ: cadastre a empresa na NFE.io, preencha os dados abaixo e ligue a emissão — cada venda em reais gera a NFS-e automaticamente, e o estorno total cancela a nota.",
            "Without a CNPJ: use the monthly report below for your income declaration (carnê-leão) or your accountant. With a CNPJ: register the company at NFE.io, fill in the data below and turn issuing on — each BRL sale issues the NFS-e automatically, and a full refund cancels it."
          )}
        </p>
      </section>

      <section className="surface overflow-x-auto">
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-5 py-3">
          <h3 className="mr-auto font-semibold">{tr("Vendas por mês", "Sales by month")}</h3>
          <select aria-label={tr("Ano", "Year")} className="input-base h-9 w-28" value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {Array.from({ length: 4 }, (_, i) => new Date().getFullYear() - i).map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <a href={`/api/admin/fiscal?year=${year}&format=csv`} className={buttonClass("outline", "sm")}><Download className="h-3.5 w-3.5" /> {tr("Planilha do ano (CSV)", "Year spreadsheet (CSV)")}</a>
        </div>
        {!data ? <Loading /> : data.months.length === 0 ? <p className="p-5 text-sm text-muted-foreground">{tr("Nenhuma venda neste ano.", "No sales this year.")}</p> : (
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-5 py-2 font-medium">{tr("Mês", "Month")}</th>
                <th className="px-5 py-2 font-medium">{tr("Vendas", "Sales")}</th>
                <th className="px-5 py-2 font-medium">{tr("Recebido", "Received")}</th>
                <th className="px-5 py-2 font-medium">{tr("Estornado", "Refunded")}</th>
                <th className="px-5 py-2 font-medium">{tr("Líquido", "Net")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border tabular-nums">
              {data.months.map((m) => (
                <tr key={m.month + m.currency}>
                  <td className="px-5 py-2">{m.month}</td>
                  <td className="px-5 py-2">{m.count}</td>
                  <td className="px-5 py-2">{formatMoney(m.gross, m.currency)}</td>
                  <td className="px-5 py-2">{formatMoney(m.refunds, m.currency)}</td>
                  <td className="px-5 py-2 font-medium">{formatMoney(m.net, m.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="px-5 py-3 text-xs text-muted-foreground">{tr("Valores pagos pelos clientes, antes das taxas dos gateways. Confira as taxas nos extratos da Stripe e do Mercado Pago.", "Amounts paid by customers, before gateway fees. Check fees in the Stripe and Mercado Pago statements.")}</p>
      </section>

      <section className="surface space-y-4 p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-semibold">{tr("Emissão automática de NFS-e (NFE.io)", "Automatic NFS-e issuing (NFE.io)")}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{tr("Precisa de CNPJ e de inscrição municipal. O código do serviço e a alíquota dependem da sua cidade e do regime tributário: confirme com o contador.", "Requires a CNPJ and municipal registration. The service code and rate depend on your city and tax regime: confirm with your accountant.")}</p>
          </div>
          <Switch checked={form.enabled} onChange={(v) => setForm({ ...form, enabled: v })} />
        </div>
        <SecretField label={tr("Chave da API da NFE.io", "NFE.io API key")} field="nfeioApiKey" info={config.secrets.nfeioApiKey} value={draft.secrets.nfeioApiKey} onChange={draft.change} help="app.nfe.io › Conta › Chaves de acesso" />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label={tr("ID da empresa na NFE.io", "Company ID at NFE.io")} value={form.companyId} onChange={(v) => setForm({ ...form, companyId: v })} />
          <TextField label={tr("Código do serviço na prefeitura", "City service code")} value={form.cityServiceCode} onChange={(v) => setForm({ ...form, cityServiceCode: v })} />
        </div>
        <div className="space-y-1.5">
          <label className="label-base">{tr("Descrição do serviço na nota", "Service description on the invoice")}</label>
          <textarea className="input-base min-h-20 py-2" maxLength={500} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
        {form.enabled && !ready && <p className="text-sm text-warning">{tr("Falta a chave, o ID da empresa ou o código do serviço: nada será emitido até completar.", "Missing the key, company ID or service code: nothing will be issued until complete.")}</p>}
        <button onClick={save} disabled={saving} className={buttonClass("brand")}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {tr("Salvar", "Save")}
        </button>
      </section>

      {data && data.invoices.length > 0 && (
        <section className="surface overflow-x-auto">
          <h3 className="border-b border-border px-5 py-3 font-semibold">{tr("Notas fiscais", "Invoices")}</h3>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-border">
              {data.invoices.map((i) => (
                <tr key={i.id}>
                  <td className="whitespace-nowrap px-5 py-3">{formatDateTime(i.createdAt)}</td>
                  <td className="px-5 py-3">{i.payment?.customerName || "—"}</td>
                  <td className="px-5 py-3 tabular-nums">{i.payment ? formatMoney(i.payment.amount, i.payment.currency) : "—"}</td>
                  <td className="px-5 py-3">
                    {i.status === "ISSUED" ? <a href={`/api/admin/fiscal/${i.id}`} target="_blank" rel="noreferrer" className="text-brand hover:underline">Nº {i.number || "—"} (PDF)</a>
                      : i.status === "FAILED" ? <span className="text-destructive" title={i.error || ""}>{tr("Falhou", "Failed")}</span>
                      : i.status === "CANCELED" ? tr("Cancelada", "Canceled") : tr("Na fila", "Queued")}
                  </td>
                  <td className="px-5 py-3 text-right">{i.status === "FAILED" && <button onClick={() => retry(i.id)} className={buttonClass("ghost", "sm")}>{tr("Tentar de novo", "Retry")}</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
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
  const [feePercent, setFeePercent] = useState(config.effectiveSettings.cancellationFeePercent);
  const [showMp, setShowMp] = useState(gateway === "mercadopago" || !!config.secrets.mercadoPagoAccessToken?.configured);

  const loadStatus = useCallback(() => api("/api/admin/stripe").then(setStatus).catch(() => setStatus(null)), []);
  useEffect(() => { loadStatus(); }, [loadStatus]);

  const save = async () => {
    setSaving(true);
    try {
      const res = await api("/api/admin/config", "PUT", {
        secrets: draft.payload(),
        // As configurações gerais são salvas inteiras: junta a escolha do gateway com o que já existe.
        settings: { ...config.settings, brlGateway: gateway, cancellationFeePercent: Math.min(100, Math.max(0, feePercent)) },
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

      <section className="surface space-y-3 p-5 sm:p-6">
        <h3 className="font-semibold">{tr("Cancelamento de assinaturas", "Subscription cancellation")}</h3>
        <p className="text-sm text-muted-foreground">
          {tr(
            "O cliente cancela em Comprar créditos e nada mais é cobrado depois do período já pago. A taxa abaixo (% de uma mensalidade) é cobrada uma vez no cartão da assinatura e aparece antes da contratação e na confirmação do cancelamento. Ela nunca é cobrada nos 7 primeiros dias (direito de arrependimento, CDC art. 49) e o cancelamento acontece mesmo se a cobrança da taxa falhar. 0 = sem taxa.",
            "Customers cancel in Buy credits and nothing else is charged after the paid period. The fee below (% of one monthly fee) is charged once to the subscription card and is shown before subscribing and in the cancellation confirmation. It's never charged in the first 7 days (right of withdrawal, CDC art. 49) and cancellation goes through even if the fee charge fails. 0 = no fee."
          )}
        </p>
        <div className="max-w-xs">
          <NumberField label={tr("Taxa de cancelamento (%)", "Cancellation fee (%)")} value={feePercent} step={1} onChange={(v) => setFeePercent(Math.min(100, Math.max(0, v)))} />
        </div>
        <p className="text-xs text-warning">{tr("Atenção: o CDC não fixa um percentual; multas em assinaturas sem fidelidade podem ser consideradas abusivas. Confirme o valor e o texto dos Termos com um advogado.", "Note: Brazilian consumer law sets no fixed percentage; fees on subscriptions without a loyalty period may be deemed abusive. Confirm the amount and the Terms wording with a lawyer.")}</p>
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
