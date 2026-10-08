import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { hasCurrentTerms } from "@/lib/terms";
import { getWorkspaceBalance } from "@/services/credits";
import { AppShell } from "@/components/app/app-shell";

// Toda página do app passa por aqui: a sessão é validada no banco a cada requisição
// (o proxy faz só um redirecionamento rápido baseado no cookie).
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  // Sem o aceite da versão atual dos Termos (conta antiga, textos novos, Google pela tela de login): pede antes de tudo.
  if (!hasCurrentTerms(user)) redirect("/accept-terms");
  if (!user.onboardingCompleted) redirect("/onboarding");
  const balance = await getWorkspaceBalance(user.workspaceId);

  return (
    <AppShell
      user={{ name: user.name, email: user.email, isAdmin: user.isAdmin, emailVerified: !!user.emailVerified }}
      balance={balance}
    >
      {children}
    </AppShell>
  );
}
