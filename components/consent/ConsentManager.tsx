"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Script from "next/script";
import { useTranslations } from "next-intl";
import { buttonClass } from "@/components/app/ui-bits";
import { OPEN_EVENT, parseConsent, saveConsent, useConsentRaw, type Consent } from "./consent";

function Toggle({ checked, disabled, onChange, label }: { checked: boolean; disabled?: boolean; onChange?: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-60 ${checked ? "bg-brand" : "bg-muted-foreground/30"}`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${checked ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}

/**
 * Banner + preferências de cookies + carregamento condicional dos rastreadores.
 * Sem rastreadores opcionais configurados, nenhum banner é exibido (só cookies essenciais).
 * Os IDs vêm do painel Admin (validados no servidor), então podem mudar sem redeploy.
 */
export function ConsentManager({ gaId: GA_ID, pixelId: PIXEL_ID }: { gaId: string | null; pixelId: string | null }) {
  const TRACKERS = { analytics: !!GA_ID, marketing: !!PIXEL_ID };
  const HAS_OPTIONAL_TRACKERS = TRACKERS.analytics || TRACKERS.marketing;
  const t = useTranslations("cookies");
  const tc = useTranslations("common");
  const raw = useConsentRaw();
  const consent = parseConsent(raw ?? null);
  const [panel, setPanel] = useState(false);
  const [draft, setDraft] = useState<Consent>({ analytics: false, marketing: false });

  useEffect(() => {
    const open = () => {
      setDraft(parseConsent(document.cookie.match(/(?:^|; )vysify_consent=([^;]*)/)?.[1] ?? null) || { analytics: false, marketing: false });
      setPanel(true);
    };
    window.addEventListener(OPEN_EVENT, open);
    return () => window.removeEventListener(OPEN_EVENT, open);
  }, []);

  const decide = (c: Consent) => {
    saveConsent(c);
    setPanel(false);
  };

  const showBanner = raw !== undefined && HAS_OPTIONAL_TRACKERS && !consent && !panel;

  return (
    <>
      {/* Rastreadores só depois do consentimento */}
      {GA_ID && consent?.analytics && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
          <Script id="ga-init" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_ID}',{anonymize_ip:true});`}
          </Script>
        </>
      )}
      {PIXEL_ID && consent?.marketing && (
        <Script id="meta-pixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${PIXEL_ID}');fbq('track','PageView');`}
        </Script>
      )}

      {showBanner && (
        <div role="dialog" aria-label={t("bannerTitle")} className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-2xl rounded-2xl border border-border bg-popover p-5 text-sm shadow-xl animate-in fade-in slide-in-from-bottom-4 sm:bottom-5">
          <p className="font-semibold">{t("bannerTitle")}</p>
          <p className="mt-1 text-muted-foreground">
            {t("bannerText")}{" "}
            <Link href="/legal/cookies" className="font-medium text-foreground underline underline-offset-4">{t("learnMore")}</Link>
          </p>
          {/* "Aceitar" e "Recusar" com o mesmo destaque, como pedem as autoridades europeias. */}
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <button onClick={() => { setDraft({ analytics: false, marketing: false }); setPanel(true); }} className={buttonClass("ghost", "sm")}>{t("customize")}</button>
            <button onClick={() => decide({ analytics: false, marketing: false })} className={buttonClass("primary", "sm")}>{t("rejectAll")}</button>
            <button onClick={() => decide({ analytics: TRACKERS.analytics, marketing: TRACKERS.marketing })} className={buttonClass("primary", "sm")}>{t("acceptAll")}</button>
          </div>
        </div>
      )}

      {panel && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center" role="dialog" aria-modal="true" aria-label={tc("legal.cookieSettings")}>
          <div className="w-full max-w-lg rounded-2xl border border-border bg-popover p-5 shadow-xl">
            <p className="text-lg font-semibold">{tc("legal.cookieSettings")}</p>
            {!HAS_OPTIONAL_TRACKERS && <p className="mt-2 text-sm text-muted-foreground">{t("onlyEssential")}</p>}
            <ul className="mt-4 space-y-3">
              <li className="flex items-start justify-between gap-4 rounded-xl border border-border p-3">
                <div>
                  <p className="text-sm font-medium">{t("categories.essential.title")}</p>
                  <p className="text-xs text-muted-foreground">{t("categories.essential.text")}</p>
                </div>
                <Toggle checked disabled label={t("alwaysOn")} />
              </li>
              {TRACKERS.analytics && (
                <li className="flex items-start justify-between gap-4 rounded-xl border border-border p-3">
                  <div>
                    <p className="text-sm font-medium">{t("categories.analytics.title")}</p>
                    <p className="text-xs text-muted-foreground">{t("categories.analytics.text")}</p>
                  </div>
                  <Toggle checked={draft.analytics} onChange={(v) => setDraft({ ...draft, analytics: v })} label={t("categories.analytics.title")} />
                </li>
              )}
              {TRACKERS.marketing && (
                <li className="flex items-start justify-between gap-4 rounded-xl border border-border p-3">
                  <div>
                    <p className="text-sm font-medium">{t("categories.marketing.title")}</p>
                    <p className="text-xs text-muted-foreground">{t("categories.marketing.text")}</p>
                  </div>
                  <Toggle checked={draft.marketing} onChange={(v) => setDraft({ ...draft, marketing: v })} label={t("categories.marketing.title")} />
                </li>
              )}
            </ul>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
              <Link href="/legal/cookies" onClick={() => setPanel(false)} className="text-sm text-muted-foreground underline underline-offset-4">{t("learnMore")}</Link>
              <div className="flex gap-2">
                {HAS_OPTIONAL_TRACKERS && <button onClick={() => decide({ analytics: false, marketing: false })} className={buttonClass("ghost", "sm")}>{t("rejectAll")}</button>}
                <button onClick={() => (HAS_OPTIONAL_TRACKERS ? decide(draft) : setPanel(false))} className={buttonClass("primary", "sm")}>{HAS_OPTIONAL_TRACKERS ? t("save") : "OK"}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** Link "Preferências de cookies" para rodapés e Configurações. */
export function CookieSettingsButton({ className = "" }: { className?: string }) {
  const tc = useTranslations("common");
  return (
    <button type="button" onClick={() => window.dispatchEvent(new Event(OPEN_EVENT))} className={className}>
      {tc("legal.cookieSettings")}
    </button>
  );
}
