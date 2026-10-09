import { describe, expect, it } from "vitest";
import { DEFAULT_SUPPORT, formatHour, isSupportOpen, nextOpening, whatsappLink } from "@/lib/support";

// Datas em UTC; Brasília = UTC-3 (sem horário de verão).
const brt = (iso: string) => new Date(`${iso}-03:00`);
const cfg = { ...DEFAULT_SUPPORT }; // 07:00–02:30, todos os dias

describe("horário do suporte (Brasília, passando da meia-noite)", () => {
  it("aberto das 7h até as 2h30 da madrugada seguinte", () => {
    expect(isSupportOpen(cfg, brt("2026-10-09T06:59"))).toBe(false);
    expect(isSupportOpen(cfg, brt("2026-10-09T07:00"))).toBe(true);
    expect(isSupportOpen(cfg, brt("2026-10-09T23:30"))).toBe(true);
    expect(isSupportOpen(cfg, brt("2026-10-10T02:29"))).toBe(true);
    expect(isSupportOpen(cfg, brt("2026-10-10T02:30"))).toBe(false);
  });

  it("dias desligados: a madrugada pertence ao dia anterior", () => {
    const weekdays = { ...cfg, days: [1, 2, 3, 4, 5] }; // segunda a sexta
    // Sábado 01:00 ainda é o expediente de sexta.
    expect(isSupportOpen(weekdays, brt("2026-10-10T01:00"))).toBe(true);
    // Sábado 10:00 está fechado; volta segunda às 7h.
    expect(isSupportOpen(weekdays, brt("2026-10-10T10:00"))).toBe(false);
    expect(nextOpening(weekdays, brt("2026-10-10T10:00"))).toEqual({ inDays: 2, day: 1, time: "07:00" });
  });

  it("antes de abrir, avisa que volta hoje", () => {
    expect(nextOpening(cfg, brt("2026-10-09T05:00"))).toEqual({ inDays: 0, day: 5, time: "07:00" });
  });

  it("link do WhatsApp com a mensagem e o e-mail da conta", () => {
    const link = whatsappLink({ whatsapp: "5511999998888", message: "Olá!" }, "Minha conta: a@b.com");
    expect(link).toBe(`https://wa.me/5511999998888?text=${encodeURIComponent("Olá!\nMinha conta: a@b.com")}`);
    expect(whatsappLink({ whatsapp: null, message: "x" })).toBeNull();
    expect(formatHour("02:30", "pt")).toBe("2h30");
    expect(formatHour("07:00", "pt")).toBe("7h");
  });
});
