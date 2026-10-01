import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { CookieBanner } from "@/components/CookieBanner";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "Vysify · Anúncios com IA a partir da foto do produto", template: "%s · Vysify" },
  description: "Envie a foto do seu produto e receba estratégia, textos, imagens e vídeos de anúncio prontos para Instagram, TikTok e Facebook.",
  applicationName: "Vysify",
  manifest: "/manifest.json",
  openGraph: {
    type: "website",
    siteName: "Vysify",
    locale: "pt_BR",
    title: "Vysify · Anúncios com IA a partir da foto do produto",
    description: "Estratégia, copy, imagens e vídeos de anúncio em minutos.",
  },
  twitter: { card: "summary_large_image" },
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Vysify" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fcfcfd" },
    { media: "(prefers-color-scheme: dark)", color: "#131316" },
  ],
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale === "pt" ? "pt-BR" : locale} className={`${geistSans.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <body className="min-h-screen">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <NextIntlClientProvider messages={messages}>
            <Providers>{children}</Providers>
            <Toaster position="top-center" richColors />
            <CookieBanner />
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
