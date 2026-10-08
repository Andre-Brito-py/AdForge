import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { hasCurrentTerms } from "@/lib/terms";
import { getWorkspaceBalance } from "@/services/credits";
import { getLocale } from "next-intl/server";
import { OnboardingClient } from "./onboarding-client";

export async function generateMetadata() {
  return { title: (await getLocale()) === "en" ? "Welcome" : "Boas-vindas" };
}

export default async function OnboardingPage() {
  const user = await getSessionUser();
  if (user && !hasCurrentTerms(user)) redirect("/accept-terms");
  // Mostra o saldo real: só fala em créditos se a conta de fato tiver recebido algum.
  const balance = user ? await getWorkspaceBalance(user.workspaceId) : 0;
  return <OnboardingClient welcomeCredits={balance} />;
}
