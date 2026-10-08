import type { Instrumentation } from "next";

/**
 * Monitoramento de erros (Sentry). Desligado até existir SENTRY_DSN: sem a variável, nada é carregado.
 * Só erros (sem rastreamento de performance) e sem dados pessoais (ver dataCollection abaixo).
 */
const dsn = process.env.SENTRY_DSN;

export async function register() {
  if (!dsn) return;
  const Sentry = await import("@sentry/nextjs");
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV,
    tracesSampleRate: 0,
    // Nada pessoal: sem usuário, cookies, corpo, query string (links de senha/verificação têm token),
    // variáveis locais nem dados de banco ou de IA. Só a mensagem, a pilha e o navegador.
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: { request: { allow: ["user-agent", "content-type"] }, response: false },
      httpBodies: [],
      urlQueryParams: false,
      stackFrameVariables: false,
      databaseQueryData: false,
      genAI: { inputs: false, outputs: false },
    },
  });
}

export const onRequestError: Instrumentation.onRequestError = async (...args) => {
  if (!dsn) return;
  const Sentry = await import("@sentry/nextjs");
  Sentry.captureRequestError(...args);
};
