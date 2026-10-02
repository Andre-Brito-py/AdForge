import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/app/ui-bits";
import { BrandForm } from "./brand-form";

export const metadata = { title: "Brand Kit" };

export default async function BrandPage() {
  const user = await requireUser();
  const t = await getTranslations("brand");
  const brand = await db.brandKit.findUnique({ where: { workspaceId: user.workspaceId } });
  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle")} />
      <BrandForm
        initial={{
          brandName: brand?.brandName || "",
          primaryColor: brand?.primaryColor || "#7c3aed",
          tone: brand?.tone || "",
          website: brand?.website || "",
          logoUrl: brand?.logoUrl || "",
        }}
      />
    </>
  );
}
