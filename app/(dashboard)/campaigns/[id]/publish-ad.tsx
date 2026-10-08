"use client";

import { useEffect, useState } from "react";
import { Loader2, Megaphone } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { buttonClass } from "@/components/app/ui-bits";

interface AdAccount { id: string; name: string; currency: string; active: boolean }

/** Cria um anúncio pago (pausado) na Meta com este criativo. */
export function AdPanel({
  creativeId, pages, instagram, defaultHeadline, defaultMessage, defaultLink, defaultCountry, canManage, onCreated, onClose,
}: {
  creativeId: string;
  pages: { id: string; name: string }[];
  instagram: { id: string; name: string }[];
  defaultHeadline: string;
  defaultMessage: string;
  defaultLink: string;
  defaultCountry: string;
  canManage: boolean;
  onCreated: () => void;
  onClose: () => void;
}) {
  const t = useTranslations("publish.ad");
  const [accounts, setAccounts] = useState<AdAccount[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState({
    adAccountId: "", pageId: pages[0]?.id || "", instagramId: "", objective: "OUTCOME_TRAFFIC", dailyBudget: 20,
    countries: defaultCountry, link: defaultLink, cta: "SHOP_NOW", headline: defaultHeadline.slice(0, 255), message: defaultMessage.slice(0, 2000),
  });
  const [sending, setSending] = useState(false);
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  useEffect(() => {
    if (!canManage) return;
    fetch("/api/ads/accounts").then(async (res) => {
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return setLoadError(data.error || t("loadError"));
      setAccounts(data);
      const first = (data as AdAccount[]).find((a) => a.active);
      if (first) setForm((f) => ({ ...f, adAccountId: first.id }));
    });
  }, [canManage, t]);

  if (!canManage) return <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">{t("managersOnly")}</p>;
  if (loadError) return <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">{loadError}</p>;
  if (!accounts) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if (accounts.length === 0) return <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">{t("noAccounts")}</p>;

  const account = accounts.find((a) => a.id === form.adAccountId);
  const countries = form.countries.split(/[\s,;]+/).map((c) => c.trim().toUpperCase()).filter(Boolean);
  const valid = account && form.pageId && form.dailyBudget >= 1 && /^https:\/\//i.test(form.link) && countries.length > 0 && countries.every((c) => /^[A-Z]{2}$/.test(c)) && form.headline.trim() && form.message.trim();

  const create = async () => {
    setSending(true);
    const res = await fetch("/api/ads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, creativeId, countries, instagramId: form.instagramId || null }),
    });
    const data = await res.json().catch(() => ({}));
    setSending(false);
    if (!res.ok) return toast.error(data.error || t("error"));
    toast.success(t("started"));
    onCreated();
    onClose();
  };

  return (
    <div className="space-y-3">
      <p className="rounded-xl bg-muted p-3 text-xs text-muted-foreground">{t("pausedNote")}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="label-base" htmlFor="ad-account">{t("account")}</label>
          <select id="ad-account" className="input-base" value={form.adAccountId} onChange={(e) => set({ adAccountId: e.target.value })}>
            {accounts.map((a) => <option key={a.id} value={a.id} disabled={!a.active}>{a.name} ({a.currency}){a.active ? "" : ` · ${t("inactive")}`}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="label-base" htmlFor="ad-page">{t("page")}</label>
          <select id="ad-page" className="input-base" value={form.pageId} onChange={(e) => set({ pageId: e.target.value })}>
            {pages.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="label-base" htmlFor="ad-ig">{t("instagram")}</label>
          <select id="ad-ig" className="input-base" value={form.instagramId} onChange={(e) => set({ instagramId: e.target.value })}>
            <option value="">{t("instagramNone")}</option>
            {instagram.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="label-base" htmlFor="ad-obj">{t("objective")}</label>
          <select id="ad-obj" className="input-base" value={form.objective} onChange={(e) => set({ objective: e.target.value })}>
            {(["OUTCOME_TRAFFIC", "OUTCOME_AWARENESS", "OUTCOME_ENGAGEMENT"] as const).map((o) => <option key={o} value={o}>{t(`objectives.${o}`)}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="label-base" htmlFor="ad-budget">{t("budget", { currency: account?.currency || "" })}</label>
          <input id="ad-budget" type="number" min={1} step={1} className="input-base tabular-nums" value={form.dailyBudget} onChange={(e) => set({ dailyBudget: Number(e.target.value) })} />
        </div>
        <div className="space-y-1.5">
          <label className="label-base" htmlFor="ad-countries">{t("countries")}</label>
          <input id="ad-countries" className="input-base uppercase" value={form.countries} onChange={(e) => set({ countries: e.target.value })} placeholder="BR, PT" />
        </div>
      </div>
      <div className="space-y-1.5">
        <label className="label-base" htmlFor="ad-link">{t("link")}</label>
        <input id="ad-link" type="url" className="input-base" value={form.link} onChange={(e) => set({ link: e.target.value })} placeholder="https://sualoja.com.br/produto" />
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
        <div className="space-y-1.5">
          <label className="label-base" htmlFor="ad-headline">{t("headline")}</label>
          <input id="ad-headline" className="input-base" maxLength={255} value={form.headline} onChange={(e) => set({ headline: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <label className="label-base" htmlFor="ad-cta">{t("cta")}</label>
          <select id="ad-cta" className="input-base" value={form.cta} onChange={(e) => set({ cta: e.target.value })}>
            {(["SHOP_NOW", "BUY_NOW", "ORDER_NOW", "LEARN_MORE", "SIGN_UP", "CONTACT_US"] as const).map((c) => <option key={c} value={c}>{t(`ctas.${c}`)}</option>)}
          </select>
        </div>
      </div>
      <div className="space-y-1.5">
        <label className="label-base" htmlFor="ad-message">{t("message")}</label>
        <textarea id="ad-message" className="input-base min-h-24 py-2" maxLength={2000} value={form.message} onChange={(e) => set({ message: e.target.value })} />
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button onClick={onClose} className={buttonClass("ghost")}>{t("cancel")}</button>
        <button onClick={create} disabled={!valid || sending} className={buttonClass("brand")}>
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Megaphone className="h-4 w-4" />} {t("submit")}
        </button>
      </div>
    </div>
  );
}
