import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { getAppConfig } from "@/lib/config";
import { AuthShell } from "@/components/auth/auth-shell";
import { buttonClass } from "@/components/app/ui-bits";
import { SignupForm } from "./signup-form";
import { TERMS_VERSION } from "@/lib/terms";

export async function generateMetadata() {
  return { title: (await getLocale()) === "en" ? "Create account" : "Criar conta" };
}

export default async function SignupPage() {
  const { signupCredits, googleLogin, signupsEnabled, settings } = await getAppConfig();
  if (!signupsEnabled) {
    // Cadastros fechados em Admin › Configurações gerais.
    const t = await getTranslations("auth");
    const email = settings.company.supportEmail;
    return (
      <AuthShell title={t("signup.closedTitle")} mood="sleeping">
        <p className="text-sm text-muted-foreground">
          {t.rich("signup.closedText", { email, mail: (chunks) => <a href={`mailto:${email}`} className="font-medium text-brand hover:underline">{chunks}</a> })}
        </p>
        <Link href="/login" className={`${buttonClass("primary", "lg")} mt-6 w-full`}>{t("signup.signIn")}</Link>
      </AuthShell>
    );
  }
  return <SignupForm googleEnabled={googleLogin.active} signupCredits={signupCredits} termsVersion={TERMS_VERSION} />;
}
