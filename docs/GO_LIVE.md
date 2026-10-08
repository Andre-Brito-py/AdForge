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
| Google Gemini ou OpenAI | Estratégia, textos e imagens (escolha no painel; o outro vira reserva) | Pelo menos um |
| fal.ai | Vídeo Wan 2.6 e lip-sync final | Para vídeos com Wan e para o lip-sync |
| Google Gemini (faturamento ativo) | Vídeo Veo 3.1 | Se escolher o Veo |
| ElevenLabs (plano Creator ou superior, uso comercial) | Locução dos vídeos | Opcional |

Detalhes em [docs/AI_PROVIDERS.md](AI_PROVIDERS.md). Antes de abrir para clientes:

1. **Deixe saldo em todos os provedores usados.** Quando um deles fica sem saldo, o painel mostra um alerta, os super admins recebem e-mail e as gerações que dependem dele ficam pausadas (o cliente não é cobrado).
2. **Revise os créditos em Admin › IA e custos › Custo real e margem.** Com os valores padrão o vídeo dá prejuízo; use "Sugerir créditos para essa margem", salve e atualize os textos dos pacotes ("~X vídeos"). Ver [docs/COSTS.md](COSTS.md).
3. Gere algumas campanhas reais (imagem e vídeo) e confira o custo nas faturas dos provedores.

## 5. Pagamentos

- **Mercado Pago:** Access Token e assinatura secreta do webhook. URL: `https://SEU_DOMINIO/api/webhooks/mercadopago` (evento: Pagamentos).
- **Stripe:** Secret key e signing secret. URL: `https://SEU_DOMINIO/api/webhooks/stripe`. Eventos: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `charge.refunded` e `charge.dispute.created`.
- **Pacotes na Stripe:** ao salvar a chave (e sempre que salvar **Admin › Pacotes**), cada pacote vira um produto na Stripe com um preço por moeda. Editar o preço cria um preço novo e arquiva o antigo; ocultar ou remover um pacote arquiva o produto. Ao trocar a chave de teste pela de produção, tudo é recriado na conta de produção (ou use **Sincronizar agora**).
- **Cupons:** em **Admin › Cupons** (veja [docs/COSTS.md](COSTS.md)). Com a Stripe configurada, cada cupom também é criado lá. Cupons criados com a chave de teste precisam ser recriados depois de trocar para a de produção.
- **Estornos:** feitos no painel do gateway. O webhook retira os créditos correspondentes automaticamente (proporcional em estorno parcial). Se o cliente já gastou os créditos, você recebe um e-mail.
- Faça uma compra de teste em cada gateway (modo sandbox), com e sem cupom, e um estorno de teste. Confirme que os créditos entram e saem uma única vez.

## 6. Cron e execução das gerações

Configure uma chamada a cada 1–5 minutos para:

```
GET https://SEU_DOMINIO/api/cron/jobs
Authorization: Bearer <CRON_SECRET>
```

Ela conclui vídeos de quem fechou a aba e limpa tokens e rate limits antigos. Na Vercel, o plano Hobby só permite cron diário; use o plano Pro, o GitHub Actions ou o cron-job.org.

O `CRON_SECRET` também protege `POST /api/jobs/run`: cada variação de uma campanha é disparada numa execução separada, com o próprio limite de 300 s. Se a Vercel tiver **Deployment Protection** ligada no domínio de produção, essa chamada interna é bloqueada; nesse caso as gerações rodam na mesma execução (funciona, mas com menos folga de tempo).

## 7. Armazenamento (Supabase Storage)

- Bucket **público para leitura**, com escrita apenas pelas chaves S3.
- Libere CORS para o seu domínio (GET), para o botão "Baixar" funcionar direto no navegador.

## 8. Monitoramento

- Uptime: aponte o UptimeRobot ou o Better Stack para `/api/health`.
- Provedores de IA sem saldo: alerta no topo do painel admin e e-mail para os super admins (exige o Resend configurado).
- Erros: recomendo adicionar o Sentry (`npx @sentry/wizard@latest -i nextjs`), que precisa da sua conta.

## 9. Jurídico

Os textos de Termos e Privacidade foram reescritos para refletir o produto real (pacotes avulsos, estorno automático, LGPD, operadores de dados). **Peça a revisão de um advogado** antes do lançamento, principalmente das cláusulas de reembolso e de responsabilidade.

## 10. Publicação no Instagram/Facebook

O código está pronto e testado contra uma Graph API simulada. Falta o lado da Meta (app, verificação da empresa e App Review): siga o [docs/META_SETUP.md](META_SETUP.md). Enquanto as credenciais não forem cadastradas, a página Integrações mostra "Em breve" e nada quebra.

## 10.0 Vídeos longos (ffmpeg)

Vídeos acima de 5 s, o recorte para 1:1/4:5 e a locução embutida usam o ffmpeg do pacote `ffmpeg-static`, baixado no `npm install` (já liberado em `allowScripts` no `package.json`). Depois do primeiro deploy, gere um vídeo de 10 s e confira se ele sai com áudio. Se a hospedagem bloquear o binário, defina `FFMPEG_PATH` com o caminho de um ffmpeg disponível. O preço do vídeo em créditos vale **a cada 5 s**.

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
- Convites para mais de um membro por workspace.
- Monitoramento de erros (Sentry), que depende da sua conta.
