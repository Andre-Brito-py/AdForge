import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/app/ui-bits";
import { BrandForm } from "./brand-form";

export const metadata = { title: "Brand Kit" };

export default async function BrandPage() {
  const user = await requireUser();
  const brand = await db.brandKit.findUnique({ where: { workspaceId: user.workspaceId } });
  return (
    <>
      <PageHeader title="Brand Kit" description="A identidade da sua marca. A IA usa estas informações em todas as campanhas." />
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
