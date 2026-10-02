import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { ConsentManager } from "@/components/consent/ConsentManager";
import { TimezoneSync } from "@/components/timezone-sync";
import { getAppConfig } from "@/lib/config";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

const META = {
  pt: {
    title: "Vysify · Anúncios com IA a partir da foto do produto",
    description: "Envie a foto do seu produto e receba estratégia, textos, imagens e vídeos de anúncio prontos para Instagram, TikTok e Facebook.",
    og: "Estratégia, copy, imagens e vídeos de anúncio em minutos.",
    ogLocale: "pt_BR",
  },
  en: {
    title: "Vysify · AI ads from a single product photo",
    description: "Upload your product photo and get strategy, copy, images and video ads ready for Instagram, TikTok and Facebook — in 9 languages.",
    og: "Ad strategy, copy, images and videos in minutes.",
    ogLocale: "en_US",
  },
};

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) === "en" ? "en" : "pt";
  const m = META[locale];
  return {
    metadataBase: new URL(siteUrl),
    title: { default: m.title, template: "%s · Vysify" },
    description: m.description,
    applicationName: "Vysify",
    manifest: "/manifest.json",
    openGraph: { type: "website", siteName: "Vysify", locale: m.ogLocale, alternateLocale: locale === "pt" ? "en_US" : "pt_BR", title: m.title, description: m.og },
    twitter: { card: "summary_large_image" },
    appleWebApp: { capable: true, statusBarStyle: "default", title: "Vysify" },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fcfcfd" },
    { media: "(prefers-color-scheme: dark)", color: "#131316" },
  ],
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  const messages = await getMessages();
  const tz = (await cookies()).get("TZ")?.value || null;
  // Rastreadores configurados no painel; se o banco falhar, o site segue sem eles.
  const trackers = await getAppConfig().then((c) => c.settings.trackers).catch(() => ({ gaId: null, metaPixelId: null }));

  return (
    <html lang={locale === "pt" ? "pt-BR" : "en"} className={`${geistSans.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <body className="min-h-screen">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <NextIntlClientProvider messages={messages}>
            <Providers>{children}</Providers>
            <Toaster position="top-center" richColors />
            <ConsentManager gaId={trackers.gaId} pixelId={trackers.metaPixelId} />
            <TimezoneSync current={tz} />
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
