# Checklist de Go Live

O que já está pronto no código e o que depende de você (contas, chaves e decisões de negócio).

## 1. Banco de dados (Supabase)

O projeto agora usa **migrations** (`prisma/migrations`) em vez de `db push --accept-data-loss`.

- `0_init` corresponde ao schema que já estava no Supabase.
- `20261001000000_go_live_hardening` adiciona as novas tabelas e colunas.

Como o app ainda não está no ar, há dois caminhos:

**A) Banco limpo (recomendado, já que não há clientes):** apague as tabelas no Supabase (ou crie um projeto novo) e rode:

```bash
npm run db:deploy
```

**B) Manter os dados atuais:** marque a migration inicial como já aplicada e rode o restante:

```bash
npx prisma migrate resolve --applied 0_init
npm run db:deploy
```

Contas antigas não têm senha cadastrada (o login antigo aceitava qualquer senha). Esses usuários devem usar **"Esqueci a senha"**.

## 2. Variáveis de ambiente na Vercel

Veja `.env.example`. Só estas precisam ficar na Vercel (mudá-las exige redeploy):

- `DATABASE_URL`, `DIRECT_URL`
- `NEXT_PUBLIC_APP_URL` e `NEXTAUTH_URL` (domínio final, com https)
- `NEXTAUTH_SECRET`, `ENCRYPTION_KEY` e `CRON_SECRET` (gere com `openssl rand -base64 32`)
- `S3_*` (em produção não existe gravação em disco)

Todo o resto é configurado no painel Admin e vale em até 15 segundos, sem redeploy. Logo após o primeiro acesso de admin (seção 3), abra **Admin › Configurações gerais** e preencha:

- **Dados da empresa** (razão social, CNPJ, endereço e e-mails de suporte/privacidade), exigidos pelo Decreto 7.962/2013. Enquanto faltarem, os documentos legais mostram "[CNPJ]" etc.
- **E-mails:** API key do Resend e remetente (domínio verificado no Resend), sem os quais ninguém confirma o e-mail.
- Opcionais: Google Analytics, Pixel da Meta, Stripe Tax, representantes UE/Reino Unido e o switch **Aceitar novas contas** (útil para um lançamento fechado).

As variáveis antigas (`RESEND_API_KEY`, `NEXT_PUBLIC_COMPANY_*` etc.) continuam funcionando como reserva.

Remova `ADMIN_EMAIL` e `ADMIN_PASSWORD`: o login de admin fixo no código foi eliminado.

## 3. Primeiro acesso de admin

1. Crie sua conta pelo site.
2. Rode localmente, apontando para o banco de produção: `npm run admin:promote -- seu@email.com`.
3. Ative o 2FA em Configurações (fortemente recomendado para a conta admin).

## 4. Provedores de IA (Admin › IA e custos)

| Provedor | Uso | Obrigatório? |
| --- | --- | --- |
| Google Gemini | Estratégia, textos e imagens | Sim |
| fal.ai | Vídeos (Wan image-to-video) | Para vídeos |
| ElevenLabs | Locução dos vídeos | Opcional |
| OpenAI | Reserva de texto e locução | Opcional |

Os nomes dos modelos podem ser trocados no painel sem deploy. Antes de abrir para clientes, gere algumas campanhas reais e ajuste os prompts e os custos em créditos conforme a sua margem.

## 5. Pagamentos

- **Mercado Pago:** Access Token e assinatura secreta do webhook. URL: `https://SEU_DOMINIO/api/webhooks/mercadopago` (evento: Pagamentos).
- **Stripe:** Secret key e signing secret. URL: `https://SEU_DOMINIO/api/webhooks/stripe` (eventos `checkout.session.completed` e `checkout.session.async_payment_succeeded`).
- Faça uma compra de teste em cada gateway (modo sandbox) e confirme que os créditos entram uma única vez.
- Reembolsos são feitos pelo painel do gateway. Depois, ajuste o saldo do cliente em **Admin › Usuários › Ajustar créditos**.

## 6. Cron

Configure uma chamada a cada 1–5 minutos para:

```
GET https://SEU_DOMINIO/api/cron/jobs
Authorization: Bearer <CRON_SECRET>
```

Ela conclui vídeos de quem fechou a aba e limpa tokens e rate limits antigos. Na Vercel, o plano Hobby só permite cron diário; use o plano Pro, o GitHub Actions ou o cron-job.org.

## 7. Armazenamento (Supabase Storage)

- Bucket **público para leitura**, com escrita apenas pelas chaves S3.
- Libere CORS para o seu domínio (GET), para o botão "Baixar" funcionar direto no navegador.

## 8. Monitoramento

- Uptime: aponte o UptimeRobot ou o Better Stack para `/api/health`.
- Erros: recomendo adicionar o Sentry (`npx @sentry/wizard@latest -i nextjs`), que precisa da sua conta.

## 9. Jurídico

Os textos de Termos e Privacidade foram reescritos para refletir o produto real (pacotes avulsos, estorno automático, LGPD, operadores de dados). **Peça a revisão de um advogado** antes do lançamento, principalmente das cláusulas de reembolso e de responsabilidade.

## 10. Publicação no Instagram/Facebook

O código está pronto e testado contra uma Graph API simulada. Falta o lado da Meta (app, verificação da empresa e App Review): siga o [docs/META_SETUP.md](META_SETUP.md). Enquanto as credenciais não forem cadastradas, a página Integrações mostra "Em breve" e nada quebra.

## 10.1 Login com Google (opcional)

Em **Admin › Integrações › Login com Google**: cole o Client ID e o Client Secret (Google Cloud Console › APIs e serviços › Credenciais › ID do cliente OAuth, tipo "Aplicativo da Web") e cadastre lá a URI de redirecionamento mostrada no painel. O botão "Continuar com Google" pode ser ligado e desligado a qualquer momento, sem redeploy. Antes de abrir ao público, publique a tela de consentimento OAuth no Google (fora do modo "Teste").

## 11. Clientes internacionais

A interface, os e-mails, os erros da API, os Termos, a Privacy Policy e a Cookie Policy existem em português e inglês. O idioma e a moeda são escolhidos pelo país do visitante (cabeçalho `x-vercel-ip-country`) e pelo navegador, e o cliente pode trocar em Configurações (idioma) e no Billing (moeda). O painel Admin continua em português.

- **Preços:** cadastre o preço em USD (e, se quiser, em EUR) de cada pacote em **Admin › Pacotes**, junto com a descrição em inglês. Sem preço em EUR, o visitante europeu vê o valor em USD.
- **Impostos (Stripe Tax):** ative o Stripe Tax, registre-se onde for obrigado (ex.: IVA da UE via OSS, VAT do Reino Unido, estados dos EUA ao atingir o limite) e ligue **Admin › Configurações gerais › Impostos (Stripe)**. O checkout já coleta endereço de cobrança e VAT ID e gera fatura.
- **Reembolso:** o texto do checkout e dos Termos informa 7 dias para compras em BRL (CDC) e 14 dias para as internacionais (UE/Reino Unido).
- **Representantes UE/Reino Unido:** se você atende clientes desses mercados sem estabelecimento lá, contrate um representante (art. 27 do GDPR) e preencha os representantes em **Admin › Configurações gerais › Dados da empresa**.
- **Cookies:** GA e Pixel da Meta (Admin › Configurações gerais › Análise e marketing) só carregam depois do consentimento. Sem eles, não há banner.
- **Idioma dos anúncios:** independente do idioma da interface (9 opções, como en-US, es-419, fr-FR e de-DE), escolhido no assistente de campanha.
- **Jurídico:** os textos em inglês (Terms, Privacy com GDPR/UK GDPR/CCPA e Cookie Policy) também precisam de revisão de um advogado com experiência internacional.

## Pendências conhecidas (próximos passos)

- Publicação em Mercado Livre, Nuvemshop, Shopify e TikTok (a estrutura de conexões já existe; cada uma precisa do app/credenciais da plataforma).
- Criação de anúncios pagos na Meta (Marketing API, permissão `ads_management`).
- Assinaturas recorrentes (hoje são pacotes avulsos).
- Mesclar a locução dentro do arquivo de vídeo (hoje o MP3 é entregue separado, ao lado do vídeo).
- Estorno automático de créditos quando um pagamento é reembolsado no gateway.
- Convites para mais de um membro por workspace.
