import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/logo";
import { getCompany } from "@/lib/company";

export async function generateMetadata() {
  return { title: (await getTranslations("metaDeletion"))("title") };
}

// Página de status exigida pela Meta para pedidos de exclusão de dados.
export default async function MetaDataDeletionPage(props: PageProps<"/meta-data-deletion">) {
  const t = await getTranslations("metaDeletion");
  const COMPANY = await getCompany();
  const sp = await props.searchParams;
  const code = typeof sp.code === "string" ? sp.code.slice(0, 32) : null;
  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <Logo />
      <h1 className="mt-10 text-2xl font-semibold tracking-tight">{t("title")}</h1>
      <p className="mt-4 text-muted-foreground">{t("text")}</p>
      {code && <p className="mt-4 text-sm">{t("code")} <code className="rounded bg-muted px-2 py-1 font-mono">{code}</code></p>}
      <p className="mt-6 text-sm text-muted-foreground">
        {t.rich("more", {
          email: COMPANY.privacyEmail,
          mail: (chunks) => <a href={`mailto:${COMPANY.privacyEmail}`} className="underline">{chunks}</a>,
          privacy: (chunks) => <Link href="/legal/privacy" className="underline">{chunks}</Link>,
        })}
      </p>
    </div>
  );
}
