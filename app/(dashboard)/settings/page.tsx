import { cookies } from "next/headers";
import { getLocale, getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/app/ui-bits";
import { SettingsClient } from "./settings-client";

export async function generateMetadata() {
  return { title: (await getTranslations("nav"))("settings") };
}

export default async function SettingsPage() {
  const user = await requireUser();
  const t = await getTranslations("settings");
  const store = await cookies();
  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle")} />
      <SettingsClient
        user={{
          name: user.name || "",
          email: user.email,
          hasPassword: user.hasPassword,
          twoFactorEnabled: user.twoFactorEnabled,
          notifyOnComplete: user.notifyOnComplete,
          marketingOptIn: user.marketingOptIn,
        }}
        locale={await getLocale()}
        currency={store.get("CURRENCY")?.value || (user.locale === "en" ? "USD" : "BRL")}
      />
    </>
  );
}
