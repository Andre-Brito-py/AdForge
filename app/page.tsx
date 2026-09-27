import { db } from "@/lib/db";
import { cookies } from "next/headers";
import LandingPageClient from "./landing-client";

export default async function Page() {
  const cookieStore = await cookies();
  const locale = cookieStore.get('NEXT_LOCALE')?.value || 'pt';
  
  let plans: any[] = [];
  try {
    const config = await db.systemConfig.findUnique({ where: { id: "global" } });
    if (config?.plansJson) {
      plans = JSON.parse(config.plansJson);
    } else {
      // Planos de fallback se o banco estiver vazio
      plans = [
        { id: "starter", name: "Starter", price_brl: 49, price_usd: 10, credits: 200, isFeatured: false },
        { id: "pro", name: "Pro", price_brl: 99, price_usd: 20, credits: 800, isFeatured: true },
        { id: "scale", name: "Scale", price_brl: 199, price_usd: 40, credits: 2500, isFeatured: false }
      ];
    }
  } catch (e) {
    console.error("Error loading plans for landing page:", e);
  }

  return <LandingPageClient plans={plans} initialLocale={locale} />;
}
