import { getSessionUser } from "@/lib/auth";
import { getWorkspaceBalance } from "@/services/credits";
import { OnboardingClient } from "./onboarding-client";

export const metadata = { title: "Boas-vindas" };

export default async function OnboardingPage() {
  const user = await getSessionUser();
  // Mostra o saldo real: só fala em créditos se a conta de fato tiver recebido algum.
  const balance = user ? await getWorkspaceBalance(user.workspaceId) : 0;
  return <OnboardingClient welcomeCredits={balance} />;
}
