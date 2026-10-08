import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { getSessionUser } from "@/lib/auth";
import { findInvite } from "@/lib/members";
import { AuthShell } from "@/components/auth/auth-shell";
import { buttonClass } from "@/components/app/ui-bits";
import { AcceptInvite } from "./accept-invite";

export async function generateMetadata() {
  return { title: (await getLocale()) === "en" ? "Invitation" : "Convite" };
}

export default async function InvitePage(props: PageProps<"/invite/[token]">) {
  const { token } = await props.params;
  const t = await getTranslations("team.invitePage");
  const [invite, user] = await Promise.all([findInvite(token), getSessionUser()]);

  if (!invite) {
    return (
      <AuthShell title={t("invalidTitle")} subtitle={t("invalidText")}>
        <AcceptInvite token={token} mode="clear" />
        <Link href={user ? "/dashboard" : "/login"} className={`${buttonClass("brand", "lg")} w-full`}>{user ? t("goDashboard") : t("signIn")}</Link>
      </AuthShell>
    );
  }

  const subtitle = t("text", { inviter: invite.inviterName || "—", workspace: invite.workspace.name });
  if (!user) {
    // Guarda o convite: depois do login/cadastro (com este e-mail), a pessoa volta para cá.
    return (
      <AuthShell title={t("title", { workspace: invite.workspace.name })} subtitle={subtitle}>
        <AcceptInvite token={token} mode="remember" />
        <p className="mb-4 text-sm text-muted-foreground">{t("useEmail", { email: invite.email })}</p>
        <div className="space-y-2">
          <Link href={`/signup?email=${encodeURIComponent(invite.email)}`} className={`${buttonClass("brand", "lg")} w-full`}>{t("createAccount")}</Link>
          <Link href={`/login?from=${encodeURIComponent(`/invite/${token}`)}`} className={`${buttonClass("outline", "lg")} w-full`}>{t("signIn")}</Link>
        </div>
      </AuthShell>
    );
  }

  const wrongEmail = user.email.toLowerCase() !== invite.email.toLowerCase();
  return (
    <AuthShell title={t("title", { workspace: invite.workspace.name })} subtitle={subtitle}>
      {wrongEmail ? (
        <div className="space-y-4">
          <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2.5 text-sm text-destructive">{t("otherEmail", { email: invite.email, current: user.email })}</p>
          <AcceptInvite token={token} mode="signout" />
        </div>
      ) : (
        <AcceptInvite token={token} mode="accept" />
      )}
    </AuthShell>
  );
}
