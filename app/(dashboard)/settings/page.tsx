import { cookies } from "next/headers";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/app/ui-bits";
import { SettingsClient } from "./settings-client";

export const metadata = { title: "Configurações" };

export default async function SettingsPage() {
  const user = await requireUser();
  const store = await cookies();
  return (
    <>
      <PageHeader title="Configurações" description="Sua conta, segurança e privacidade." />
      <SettingsClient
        user={{
          name: user.name || "",
          email: user.email,
          hasPassword: user.hasPassword,
          twoFactorEnabled: user.twoFactorEnabled,
          notifyOnComplete: user.notifyOnComplete,
          marketingOptIn: user.marketingOptIn,
        }}
        locale={store.get("NEXT_LOCALE")?.value === "en" ? "en" : "pt"}
        currency={store.get("CURRENCY")?.value || "BRL"}
      />
    </>
  );
}
