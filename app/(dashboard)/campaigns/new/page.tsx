import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getAppConfig } from "@/lib/config";
import { getWorkspaceBalance } from "@/services/credits";
import { PageHeader } from "@/components/app/ui-bits";
import { defaultAdLanguage } from "@/lib/locale";
import { CampaignWizard } from "./wizard";

export async function generateMetadata() {
  return { title: (await getTranslations("nav"))("newCampaign") };
}

export default async function NewCampaignPage(props: PageProps<"/campaigns/new">) {
  const user = await requireUser();
  const t = await getTranslations("campaigns");
  const sp = await props.searchParams;
  const initialProductId = typeof sp.productId === "string" ? sp.productId : "";

  const [products, balance, config, lastCampaign] = await Promise.all([
    db.product.findMany({
      where: { workspaceId: user.workspaceId },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, originalImageUrl: true, targetAudience: true },
    }),
    getWorkspaceBalance(user.workspaceId),
    getAppConfig(),
    // Reaproveita o idioma usado na última campanha (quem vende para os EUA continua em inglês).
    db.campaign.findFirst({ where: { workspaceId: user.workspaceId }, orderBy: { createdAt: "desc" }, select: { language: true } }),
  ]);

  const locale = user.locale === "en" ? "en" : "pt";
  return (
    <>
      <PageHeader back={{ href: "/campaigns", label: t("title") }} title={t("wizard.title")} description={t("wizard.subtitle")} />
      <CampaignWizard
        products={products}
        initialProductId={products.some((p) => p.id === initialProductId) ? initialProductId : ""}
        balance={balance}
        costs={config.costs}
        availability={{ IMAGE: !!config.secrets.geminiKey, VIDEO: !!config.secrets.wanKey && (!!config.secrets.geminiKey || !!config.secrets.openAiKey) }}
        emailVerified={!!user.emailVerified}
        defaultLanguage={lastCampaign?.language || defaultAdLanguage(locale, user.country)}
        locale={locale}
      />
    </>
  );
}
