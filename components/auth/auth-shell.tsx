import Link from "next/link";
import { Logo } from "@/components/logo";
import { PixelMascot, type MascotMood } from "@/components/mascot/PixelMascot";
import { useTranslations } from "next-intl";
import { CookieSettingsButton } from "@/components/consent/ConsentManager";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
  mood = "idle",
}: {
  title: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  mood?: MascotMood;
}) {
  const t = useTranslations("auth");
  const tc = useTranslations("common");
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1.1fr]">
      <aside className="relative hidden overflow-hidden border-r border-border bg-muted/40 lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full bg-brand/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 right-0 h-80 w-80 rounded-full bg-brand/10 blur-3xl" />
        <Logo className="relative" />
        <div className="relative max-w-md">
          <PixelMascot mood="happy" size={72} />
          <p className="mt-6 text-3xl font-semibold leading-tight tracking-tight">
            {t("tagline")}
          </p>
          <p className="mt-4 text-muted-foreground">
            {t("taglineSub")}
          </p>
        </div>
        <p className="relative text-xs text-muted-foreground">© {new Date().getFullYear()} Vysify</p>
      </aside>

      <main className="flex flex-col px-5 py-8 sm:px-10">
        <div className="lg:hidden"><Logo /></div>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          <div className="mb-6 lg:hidden"><PixelMascot mood={mood} size={48} /></div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>}
          <div className="mt-8">{children}</div>
          {footer && <div className="mt-8 text-center text-sm text-muted-foreground">{footer}</div>}
        </div>
        <p className="text-center text-xs text-muted-foreground">
          <Link href="/legal/terms" className="hover:text-foreground">{tc("legal.terms")}</Link> · <Link href="/legal/privacy" className="hover:text-foreground">{tc("legal.privacy")}</Link> · <CookieSettingsButton className="hover:text-foreground" />
        </p>
      </main>
    </div>
  );
}

export function GoogleButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  const t = useTranslations("auth");
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className="inline-flex h-11 w-full items-center justify-center gap-3 rounded-xl border border-border bg-card text-sm font-medium transition hover:bg-muted disabled:opacity-60">
      <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
      </svg>
      {t("google")}
    </button>
  );
}

export function Divider() {
  const t = useTranslations("auth");
  return (
    <div className="relative my-6 text-center text-xs uppercase text-muted-foreground">
      <span className="absolute inset-x-0 top-1/2 border-t border-border" />
      <span className="relative bg-background px-3">{t("or")}</span>
    </div>
  );
}
