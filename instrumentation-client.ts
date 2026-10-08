/**
 * Erros no navegador (Sentry). Só liga com NEXT_PUBLIC_SENTRY_DSN definido no build; sem ele, o SDK
 * nem entra no pacote do site. Sem gravação de sessão (replay) e sem dados pessoais: só a mensagem e a pilha do erro.
 */
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  // Carregado em paralelo à página: não atrasa a abertura do site.
  import("@sentry/nextjs")
    .then((Sentry) =>
      Sentry.init({
        dsn,
        environment: process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.NODE_ENV,
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
        // Extensões do navegador geram ruído que não é do Vysify.
        denyUrls: [/extensions\//i, /^chrome:\/\//i, /^moz-extension:\/\//i],
      })
    )
    .catch(() => undefined);
}
