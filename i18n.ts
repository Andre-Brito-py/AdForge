import { getRequestConfig } from "next-intl/server";
import { cookies, headers } from "next/headers";
import { isLocale, pickLocale } from "./lib/locale";

export default getRequestConfig(async () => {
  const cookieLocale = (await cookies()).get("NEXT_LOCALE")?.value;
  // Só aceitamos idiomas suportados: um cookie adulterado não consegue importar arquivos arbitrários.
  const locale = isLocale(cookieLocale) ? cookieLocale : pickLocale((await headers()).get("accept-language"));

  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
  };
});
