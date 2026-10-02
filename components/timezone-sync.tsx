"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Grava o fuso horário do navegador num cookie para o servidor formatar datas no horário local. */
export function TimezoneSync({ current }: { current: string | null }) {
  const router = useRouter();
  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    // Nomes IANA (ex.: America/New_York) só têm caracteres válidos em cookie.
    if (tz && tz !== current && /^[A-Za-z0-9_+\-/]+$/.test(tz)) {
      document.cookie = `TZ=${tz}; path=/; max-age=31536000; samesite=lax`;
      router.refresh();
    }
  }, [current, router]);
  return null;
}
