"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { Download, KeyRound, Loader2, ShieldCheck, Trash2, User, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { CookieSettingsButton } from "@/components/consent/ConsentManager";
import { buttonClass } from "@/components/app/ui-bits";
import { PixelMascot } from "@/components/mascot/PixelMascot";
import { setMascotHidden, useMascotHidden } from "@/components/mascot/mascot-events";

interface SettingsUser {
  name: string; email: string; hasPassword: boolean; twoFactorEnabled: boolean; notifyOnComplete: boolean; marketingOptIn: boolean;
}

async function send(url: string, method: string, body?: unknown) {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Error");
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
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const [name, setName] = useState(user.name);
  const [prefs, setPrefs] = useState({ notifyOnComplete: user.notifyOnComplete, marketingOptIn: user.marketingOptIn });
  const [savingProfile, setSavingProfile] = useState(false);
  const mascotOn = !useMascotHidden();

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await send("/api/user/profile", "PATCH", { name });
      toast.success(t("profileSaved"));
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
  // Idioma: grava no perfil (e-mails seguem a escolha) e no cookie (interface).
  const changeLocale = async (v: string) => {
    await send("/api/user/profile", "PATCH", { locale: v }).catch(() => undefined);
    setCookie("NEXT_LOCALE", v);
  };

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card icon={User} title={t("profile")}>
        <form onSubmit={saveProfile} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="name" className="label-base">{t("name")}</label>
            <input id="name" className="input-base" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <label htmlFor="email" className="label-base">{t("email")}</label>
            <input id="email" className="input-base" value={user.email} disabled />
          </div>
          <button type="submit" disabled={savingProfile || name.trim().length < 2} className={buttonClass("primary")}>
            {savingProfile && <Loader2 className="h-4 w-4 animate-spin" />} {tc("save")}
          </button>
        </form>
        <div className="mt-6 space-y-1 border-t border-border pt-4">
          <Toggle checked={prefs.notifyOnComplete} onChange={(v) => updatePref("notifyOnComplete", v)} label={t("notifyComplete")} />
          <Toggle checked={prefs.marketingOptIn} onChange={(v) => updatePref("marketingOptIn", v)} label={t("marketing")} hint={t("marketingHint")} />
        </div>
      </Card>

      <Card icon={SlidersHorizontal} title={t("preferences")}>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="lang" className="label-base">{t("language")}</label>
              <select id="lang" className="input-base" defaultValue={locale} onChange={(e) => changeLocale(e.target.value)}>
                <option value="pt">Português (Brasil)</option>
                <option value="en">English</option>
              </select>
            </div>
            <div className="space-y-2">
              <label htmlFor="cur" className="label-base">{t("currency")}</label>
              <select id="cur" className="input-base" defaultValue={currency} onChange={(e) => setCookie("CURRENCY", e.target.value)}>
                <option value="BRL">{t("currencies.BRL")}</option>
                <option value="USD">{t("currencies.USD")}</option>
                <option value="EUR">{t("currencies.EUR")}</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-border p-3">
            <PixelMascot mood={mascotOn ? "happy" : "sleeping"} size={40} />
            <div className="flex-1">
              <Toggle
                checked={mascotOn}
                onChange={(v) => setMascotHidden(!v)}
                label={t("mascot")}
                hint={t("mascotHint")}
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
  const ta = useTranslations("auth");
  const t = useTranslations("settings");
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await send("/api/user/password", "POST", { currentPassword: current || undefined, newPassword: next });
      toast.success(t("passwordChanged"));
      setTimeout(() => signOut({ callbackUrl: "/login" }), 1200);
    } catch (err) {
      toast.error((err as Error).message);
      setLoading(false);
    }
  };

  return (
    <Card icon={KeyRound} title={hasPassword ? t("passwordChange") : t("passwordCreate")} description={hasPassword ? t("passwordChangeHint") : t("passwordCreateHint")}>
      <form onSubmit={submit} className="space-y-4">
        {hasPassword && (
          <div className="space-y-2">
            <label htmlFor="cur-pw" className="label-base">{t("currentPassword")}</label>
            <input id="cur-pw" type="password" autoComplete="current-password" className="input-base" value={current} onChange={(e) => setCurrent(e.target.value)} required />
          </div>
        )}
        <div className="space-y-2">
          <label htmlFor="new-pw" className="label-base">{t("newPassword")}</label>
          <input id="new-pw" type="password" autoComplete="new-password" className="input-base" value={next} onChange={(e) => setNext(e.target.value)} minLength={8} required />
          <p className="text-xs text-muted-foreground">{ta("passwordHint")}</p>
        </div>
        <button type="submit" disabled={loading || next.length < 8} className={buttonClass("primary")}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />} {hasPassword ? t("passwordChange") : t("passwordCreate")}
        </button>
      </form>
    </Card>
  );
}

function TwoFactorCard({ initiallyEnabled }: { initiallyEnabled: boolean }) {
  const ta = useTranslations("auth");
  const t = useTranslations("settings");
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
      toast.success(method === "POST" ? t("twoFactorOn") : t("twoFactorOff"));
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
        aria-label={ta("login.codeLabel")}
      />
      <button onClick={() => confirm(setup ? "POST" : "DELETE")} disabled={loading || token.length !== 6} className={buttonClass(setup ? "brand" : "danger")}>
        {loading && <Loader2 className="h-4 w-4 animate-spin" />} {setup ? t("enable") : t("disable")}
      </button>
    </div>
  );

  return (
    <Card icon={ShieldCheck} title={t("twoFactor")} description={t("twoFactorHint")}>
      {enabled ? (
        disabling ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{t("disablePrompt")}</p>
            {codeInput}
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3 rounded-xl bg-success/10 p-3">
            <span className="text-sm font-medium text-success">{t("enabled")}</span>
            <button onClick={() => setDisabling(true)} className={buttonClass("ghost", "sm")}>{t("disable")}</button>
          </div>
        )
      ) : setup ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{t("scanQr")}</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={setup.qrCodeUrl} alt={t("qrAlt")} className="h-44 w-44 rounded-xl border border-border bg-white p-2" />
          <p className="text-xs text-muted-foreground">{t("orKey")} <code className="break-all font-mono">{setup.secret}</code></p>
          <p className="text-sm text-muted-foreground">{t("typeCode")}</p>
          {codeInput}
        </div>
      ) : (
        <button onClick={start} disabled={loading} className={buttonClass("primary")}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />} {t("setup2fa")}
        </button>
      )}
    </Card>
  );
}

function PrivacyCard({ hasPassword }: { hasPassword: boolean }) {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const word = t("confirmWord");
  const [confirming, setConfirming] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);

  const remove = async () => {
    setLoading(true);
    try {
      await send("/api/user/account", "DELETE", { password: password || undefined, confirmation });
      toast.success(t("deleted"));
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
          <h2 className="font-semibold">{t("privacy")}</h2>
          <p className="text-sm text-muted-foreground">{t("privacyHint")}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <a href="/api/user/account" className={buttonClass("outline")} download>
          <Download className="h-4 w-4" /> {t("export")}
        </a>
        <CookieSettingsButton className={buttonClass("outline")} />
        {!confirming && (
          <button onClick={() => setConfirming(true)} className={buttonClass("danger")}>
            <Trash2 className="h-4 w-4" /> {t("deleteAccount")}
          </button>
        )}
      </div>
      {confirming && (
        <div className="mt-5 space-y-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
          <p className="text-sm">
            {t.rich("deleteWarning", { b: (chunks) => <strong>{chunks}</strong> })}
          </p>
          {hasPassword && (
            <input type="password" className="input-base max-w-sm" placeholder={t("yourPassword")} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          )}
          <input className="input-base max-w-sm" placeholder={t("confirmPlaceholder", { word })} value={confirmation} onChange={(e) => setConfirmation(e.target.value)} />
          <div className="flex gap-2">
            <button onClick={() => setConfirming(false)} className={buttonClass("ghost")}>{tc("cancel")}</button>
            <button onClick={remove} disabled={loading || confirmation !== word} className={buttonClass("danger")}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />} {t("deleteForever")}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
