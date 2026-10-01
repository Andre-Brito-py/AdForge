import { cookies } from "next/headers";
import { getAppConfig, purchasablePlans } from "@/lib/config";
import { getSessionUser } from "@/lib/auth";
import LandingPageClient from "./landing-client";

export default async function Page() {
  const locale = (await cookies()).get("NEXT_LOCALE")?.value === "en" ? "en" : "pt";
  let plans: Awaited<ReturnType<typeof getAppConfig>>["plans"] = [];
  let signupCredits = 0;
  let freePlanVisible = false;
  let costs = { image: 3, video: 10, premiumMultiplier: 2 };
  try {
    const config = await getAppConfig();
    plans = purchasablePlans(config.plans);
    signupCredits = config.signupCredits; // 0 quando a oferta grátis está desligada
    freePlanVisible = config.freeTrial.planVisible;
    costs = config.costs;
  } catch (e) {
    console.error("[landing] falha ao carregar configuração", e);
  }
  const user = await getSessionUser().catch(() => null);

  return <LandingPageClient plans={plans} signupCredits={signupCredits} freePlanVisible={freePlanVisible} costs={costs} locale={locale} loggedIn={!!user} />;
}
