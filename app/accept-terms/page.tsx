import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { hasCurrentTerms, TERMS_VERSION } from "@/lib/terms";
import { LEGAL_UPDATED_AT, LEGAL_UPDATED_AT_EN } from "@/lib/company";
import { AcceptTermsForm } from "./accept-terms-form";

export async function generateMetadata() {
  return { title: (await getLocale()) === "en" ? "Terms of Service" : "Termos de Uso" };
}

export default async function AcceptTermsPage() {
  const user = await requireUser();
  if (hasCurrentTerms(user)) redirect(user.onboardingCompleted ? "/dashboard" : "/onboarding");
  const en = (await getLocale()) === "en";
  return (
    <AcceptTermsForm
      version={TERMS_VERSION}
      updatedAt={en ? LEGAL_UPDATED_AT_EN : LEGAL_UPDATED_AT}
      // Conta que já tinha aceitado uma versão anterior: o texto fala em "atualizamos".
      updated={!!user.termsVersion}
      next={user.onboardingCompleted ? "/dashboard" : "/onboarding"}
    />
  );
}
