import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PixelMascot } from "@/components/mascot/PixelMascot";
import { buttonClass } from "@/components/app/ui-bits";

export default async function NotFound() {
  const t = await getTranslations("errorPages");
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
      <PixelMascot mood="confused" size={88} />
      <p className="mt-6 text-sm font-medium text-brand">{t("notFoundCode")}</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">{t("notFoundTitle")}</h1>
      <p className="mt-2 max-w-sm text-muted-foreground">{t("notFoundText")}</p>
      <div className="mt-8 flex gap-2">
        <Link href="/" className={buttonClass("outline")}>{t("home")}</Link>
        <Link href="/dashboard" className={buttonClass("primary")}>{t("dashboard")}</Link>
      </div>
    </div>
  );
}
