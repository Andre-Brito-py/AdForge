import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';

export default getRequestConfig(async () => {
  // Ler o idioma dos cookies. Se não tiver, usar 'pt' como fallback
  const cookieStore = cookies();
  const locale = cookieStore.get('NEXT_LOCALE')?.value || 'pt';

  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default
  };
});
