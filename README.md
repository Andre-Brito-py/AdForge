# Vysify (AdForge AI)

Estúdio de anúncios com IA: o cliente envia a foto de um produto, escolhe objetivo e formato, e recebe estratégia, textos (headline, copy e CTA), imagens publicitárias e vídeos verticais com locução. Depois, baixa os criativos ou publica direto no Instagram e no Facebook.

```
foto + configurações  →  campanha gerada pela IA  →  download  ou  publicação direta
```

## Funcionalidades

| Área | O que existe | Status |
| --- | --- | --- |
| Conta | Cadastro com senha (bcrypt), confirmação de e-mail, recuperação de senha, 2FA (TOTP), login com Google opcional | ✅ Pronto |
| Produtos | Upload da foto com validação real do arquivo, biblioteca de produtos | ✅ Pronto |
| Campanhas | Assistente em 4 passos, estratégia + copy, imagens (Gemini) e vídeos com locução (fal.ai/Wan + ElevenLabs/OpenAI), nova variação com instruções | ✅ Pronto |
| Créditos | Débito atômico, estorno automático em falhas, extrato | ✅ Pronto |
| Pagamentos | Pacotes avulsos via Mercado Pago (Pix, cartão, boleto) e Stripe, webhooks idempotentes | ✅ Pronto |
| Teste grátis | Créditos no cadastro e card "Grátis" na landing, **desligados por padrão** (Admin › Teste grátis) | ✅ Pronto |
| Publicação Meta | Instagram (Feed, Reels, Stories) e Página do Facebook, direto da galeria | ✅ Código pronto · falta o app/App Review da Meta ([guia](docs/META_SETUP.md)) |
| Lojas | Mercado Livre e Nuvemshop (enviar o criativo como foto do produto) | 🚧 Em andamento: conectores prontos, faltam rotas, UI e testes |
| Brand Kit | Cor, tom de voz e logo aplicados nas gerações | ✅ Pronto |
| Admin | Métricas reais, usuários e ajuste de créditos, chaves de IA/pagamento/Meta (criptografadas), custos, modelos, pacotes | ✅ Pronto |
| LGPD | Exportar dados, excluir conta, Termos e Privacidade, callbacks de exclusão de dados da Meta | ✅ Pronto (revisão jurídica pendente) |
| Interface | Tema claro/escuro, mobile, mascote "Vy" em pixel art (pode ser ocultado), PT/EN na landing | ✅ Pronto |

## Stack

- **Next.js 16** (App Router, `proxy.ts`) + React 19 + Tailwind CSS 4
- **PostgreSQL** (Supabase) com **Prisma 5** e migrations versionadas
- **NextAuth** (e-mail + senha com bcrypt, Google opcional, 2FA TOTP)
- **IA:** Google Gemini (estratégia, texto e imagem), fal.ai/Wan (vídeo), ElevenLabs ou OpenAI (locução)
- **Pagamentos:** Mercado Pago (Pix, cartão, boleto) e Stripe, em pacotes de créditos avulsos
- **Publicação:** Meta Graph API (Instagram + Facebook)
- **E-mail:** Resend · **Arquivos:** S3 compatível (Supabase Storage, R2, AWS)

## Como funciona a geração

1. `POST /api/campaigns` valida o pedido, gera a estratégia com o Gemini (**antes** de cobrar) e debita os créditos de forma atômica.
2. Cada variação vira um `GenerationJob`, executado em segundo plano (`waitUntil`), com retentativa automática.
3. **Imagens** ficam prontas em segundos. **Vídeos** vão para a fila da fal.ai e são acompanhados pelo polling da tela de progresso e pelo cron `/api/cron/jobs`.
4. Se uma variação falhar, os créditos dela são **estornados automaticamente** e o cliente vê o aviso.

## Como funciona a publicação (Meta)

1. Em **Integrações**, o cliente conecta a conta via OAuth (state assinado e amarrado à sessão). O token fica criptografado.
2. Na galeria, **Publicar** só oferece destinos compatíveis com o criativo (ex.: imagem 9:16 não vai para o Feed).
3. Imagens são convertidas para JPEG (exigência do Instagram). Vídeos passam pelo processamento assíncrono do Instagram, acompanhado pela tela e pelo cron.
4. Cliques repetidos não geram posts duplicados (lock no Postgres). Token expirado marca a conexão para "Reconectar".

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
4. Opcional: **Admin › Integrações** (Meta) e **Admin › Teste grátis**.

Para testar sem gastar com provedores, `GEMINI_BASE_URL`, `FAL_QUEUE_URL`, `META_GRAPH_BASE_URL` e `META_DIALOG_BASE_URL` podem apontar para um servidor simulado.

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

- Senhas com bcrypt, bloqueio de 15 min após 5 tentativas erradas, rate limit (armazenado no Postgres) em login, cadastro, upload, geração e publicação.
- Sessão invalidada no servidor ao trocar a senha (`sessionVersion`).
- Todas as rotas verificam o dono do recurso (workspace). Não há acesso entre contas.
- Upload valida o tipo real do arquivo (magic bytes) e o tamanho; imagens de produto só podem vir do nosso armazenamento.
- Chaves de API, de pagamento e tokens da Meta ficam criptografados (AES-256-GCM) e nunca voltam para o navegador.
- Webhooks: assinatura verificada (Stripe, Mercado Pago e `signed_request` da Meta) e crédito idempotente (constraint única por pagamento).
- Headers de segurança (HSTS, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy).

## Documentação

- [docs/GO_LIVE.md](docs/GO_LIVE.md): checklist de deploy, variáveis de ambiente e pendências
- [docs/META_SETUP.md](docs/META_SETUP.md): app da Meta, verificação da empresa e App Review
- [docs/AI_PROVIDERS.md](docs/AI_PROVIDERS.md): provedores de IA e modelos
- [docs/COSTS.md](docs/COSTS.md): créditos, custos e ofertas grátis
