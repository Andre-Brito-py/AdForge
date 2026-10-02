"use client";

import { useCallback, useEffect, useState } from "react";
import { BarChart3, ChevronDown, Copy, CreditCard, Download, Gift, ImageOff, KeyRound, Plug, Loader2, Package, Plus, Save, Search, Settings2, ShieldCheck, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { buttonClass } from "@/components/app/ui-bits";
import { formatDateTime, formatMoney } from "@/lib/format";

type SecretInfo = { configured: boolean; hint: string | null; source: "painel" | "env" | null };
interface Plan {
  id: string; name: string; description?: string | null; description_en?: string | null; price_brl: number; price_usd: number; price_eur?: number | null;
  credits: number; isFeatured?: boolean; isFree?: boolean; isHidden?: boolean; features_pt: string[]; features_en: string[];
}
interface ConfigResponse {
  secrets: Record<string, SecretInfo>;
  costs: { image: number; video: number; premiumMultiplier: number };
  models: Record<string, string>;
  defaultModels: Record<string, string>;
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
    meta: { loginConfigId: string | null; graphVersion: string };
    elevenLabsVoiceId: string;
    elevenLabsVoiceIdMale: string;
  };
}
type SettingKey =
  | "companyName" | "companyCnpj" | "companyAddress" | "supportEmail" | "privacyEmail" | "euRepresentative" | "ukRepresentative"
  | "emailFrom" | "gaId" | "metaPixelId" | "stripeAutomaticTax" | "metaLoginConfigId" | "metaGraphVersion" | "elevenLabsVoiceId" | "elevenLabsVoiceIdMale";

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
        {tab === "overview" && <Overview />}
        {tab === "users" && <UsersTab />}
        {tab === "ai" && (config ? <AiTab config={config} onSaved={reload} /> : <Loading />)}
        {tab === "plans" && (config ? <PlansTab initial={config.plans} onSaved={reload} /> : <Loading />)}
        {tab === "trial" && (config ? <TrialTab initial={config.freeTrial} onSaved={reload} /> : <Loading />)}
        {tab === "payments" && (config ? <PaymentsTab config={config} onSaved={reload} baseUrl={baseUrl} /> : <Loading />)}
        {tab === "integrations" && (config ? <IntegrationsTab config={config} onSaved={reload} baseUrl={baseUrl} /> : <Loading />)}
        {tab === "general" && (config ? <GeneralTab config={config} onSaved={reload} /> : <Loading />)}
        {tab === "imageRights" && <ImageRightsTab />}
      </div>
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
interface AdminUser { id: string; email: string; name: string | null; role: string; createdAt: string; emailVerified: boolean; twoFactorEnabled: boolean; balance: number; campaigns: number }

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
                  <td className="px-4 py-3 text-xs">{u.emailVerified ? "E-mail ok" : "Não verificado"}{u.twoFactorEnabled ? " · 2FA" : ""}</td>
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

  const modelLabels: Record<string, string> = { text: "Texto / estratégia", image: "Imagem (padrão)", imagePremium: "Imagem (premium)", video: "Vídeo (padrão)", videoPremium: "Vídeo (premium)" };

  return (
    <div className="space-y-5">
      <section className="surface space-y-4 p-5 sm:p-6">
        <h3 className="font-semibold">Chaves dos provedores</h3>
        <p className="text-sm text-muted-foreground">Salvas criptografadas no banco. Por segurança, a chave nunca é exibida de novo, só os 4 últimos caracteres.</p>
        <SecretField label="Google Gemini" field="geminiKey" info={config.secrets.geminiKey} value={draft.secrets.geminiKey} onChange={draft.change} help="Obrigatória para imagens e estratégia. aistudio.google.com" />
        <SecretField label="fal.ai (vídeo Wan)" field="wanKey" info={config.secrets.wanKey} value={draft.secrets.wanKey} onChange={draft.change} help="Obrigatória para vídeos. fal.ai/dashboard/keys" />
        <SecretField label="ElevenLabs (locução)" field="elevenLabsKey" info={config.secrets.elevenLabsKey} value={draft.secrets.elevenLabsKey} onChange={draft.change} help="Opcional: locução dos vídeos." />
        <SecretField label="OpenAI (reserva)" field="openAiKey" info={config.secrets.openAiKey} value={draft.secrets.openAiKey} onChange={draft.change} help="Opcional: reserva para texto e locução." />
      </section>

      <section className="surface space-y-4 p-5 sm:p-6">
        <h3 className="font-semibold">Custos em créditos</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField label="Imagem" value={costs.image} onChange={(v) => setCosts({ ...costs, image: v })} />
          <NumberField label="Vídeo (a cada 5 s)" value={costs.video} onChange={(v) => setCosts({ ...costs, video: v })} />
          <NumberField label="Multiplicador Premium" value={costs.premiumMultiplier} step={0.5} onChange={(v) => setCosts({ ...costs, premiumMultiplier: v })} />
        </div>
      </section>

      <section className="surface space-y-4 p-5 sm:p-6">
        <h3 className="font-semibold">Modelos</h3>
        <p className="text-sm text-muted-foreground">Troque quando um provedor lançar uma versão nova, sem precisar de deploy.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          {Object.keys(modelLabels).map((k) => (
            <div key={k} className="space-y-1.5">
              <label className="label-base" htmlFor={`m-${k}`}>{modelLabels[k]}</label>
              <input id={`m-${k}`} className="input-base font-mono" value={models[k] || ""} placeholder={config.defaultModels[k]} onChange={(e) => setModels({ ...models, [k]: e.target.value })} />
            </div>
          ))}
        </div>
      </section>

      <button onClick={save} disabled={saving} className={buttonClass("brand", "lg")}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar
      </button>
    </div>
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
function PlansTab({ initial, onSaved }: { initial: Plan[]; onSaved: () => void }) {
  const [plans, setPlans] = useState<Plan[]>(initial);
  const [saving, setSaving] = useState(false);
  const update = (i: number, patch: Partial<Plan>) => setPlans((ps) => ps.map((p, j) => (j === i ? { ...p, ...patch } : p)));

  const save = async () => {
    setSaving(true);
    try {
      const clean = plans.map((p) => ({ ...p, features_pt: p.features_pt.filter((f) => f.trim()), features_en: p.features_en.filter((f) => f.trim()) }));
      await api("/api/admin/config", "PUT", { plans: clean });
      toast.success("Pacotes salvos");
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {plans.map((p, i) => (
        <div key={i} className={`surface space-y-4 p-5 ${p.isFeatured ? "border-brand" : ""}`}>
          <div className="flex items-center justify-between">
            <p className="font-semibold">{p.name || "Novo pacote"}</p>
            <button onClick={() => setPlans(plans.filter((_, j) => j !== i))} className={buttonClass("ghost", "sm")}><Trash2 className="h-3.5 w-3.5" /> Remover</button>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <TextField label="ID (não mude após vender)" value={p.id} onChange={(v) => update(i, { id: v })} />
            <TextField label="Nome" value={p.name} onChange={(v) => update(i, { name: v })} />
            <NumberField label="Créditos" value={p.credits} onChange={(v) => update(i, { credits: v })} />
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
        <button onClick={() => setPlans([...plans, { id: `pack_${Date.now().toString(36)}`, name: "", price_brl: 0, price_usd: 0, credits: 100, features_pt: [], features_en: [] }])} className={buttonClass("outline")}>
          <Plus className="h-4 w-4" /> Adicionar pacote
        </button>
        <button onClick={save} disabled={saving} className={buttonClass("brand")}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar pacotes
        </button>
      </div>
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
  const draft = useSecretDraft();
  const [saving, setSaving] = useState(false);
  const configured = config.secrets.metaAppId?.configured && config.secrets.metaAppSecret?.configured;

  const save = async () => {
    setSaving(true);
    try {
      await api("/api/admin/config", "PUT", { secrets: draft.payload() });
      toast.success("Credenciais da Meta salvas");
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

// ---------------- Pagamentos ----------------
function PaymentsTab({ config, onSaved, baseUrl }: { config: ConfigResponse; onSaved: () => void; baseUrl: string }) {
  const draft = useSecretDraft();
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await api("/api/admin/config", "PUT", { secrets: draft.payload() });
      toast.success("Chaves de pagamento salvas");
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
      <section className="surface space-y-4 p-5 sm:p-6">
        <h3 className="font-semibold">Mercado Pago (BRL: Pix, cartão, boleto)</h3>
        <SecretField label="Access Token" field="mercadoPagoAccessToken" info={config.secrets.mercadoPagoAccessToken} value={draft.secrets.mercadoPagoAccessToken} onChange={draft.change} />
        <SecretField label="Assinatura secreta do webhook" field="mercadoPagoWebhookSecret" info={config.secrets.mercadoPagoWebhookSecret} value={draft.secrets.mercadoPagoWebhookSecret} onChange={draft.change}
          help="Em Suas integrações › Webhooks. Sem ela, notificações falsas não são bloqueadas pela assinatura." />
        <p className="rounded-xl bg-muted p-3 font-mono text-xs">{baseUrl}/api/webhooks/mercadopago</p>
      </section>
      <section className="surface space-y-4 p-5 sm:p-6">
        <h3 className="font-semibold">Stripe (USD/EUR e cartão internacional)</h3>
        <SecretField label="Secret key" field="stripeSecretKey" info={config.secrets.stripeSecretKey} value={draft.secrets.stripeSecretKey} onChange={draft.change} />
        <SecretField label="Webhook signing secret (whsec_...)" field="stripeWebhookSecret" info={config.secrets.stripeWebhookSecret} value={draft.secrets.stripeWebhookSecret} onChange={draft.change}
          help="Eventos: checkout.session.completed e checkout.session.async_payment_succeeded." />
        <p className="rounded-xl bg-muted p-3 font-mono text-xs">{baseUrl}/api/webhooks/stripe</p>
      </section>
      <button onClick={save} disabled={saving} className={buttonClass("brand", "lg")}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar
      </button>
    </div>
  );
}
