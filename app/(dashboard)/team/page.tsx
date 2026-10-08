import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/app/ui-bits";
import { TeamClient } from "./team-client";

export async function generateMetadata() {
  return { title: (await getTranslations("nav"))("team") };
}

export default async function TeamPage() {
  const user = await requireUser();
  const t = await getTranslations("team");
  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle")} />
      <TeamClient meId={user.id} myRole={user.workspaceRole} emailVerified={!!user.emailVerified} />
    </>
  );
}
