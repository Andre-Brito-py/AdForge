// Formatação fora do contexto de React (e-mails, painel admin).
// Nas telas, prefira o formatador do next-intl (useFormatter/getFormatter), que já
// respeita o idioma e o fuso horário do visitante.

const tag = (locale?: string | null) => (locale === "en" ? "en-US" : "pt-BR");

export function formatDateTime(date: Date | string, locale?: string | null, timeZone = "America/Sao_Paulo"): string {
  return new Intl.DateTimeFormat(tag(locale), { dateStyle: "medium", timeStyle: "short", timeZone }).format(new Date(date));
}

export function formatMoney(amount: number, currency = "BRL", locale?: string | null) {
  return new Intl.NumberFormat(tag(locale), { style: "currency", currency }).format(amount);
}
