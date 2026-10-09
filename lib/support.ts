/**
 * Atendimento pelo WhatsApp: número, dias e horário configurados em Admin › Configurações gerais.
 * Código puro (servidor e navegador). O horário vale no fuso de Brasília e pode passar da meia-noite
 * (ex.: 07:00–02:30 = aberto das 7h até as 2h30 da madrugada seguinte).
 */
export interface SupportConfig {
  /** Só dígitos, com DDI (ex.: 5511999998888). Vazio = suporte por WhatsApp desligado. */
  whatsapp: string | null;
  start: string; // "07:00"
  end: string; // "02:30"
  /** Dias em que o atendimento COMEÇA (0 = domingo ... 6 = sábado). */
  days: number[];
  timezone: string;
  message: string;
}

export const DEFAULT_SUPPORT: Omit<SupportConfig, "whatsapp"> = {
  start: "07:00",
  end: "02:30",
  days: [0, 1, 2, 3, 4, 5, 6],
  timezone: "America/Sao_Paulo",
  message: "Olá! Preciso de ajuda com a Vysify.",
};

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

/** Dia da semana (0-6) e minutos do dia no fuso do atendimento. */
function localNow(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value || "";
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  const hour = Number(get("hour")) % 24;
  return { day, minutes: hour * 60 + Number(get("minute")) };
}

export function isSupportOpen(cfg: Omit<SupportConfig, "whatsapp" | "message">, date = new Date()): boolean {
  const { day, minutes } = localNow(date, cfg.timezone);
  const start = toMinutes(cfg.start);
  const end = toMinutes(cfg.end);
  if (start === end) return cfg.days.includes(day); // 24 h nos dias marcados
  if (end > start) return cfg.days.includes(day) && minutes >= start && minutes < end;
  // Passa da meia-noite: aberto do início até 23:59 no dia marcado, e de 00:00 até o fim no dia seguinte.
  const yesterday = (day + 6) % 7;
  return (cfg.days.includes(day) && minutes >= start) || (cfg.days.includes(yesterday) && minutes < end);
}

/** Quando abre de novo: { inDays: 0 = hoje, 1 = amanhã, ...; day: dia da semana; time: "07:00" }. */
export function nextOpening(cfg: Omit<SupportConfig, "whatsapp" | "message">, date = new Date()) {
  const { day, minutes } = localNow(date, cfg.timezone);
  const start = toMinutes(cfg.start);
  for (let i = 0; i < 8; i++) {
    const d = (day + i) % 7;
    if (!cfg.days.includes(d)) continue;
    if (i === 0 && minutes >= start) continue;
    return { inDays: i, day: d, time: cfg.start };
  }
  return null;
}

export function whatsappLink(cfg: Pick<SupportConfig, "whatsapp" | "message">, extra?: string) {
  if (!cfg.whatsapp) return null;
  const text = [cfg.message, extra].filter(Boolean).join("\n");
  return `https://wa.me/${cfg.whatsapp}?text=${encodeURIComponent(text)}`;
}

/** "07:00" → "7h" / "02:30" → "2h30" (pt) ou "7:00 AM" (en). */
export function formatHour(hhmm: string, locale: "pt" | "en") {
  const [h, m] = hhmm.split(":").map(Number);
  if (locale === "en") {
    const suffix = h < 12 ? "AM" : "PM";
    return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${suffix}`;
  }
  return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}
