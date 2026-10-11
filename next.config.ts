import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n.ts");

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

// Fonte das legendas e da tela final dos vídeos (Geist, que já vem com o Next).
const VIDEO_FONT = "./node_modules/next/dist/compiled/@vercel/og/Geist-Regular.ttf";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // ffmpeg-static localiza o binário pelo próprio caminho: não pode ser empacotado pelo bundler.
  serverExternalPackages: ["ffmpeg-static"],
  // Rotas que geram/avançam criativos (último quadro, união dos trechos, locução, logo) precisam do binário no deploy.
  outputFileTracingIncludes: {
    // Colchetes escapados: a chave é um glob (picomatch) sobre o caminho da rota.
    "/api/campaigns": ["./node_modules/ffmpeg-static/ffmpeg*", VIDEO_FONT],
    "/api/campaigns/\\[id\\]": ["./node_modules/ffmpeg-static/ffmpeg*", VIDEO_FONT],
    "/api/campaigns/\\[id\\]/creatives": ["./node_modules/ffmpeg-static/ffmpeg*", VIDEO_FONT],
    "/api/cron/jobs": ["./node_modules/ffmpeg-static/ffmpeg*", VIDEO_FONT],
    "/api/jobs/run": ["./node_modules/ffmpeg-static/ffmpeg*", VIDEO_FONT],
    "/api/creatives/\\[id\\]/format": ["./node_modules/ffmpeg-static/ffmpeg*", VIDEO_FONT],
    // Reels/Stories geram a versão 9:16 na hora; "gerar mais como este" pode rodar a geração na mesma chamada.
    "/api/publications": ["./node_modules/ffmpeg-static/ffmpeg*", VIDEO_FONT],
    "/api/campaigns/\\[id\\]/winner": ["./node_modules/ffmpeg-static/ffmpeg*", VIDEO_FONT],
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Arquivos enviados em dev local: nunca executar como página.
      { source: "/uploads/:path*", headers: [{ key: "Content-Security-Policy", value: "default-src 'none'; img-src 'self'; media-src 'self'; sandbox" }] },
    ];
  },
};

export default withNextIntl(nextConfig);
