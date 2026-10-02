import { cookies } from "next/headers";
import { getLocale } from "next-intl/server";
import { isCurrency, type Currency } from "@/lib/locale";
import { getAppConfig, purchasablePlans } from "@/lib/config";
import { getSessionUser } from "@/lib/auth";
import LandingPageClient from "./landing-client";

export default async function Page() {
  const locale = (await getLocale()) === "en" ? "en" : "pt";
  const cookieCurrency = (await cookies()).get("CURRENCY")?.value;
  const currency: Currency = isCurrency(cookieCurrency) ? cookieCurrency : locale === "pt" ? "BRL" : "USD";
  let plans: Awaited<ReturnType<typeof getAppConfig>>["plans"] = [];
  let signupCredits = 0;
  let freePlanVisible = false;
  let costs = { image: 3, video: 10, premiumMultiplier: 2 };
  let supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "suporte@vysify.com";
  try {
    const config = await getAppConfig();
    plans = purchasablePlans(config.plans);
    supportEmail = config.settings.company.supportEmail;
    signupCredits = config.signupCredits; // 0 quando a oferta grátis está desligada
    freePlanVisible = config.freeTrial.planVisible;
    costs = config.costs;
  } catch (e) {
    console.error("[landing] falha ao carregar configuração", e);
  }
  const user = await getSessionUser().catch(() => null);

  return <LandingPageClient plans={plans} signupCredits={signupCredits} freePlanVisible={freePlanVisible} costs={costs} locale={locale} currency={currency} loggedIn={!!user} supportEmail={supportEmail} />;
}
