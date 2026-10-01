"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { Download, KeyRound, Loader2, ShieldCheck, Trash2, User, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { buttonClass } from "@/components/app/ui-bits";
import { PixelMascot } from "@/components/mascot/PixelMascot";
import { setMascotHidden, useMascotHidden } from "@/components/mascot/mascot-events";

interface SettingsUser {
  name: string; email: string; hasPassword: boolean; twoFactorEnabled: boolean; notifyOnComplete: boolean; marketingOptIn: boolean;
}

async function send(url: string, method: string, body?: unknown) {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Algo deu errado");
  return data;
}

function Card({ icon: Icon, title, description, children }: { icon: React.ElementType; title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="surface p-5 sm:p-6">
      <div className="mb-5 flex items-start gap-3">
        <Icon className="mt-0.5 h-5 w-5 text-brand" />
        <div>
          <h2 className="font-semibold">{title}</h2>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl p-2 hover:bg-muted/50">
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition ${checked ? "bg-brand" : "bg-muted-foreground/30"}`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${checked ? "left-[22px]" : "left-0.5"}`} />
      </button>
    </label>
  );
}

export function SettingsClient({ user, locale, currency }: { user: SettingsUser; locale: string; currency: string }) {
  const [name, setName] = useState(user.name);
  const [prefs, setPrefs] = useState({ notifyOnComplete: user.notifyOnComplete, marketingOptIn: user.marketingOptIn });
  const [savingProfile, setSavingProfile] = useState(false);
  const mascotOn = !useMascotHidden();

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await send("/api/user/profile", "PATCH", { name });
      toast.success("Perfil atualizado");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSavingProfile(false);
    }
  };

  const updatePref = async (key: keyof typeof prefs, value: boolean) => {
    setPrefs((p) => ({ ...p, [key]: value }));
    try {
      await send("/api/user/profile", "PATCH", { [key]: value });
    } catch (err) {
      setPrefs((p) => ({ ...p, [key]: !value }));
      toast.error((err as Error).message);
    }
  };

  const setCookie = (k: string, v: string) => {
    document.cookie = `${k}=${v}; path=/; max-age=31536000; samesite=lax`;
    window.location.reload();
  };

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card icon={User} title="Perfil">
        <form onSubmit={saveProfile} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="name" className="label-base">Nome</label>
            <input id="name" className="input-base" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <label htmlFor="email" className="label-base">E-mail</label>
            <input id="email" className="input-base" value={user.email} disabled />
          </div>
          <button type="submit" disabled={savingProfile || name.trim().length < 2} className={buttonClass("primary")}>
            {savingProfile && <Loader2 className="h-4 w-4 animate-spin" />} Salvar
          </button>
        </form>
        <div className="mt-6 space-y-1 border-t border-border pt-4">
          <Toggle checked={prefs.notifyOnComplete} onChange={(v) => updatePref("notifyOnComplete", v)} label="Avisar por e-mail quando uma campanha ficar pronta" />
          <Toggle checked={prefs.marketingOptIn} onChange={(v) => updatePref("marketingOptIn", v)} label="Receber novidades e dicas da Vysify" hint="No máximo 2 e-mails por mês. Cancele quando quiser." />
        </div>
      </Card>

      <Card icon={SlidersHorizontal} title="Preferências">
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="lang" className="label-base">Idioma</label>
              <select id="lang" className="input-base" defaultValue={locale} onChange={(e) => setCookie("NEXT_LOCALE", e.target.value)}>
                <option value="pt">Português (Brasil)</option>
                <option value="en">English</option>
              </select>
            </div>
            <div className="space-y-2">
              <label htmlFor="cur" className="label-base">Moeda dos preços</label>
              <select id="cur" className="input-base" defaultValue={currency} onChange={(e) => setCookie("CURRENCY", e.target.value)}>
                <option value="BRL">Real (R$)</option>
                <option value="USD">Dólar (US$)</option>
                <option value="EUR">Euro (€)</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-border p-3">
            <PixelMascot mood={mascotOn ? "happy" : "sleeping"} size={40} />
            <div className="flex-1">
              <Toggle
                checked={mascotOn}
                onChange={(v) => setMascotHidden(!v)}
                label="Mostrar o Vy, o mascote"
                hint="Ele fica no canto da tela com dicas rápidas."
              />
            </div>
          </div>
        </div>
      </Card>

      <PasswordCard hasPassword={user.hasPassword} />
      <TwoFactorCard initiallyEnabled={user.twoFactorEnabled} />
      <PrivacyCard hasPassword={user.hasPassword} />
    </div>
  );
}

function PasswordCard({ hasPassword }: { hasPassword: boolean }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await send("/api/user/password", "POST", { currentPassword: current || undefined, newPassword: next });
      toast.success("Senha alterada. Entre novamente com a nova senha.");
      setTimeout(() => signOut({ callbackUrl: "/login" }), 1200);
    } catch (err) {
      toast.error((err as Error).message);
      setLoading(false);
    }
  };

  return (
    <Card icon={KeyRound} title={hasPassword ? "Alterar senha" : "Criar senha"} description={hasPassword ? "Você será desconectado dos outros dispositivos." : "Sua conta usa o Google. Crie uma senha para entrar também por e-mail."}>
      <form onSubmit={submit} className="space-y-4">
        {hasPassword && (
          <div className="space-y-2">
            <label htmlFor="cur-pw" className="label-base">Senha atual</label>
            <input id="cur-pw" type="password" autoComplete="current-password" className="input-base" value={current} onChange={(e) => setCurrent(e.target.value)} required />
          </div>
        )}
        <div className="space-y-2">
          <label htmlFor="new-pw" className="label-base">Nova senha</label>
          <input id="new-pw" type="password" autoComplete="new-password" className="input-base" value={next} onChange={(e) => setNext(e.target.value)} minLength={8} required />
          <p className="text-xs text-muted-foreground">Mínimo de 8 caracteres, com letras e números.</p>
        </div>
        <button type="submit" disabled={loading || next.length < 8} className={buttonClass("primary")}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />} {hasPassword ? "Alterar senha" : "Criar senha"}
        </button>
      </form>
    </Card>
  );
}

function TwoFactorCard({ initiallyEnabled }: { initiallyEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initiallyEnabled);
  const [setup, setSetup] = useState<{ qrCodeUrl: string; secret: string } | null>(null);
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [disabling, setDisabling] = useState(false);

  const start = async () => {
    setLoading(true);
    try {
      setSetup(await send("/api/user/2fa/generate", "POST"));
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const confirm = async (method: "POST" | "DELETE") => {
    setLoading(true);
    try {
      await send("/api/user/2fa/verify", method, { token });
      setEnabled(method === "POST");
      setSetup(null);
      setDisabling(false);
      setToken("");
      toast.success(method === "POST" ? "Verificação em duas etapas ativada" : "Verificação em duas etapas desativada");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const codeInput = (
    <div className="flex gap-2">
      <input
        className="input-base max-w-40 text-center font-mono tracking-[0.4em]"
        inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="000000"
        value={token} onChange={(e) => setToken(e.target.value.replace(/\D/g, ""))}
        aria-label="Código de 6 dígitos"
      />
      <button onClick={() => confirm(setup ? "POST" : "DELETE")} disabled={loading || token.length !== 6} className={buttonClass(setup ? "brand" : "danger")}>
        {loading && <Loader2 className="h-4 w-4 animate-spin" />} {setup ? "Ativar" : "Desativar"}
      </button>
    </div>
  );

  return (
    <Card icon={ShieldCheck} title="Verificação em duas etapas (2FA)" description="Peça um código do Google Authenticator (ou similar) ao entrar.">
      {enabled ? (
        disabling ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Digite um código do app autenticador para desativar.</p>
            {codeInput}
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3 rounded-xl bg-success/10 p-3">
            <span className="text-sm font-medium text-success">Ativada</span>
            <button onClick={() => setDisabling(true)} className={buttonClass("ghost", "sm")}>Desativar</button>
          </div>
        )
      ) : setup ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">1. Escaneie o QR Code com o app autenticador.</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={setup.qrCodeUrl} alt="QR Code para o app autenticador" className="h-44 w-44 rounded-xl border border-border bg-white p-2" />
          <p className="text-xs text-muted-foreground">Ou digite a chave: <code className="break-all font-mono">{setup.secret}</code></p>
          <p className="text-sm text-muted-foreground">2. Digite o código de 6 dígitos gerado.</p>
          {codeInput}
        </div>
      ) : (
        <button onClick={start} disabled={loading} className={buttonClass("primary")}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />} Configurar autenticador
        </button>
      )}
    </Card>
  );
}

function PrivacyCard({ hasPassword }: { hasPassword: boolean }) {
  const [confirming, setConfirming] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);

  const remove = async () => {
    setLoading(true);
    try {
      await send("/api/user/account", "DELETE", { password: password || undefined, confirmation });
      toast.success("Conta excluída. Sentiremos sua falta!");
      setTimeout(() => signOut({ callbackUrl: "/" }), 1000);
    } catch (err) {
      toast.error((err as Error).message);
      setLoading(false);
    }
  };

  return (
    <section className="surface p-5 sm:p-6 lg:col-span-2">
      <div className="mb-5 flex items-start gap-3">
        <Download className="mt-0.5 h-5 w-5 text-brand" />
        <div>
          <h2 className="font-semibold">Privacidade e dados (LGPD)</h2>
          <p className="text-sm text-muted-foreground">Baixe uma cópia dos seus dados ou exclua sua conta definitivamente.</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <a href="/api/user/account" className={buttonClass("outline")} download>
          <Download className="h-4 w-4" /> Exportar meus dados (JSON)
        </a>
        {!confirming && (
          <button onClick={() => setConfirming(true)} className={buttonClass("danger")}>
            <Trash2 className="h-4 w-4" /> Excluir minha conta
          </button>
        )}
      </div>
      {confirming && (
        <div className="mt-5 space-y-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
          <p className="text-sm">
            Isto apaga sua conta, produtos, campanhas, criativos e créditos restantes. <strong>Não dá para desfazer.</strong> Registros de pagamento são mantidos pelo prazo exigido pela legislação fiscal.
          </p>
          {hasPassword && (
            <input type="password" className="input-base max-w-sm" placeholder="Sua senha" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          )}
          <input className="input-base max-w-sm" placeholder='Digite "EXCLUIR" para confirmar' value={confirmation} onChange={(e) => setConfirmation(e.target.value)} />
          <div className="flex gap-2">
            <button onClick={() => setConfirming(false)} className={buttonClass("ghost")}>Cancelar</button>
            <button onClick={remove} disabled={loading || confirmation !== "EXCLUIR"} className={buttonClass("danger")}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />} Excluir definitivamente
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
