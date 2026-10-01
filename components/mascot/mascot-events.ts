import { useSyncExternalStore } from "react";
import type { MascotMood } from "./PixelMascot";

const EVENT = "vy:mood";
export const MASCOT_HIDDEN_KEY = "vy-hidden";
const VISIBILITY_EVENT = "vy:visibility";

/** Muda o humor do mascote do canto da tela a partir de qualquer componente cliente. */
export function setMascotMood(mood: MascotMood, durationMs?: number) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { mood, durationMs } }));
}

export function onMascotMood(cb: (mood: MascotMood, durationMs?: number) => void) {
  const handler = (e: Event) => {
    const { mood, durationMs } = (e as CustomEvent).detail || {};
    cb(mood, durationMs);
  };
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}

function readHidden(): boolean {
  try {
    return localStorage.getItem(MASCOT_HIDDEN_KEY) === "1";
  } catch {
    return false;
  }
}

function subscribe(cb: () => void) {
  window.addEventListener(VISIBILITY_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(VISIBILITY_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

/** Preferência "ocultar mascote", sincronizada entre componentes e abas. */
export function useMascotHidden(): boolean {
  // No servidor consideramos oculto para não "piscar" o mascote antes da hidratação.
  return useSyncExternalStore(subscribe, readHidden, () => true);
}

export function setMascotHidden(hidden: boolean) {
  try {
    if (hidden) localStorage.setItem(MASCOT_HIDDEN_KEY, "1");
    else localStorage.removeItem(MASCOT_HIDDEN_KEY);
  } catch {
    /* armazenamento indisponível: ignora */
  }
  window.dispatchEvent(new Event(VISIBILITY_EVENT));
}
