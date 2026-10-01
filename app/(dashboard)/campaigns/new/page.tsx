import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getAppConfig } from "@/lib/config";
import { getWorkspaceBalance } from "@/services/credits";
import { PageHeader } from "@/components/app/ui-bits";
import { CampaignWizard } from "./wizard";

export const metadata = { title: "Nova campanha" };

export default async function NewCampaignPage(props: PageProps<"/campaigns/new">) {
  const user = await requireUser();
  const sp = await props.searchParams;
  const initialProductId = typeof sp.productId === "string" ? sp.productId : "";

  const [products, balance, config] = await Promise.all([
    db.product.findMany({
      where: { workspaceId: user.workspaceId },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, originalImageUrl: true, targetAudience: true },
    }),
    getWorkspaceBalance(user.workspaceId),
    getAppConfig(),
  ]);

  return (
    <>
      <PageHeader back={{ href: "/campaigns", label: "Campanhas" }} title="Nova campanha" description="Quatro passos e a IA monta tudo para você." />
      <CampaignWizard
        products={products}
        initialProductId={products.some((p) => p.id === initialProductId) ? initialProductId : ""}
        balance={balance}
        costs={config.costs}
        availability={{ IMAGE: !!config.secrets.geminiKey, VIDEO: !!config.secrets.wanKey && (!!config.secrets.geminiKey || !!config.secrets.openAiKey) }}
        emailVerified={!!user.emailVerified}
      />
    </>
  );
}
