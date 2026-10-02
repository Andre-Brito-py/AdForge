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

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // ffmpeg-static localiza o binário pelo próprio caminho: não pode ser empacotado pelo bundler.
  serverExternalPackages: ["ffmpeg-static"],
  // Rotas que avançam vídeos (último quadro, união dos trechos, locução) precisam do binário no deploy.
  outputFileTracingIncludes: {
    // Colchetes escapados: a chave é um glob (picomatch) sobre o caminho da rota.
    "/api/campaigns/\\[id\\]": ["./node_modules/ffmpeg-static/ffmpeg*"],
    "/api/cron/jobs": ["./node_modules/ffmpeg-static/ffmpeg*"],
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
