import { getRequestConfig } from "next-intl/server";
import { cookies, headers } from "next/headers";
import { countryFromHeaders, isLocale, isValidTimeZone, pickLocale } from "./lib/locale";

export default getRequestConfig(async () => {
  const store = await cookies();
  const h = await headers();
  const cookieLocale = store.get("NEXT_LOCALE")?.value;
  // Só aceitamos idiomas suportados: um cookie adulterado não consegue importar arquivos arbitrários.
  const locale = isLocale(cookieLocale) ? cookieLocale : pickLocale(h.get("accept-language"), countryFromHeaders(h));

  // Fuso do navegador (gravado pelo TimezoneSync); padrão: São Paulo para pt, UTC para en.
  const tzCookie = store.get("TZ")?.value;
  const timeZone = isValidTimeZone(tzCookie) ? tzCookie : locale === "pt" ? "America/Sao_Paulo" : "UTC";

  return {
    locale,
    timeZone,
    messages: (await import(`./messages/${locale}.json`)).default,
    formats: {
      dateTime: {
        short: { dateStyle: "medium", timeStyle: "short" },
        date: { dateStyle: "medium" },
      },
    },
  };
});
