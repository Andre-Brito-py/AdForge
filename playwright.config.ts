import { defineConfig, devices } from "@playwright/test";

/**
 * Testes de ponta a ponta no navegador: cadastro, produto, campanha (com IA simulada) e compra.
 * Rodam contra um banco de TESTE (E2E_DATABASE_URL, com as migrations aplicadas) — nunca o do .env.
 *   E2E_DATABASE_URL=postgresql://... npm run test:e2e
 */
const db = process.env.E2E_DATABASE_URL;
if (!db) throw new Error("Defina E2E_DATABASE_URL com um Postgres de teste (nunca o de produção).");

const PORT = Number(process.env.E2E_PORT || 3200);
const MOCK_PORT = 54400;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  timeout: 120_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: { baseURL, trace: "retain-on-failure", locale: "pt-BR" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], locale: "pt-BR" } }],
  webServer: [
    {
      command: "node e2e/mock-ai.mjs",
      port: MOCK_PORT,
      reuseExistingServer: !process.env.CI,
    },
    {
      // Variáveis explícitas: as do .env (que pode apontar para produção) ficam por baixo destas.
      command: `npx next dev -p ${PORT}`,
      url: `${baseURL}/login`,
      timeout: 240_000,
      reuseExistingServer: !process.env.CI,
      env: {
        DATABASE_URL: db,
        DIRECT_URL: db,
        NEXTAUTH_SECRET: "e2e-only-not-a-secret",
        NEXTAUTH_URL: baseURL,
        NEXT_PUBLIC_APP_URL: baseURL,
        ENCRYPTION_KEY: "e2e-only-not-a-secret",
        CRON_SECRET: "e2e-cron-secret",
        GEMINI_API_KEY: "e2e-fake",
        GEMINI_BASE_URL: `http://localhost:${MOCK_PORT}`,
        // Nenhum outro provedor/gateway real: sem chaves, essas partes ficam desligadas.
        OPENAI_API_KEY: "", FAL_KEY: "", ELEVENLABS_API_KEY: "", STRIPE_SECRET_KEY: "", MERCADOPAGO_ACCESS_TOKEN: "",
        RESEND_API_KEY: "", GOOGLE_CLIENT_ID: "", GOOGLE_CLIENT_SECRET: "", S3_BUCKET: "", SENTRY_DSN: "", NEXT_PUBLIC_SENTRY_DSN: "",
        NEXT_TELEMETRY_DISABLED: "1",
      },
    },
  ],
});
