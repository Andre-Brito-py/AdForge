export const LOCALES = ["pt", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "pt";

export const CURRENCIES = ["BRL", "USD", "EUR"] as const;
export type Currency = (typeof CURRENCIES)[number];

export function isLocale(value: string | null | undefined): value is Locale {
  return !!value && (LOCALES as readonly string[]).includes(value);
}

export function isCurrency(value: string | null | undefined): value is Currency {
  return !!value && (CURRENCIES as readonly string[]).includes(value);
}

/** Tag BCP 47 usada para formatar datas e números. */
export function intlLocale(locale: Locale) {
  return locale === "pt" ? "pt-BR" : "en-US";
}

/**
 * Escolhe o idioma pelo header Accept-Language respeitando a ordem/peso (q).
 * Ex.: "pt-BR,pt;q=0.9,en-US;q=0.8" => "pt" (antes, qualquer "en" na lista virava inglês).
 * Idiomas sem tradução (ex.: espanhol) caem para o inglês se o país não for o Brasil.
 */
export function pickLocale(acceptLanguage: string | null | undefined, country?: string | null): Locale {
  if (acceptLanguage) {
    const ranked = acceptLanguage
      .split(",")
      .map((part, index) => {
        const [tag, ...params] = part.trim().split(";");
        const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
        const weight = q ? Number(q.slice(2)) : 1;
        return { lang: tag.toLowerCase().split("-")[0], weight: Number.isFinite(weight) ? weight : 0, index };
      })
      .filter((x) => x.lang && x.weight > 0)
      .sort((a, b) => b.weight - a.weight || a.index - b.index);

    for (const { lang } of ranked) {
      if (isLocale(lang)) return lang;
    }
    if (ranked.length > 0) return country && country.toUpperCase() !== "BR" ? "en" : DEFAULT_LOCALE;
  }
  if (country) return country.toUpperCase() === "BR" ? "pt" : "en";
  return DEFAULT_LOCALE;
}

// Zona do euro (para sugerir EUR quando houver preço em euro configurado).
const EUROZONE = new Set(["AT", "BE", "HR", "CY", "EE", "FI", "FR", "DE", "GR", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PT", "SK", "SI", "ES"]);

/** Moeda padrão pelo país do visitante (header de geolocalização da hospedagem). */
export function currencyForCountry(country: string | null | undefined, locale: Locale): Currency {
  const c = country?.toUpperCase();
  if (c === "BR") return "BRL";
  if (c && EUROZONE.has(c)) return "EUR";
  if (c) return "USD";
  return locale === "pt" ? "BRL" : "USD";
}

/**
 * Prazo de reembolso de créditos não usados: 7 dias no Brasil (art. 49 do CDC) e
 * 14 dias nas compras internacionais (padrão do direito de retratação da UE/Reino Unido).
 */
export function refundWindowDays(currency: Currency | string) {
  return currency === "BRL" ? 7 : 14;
}

/** País do visitante a partir dos headers de CDN (Vercel ou Cloudflare). */
export function countryFromHeaders(headers: Headers): string | null {
  const c = headers.get("x-vercel-ip-country") || headers.get("cf-ipcountry");
  return c && /^[A-Za-z]{2}$/.test(c) ? c.toUpperCase() : null;
}

export function isValidTimeZone(tz: string | null | undefined): tz is string {
  if (!tz || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Idiomas em que a IA pode escrever os anúncios (independente do idioma da interface). */
export const AD_LANGUAGES = {
  "pt-BR": { pt: "Português (Brasil)", en: "Portuguese (Brazil)", prompt: "Brazilian Portuguese" },
  "pt-PT": { pt: "Português (Portugal)", en: "Portuguese (Portugal)", prompt: "European Portuguese" },
  "en-US": { pt: "Inglês (EUA)", en: "English (US)", prompt: "American English" },
  "en-GB": { pt: "Inglês (Reino Unido)", en: "English (UK)", prompt: "British English" },
  "es-ES": { pt: "Espanhol (Espanha)", en: "Spanish (Spain)", prompt: "Spanish from Spain" },
  "es-419": { pt: "Espanhol (América Latina)", en: "Spanish (Latin America)", prompt: "Latin American Spanish" },
  "fr-FR": { pt: "Francês", en: "French", prompt: "French" },
  "de-DE": { pt: "Alemão", en: "German", prompt: "German" },
  "it-IT": { pt: "Italiano", en: "Italian", prompt: "Italian" },
} as const;
export type AdLanguage = keyof typeof AD_LANGUAGES;
export const AD_LANGUAGE_KEYS = Object.keys(AD_LANGUAGES) as [AdLanguage, ...AdLanguage[]];

export function defaultAdLanguage(locale: Locale, country?: string | null): AdLanguage {
  const c = country?.toUpperCase();
  if (c === "BR") return "pt-BR";
  if (c === "PT") return "pt-PT";
  if (c === "GB" || c === "IE") return "en-GB";
  if (c === "ES") return "es-ES";
  if (c && ["MX", "AR", "CO", "CL", "PE", "UY", "PY", "BO", "EC", "VE", "CR", "PA", "DO", "GT", "HN", "SV", "NI"].includes(c)) return "es-419";
  if (c === "FR") return "fr-FR";
  if (c === "DE" || c === "AT") return "de-DE";
  if (c === "IT") return "it-IT";
  return locale === "pt" ? "pt-BR" : "en-US";
}
