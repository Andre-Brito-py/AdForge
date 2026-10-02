"use client";

import { useSyncExternalStore } from "react";

/**
 * Consentimento de cookies (GDPR/LGPD/ePrivacy). Guardado num cookie de primeira parte
 * por 6 meses. Rastreadores opcionais só carregam depois do aceite explícito.
 */
export interface Consent {
  analytics: boolean;
  marketing: boolean;
}

const COOKIE = "vysify_consent";
const CHANGE_EVENT = "vysify:consent-change";
export const OPEN_EVENT = "vysify:open-consent";
const MAX_AGE = 60 * 60 * 24 * 182;

// Rastreadores opcionais configurados (sem eles, não há o que consentir).
export const TRACKERS = {
  analytics: !!process.env.NEXT_PUBLIC_GA_ID,
  marketing: !!process.env.NEXT_PUBLIC_META_PIXEL_ID,
};
export const HAS_OPTIONAL_TRACKERS = TRACKERS.analytics || TRACKERS.marketing;

function read(): string | null {
  const match = document.cookie.match(/(?:^|; )vysify_consent=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export function parseConsent(raw: string | null): Consent | null {
  if (!raw) return null;
  const m = /^v1\.a([01])\.m([01])$/.exec(raw);
  return m ? { analytics: m[1] === "1", marketing: m[2] === "1" } : null;
}

export function saveConsent(consent: Consent) {
  const value = `v1.a${consent.analytics ? 1 : 0}.m${consent.marketing ? 1 : 0}`;
  const secure = location.protocol === "https:" ? "; secure" : "";
  document.cookie = `${COOKIE}=${value}; path=/; max-age=${MAX_AGE}; samesite=lax${secure}`;
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function openConsentSettings() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

function subscribe(cb: () => void) {
  window.addEventListener(CHANGE_EVENT, cb);
  return () => window.removeEventListener(CHANGE_EVENT, cb);
}

/** Valor bruto do cookie (estável entre renders, como o useSyncExternalStore exige). */
export function useConsentRaw(): string | null | undefined {
  // undefined no servidor/hidratação: não decidimos nada antes de ler o navegador.
  return useSyncExternalStore(subscribe, read, () => undefined);
}
