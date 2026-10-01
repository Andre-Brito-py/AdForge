"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { buttonClass } from "@/components/app/ui-bits";

const KEY = "vysify-cookie-notice";
const EVENT = "vysify:cookie-notice";

function read() {
  try {
    return !!localStorage.getItem(KEY);
  } catch {
    return true;
  }
}
function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
}

/** Aviso informativo: só usamos cookies essenciais, então não há o que "aceitar" ou "recusar". */
export function CookieBanner() {
  const dismissed = useSyncExternalStore(subscribe, read, () => true);
  if (dismissed) return null;

  const dismiss = () => {
    try { localStorage.setItem(KEY, "1"); } catch { /* ignora */ }
    window.dispatchEvent(new Event(EVENT));
  };

  return (
    <div className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-xl rounded-2xl border border-border bg-popover p-4 text-sm shadow-xl animate-in fade-in slide-in-from-bottom-4 sm:bottom-5">
      <p className="text-muted-foreground">
        Usamos apenas cookies essenciais (login, idioma e tema). Nada de rastreamento de anúncios.{" "}
        <Link href="/legal/privacy" className="font-medium text-foreground underline underline-offset-4">Saiba mais</Link>
      </p>
      <div className="mt-3 flex justify-end">
        <button onClick={dismiss} className={buttonClass("primary", "sm")}>Entendi</button>
      </div>
    </div>
  );
}
