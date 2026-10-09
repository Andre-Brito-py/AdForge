import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { listUserWorkspaces } from "@/lib/workspaces";
import { getAppConfig } from "@/lib/config";

// Mesmo nome usado em app/invite/[token]/accept-invite.tsx.
const PENDING_INVITE_COOKIE = "vysify_invite";
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
  // Convite aberto antes do login/cadastro: volta para ele.
  const pendingInvite = (await cookies()).get(PENDING_INVITE_COOKIE)?.value;
  if (pendingInvite && /^[A-Za-z0-9_-]{20,100}$/.test(pendingInvite)) redirect(`/invite/${pendingInvite}`);
  const [balance, workspaces, config] = await Promise.all([getWorkspaceBalance(user.workspaceId), listUserWorkspaces(user.id), getAppConfig()]);

  return (
    <AppShell
      user={{
        name: user.name, email: user.email, isAdmin: user.isAdmin, emailVerified: !!user.emailVerified,
        workspaces: workspaces.map((w) => ({ id: w.id, name: w.name })), workspaceId: user.workspaceId,
        support: config.settings.support,
      }}
      balance={balance}
    >
      {children}
    </AppShell>
  );
}
