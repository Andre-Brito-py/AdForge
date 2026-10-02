import { getLocale } from "next-intl/server";
import { CookiesPolicy } from "@/components/legal/cookies-policy";

export async function generateMetadata() {
  return { title: (await getLocale()) === "en" ? "Cookie Policy" : "Política de Cookies" };
}

export default async function CookiesPage() {
  const locale = (await getLocale()) === "en" ? "en" : "pt";
  return <CookiesPolicy locale={locale} />;
}
