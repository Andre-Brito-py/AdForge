# Vysify (AdForge AI)

Estúdio de anúncios com IA: o cliente envia a foto de um produto, escolhe objetivo e formato, e recebe estratégia, textos (headline, copy e CTA), imagens publicitárias e vídeos verticais com locução.

## Stack

- **Next.js 16** (App Router, `proxy.ts`) + React 19 + Tailwind CSS 4
- **PostgreSQL** (Supabase) com **Prisma 5** e migrations versionadas
- **NextAuth** (e-mail + senha com bcrypt, Google opcional, 2FA TOTP)
- **IA:** Google Gemini (estratégia, texto e imagem), fal.ai/Wan (vídeo), ElevenLabs ou OpenAI (locução)
- **Pagamentos:** Mercado Pago (Pix, cartão, boleto) e Stripe, em pacotes de créditos avulsos
- **E-mail:** Resend · **Arquivos:** S3 compatível (Supabase Storage, R2, AWS)

## Como funciona a geração

1. `POST /api/campaigns` valida o pedido, gera a estratégia com o Gemini (**antes** de cobrar) e debita os créditos de forma atômica.
2. Cada variação vira um `GenerationJob`, executado em segundo plano (`waitUntil`), com retentativa automática.
3. **Imagens** ficam prontas em segundos. **Vídeos** vão para a fila da fal.ai e são acompanhados pelo polling da tela de progresso e pelo cron `/api/cron/jobs`.
4. Se uma variação falhar, os créditos dela são **estornados automaticamente** e o cliente vê o aviso.

## Rodando localmente

```bash
cp .env.example .env        # preencha DATABASE_URL, DIRECT_URL, NEXTAUTH_SECRET e ENCRYPTION_KEY
npm install
npm run db:deploy           # aplica as migrations
npm run dev
```

1. Crie sua conta em `http://localhost:3000/signup`. Sem Resend configurado, o link de confirmação de e-mail aparece no terminal.
2. Torne-se administrador: `npm run admin:promote -- seu@email.com`.
3. Em **Admin › IA e custos**, cadastre a chave do Gemini (e a da fal.ai para vídeos).

## Scripts

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | `prisma generate` + build de produção |
| `npm run typecheck` | Gera os tipos de rota do Next e roda o `tsc` |
| `npm run lint` | ESLint |
| `npm test` | Testes (os de banco exigem `TEST_DATABASE_URL`, um banco **separado**) |
| `npm run db:migrate` | Cria uma nova migration a partir do `schema.prisma` (desenvolvimento) |
| `npm run db:deploy` | Aplica as migrations pendentes (produção) |
| `npm run admin:promote -- email` | Promove uma conta a SUPERADMIN |

## Segurança

- Senhas com bcrypt, bloqueio de 15 min após 5 tentativas erradas, rate limit (armazenado no Postgres) em login, cadastro, upload e geração.
- Sessão invalidada no servidor ao trocar a senha (`sessionVersion`).
- Todas as rotas verificam o dono do recurso (workspace). Não há acesso entre contas.
- Upload valida o tipo real do arquivo (magic bytes) e o tamanho; imagens de produto só podem vir do nosso armazenamento.
- Chaves de API e de pagamento ficam criptografadas (AES-256-GCM) e nunca voltam para o navegador.
- Webhooks: assinatura verificada (Stripe e Mercado Pago) e crédito idempotente (constraint única por pagamento).
- Headers de segurança (HSTS, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy).

Detalhes de deploy e pendências: [docs/GO_LIVE.md](docs/GO_LIVE.md).
