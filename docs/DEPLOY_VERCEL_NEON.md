# Deploy: Vercel + Neon + Cloudflare R2

Passo a passo para colocar o Vysify no ar. O código já está preparado:

- `vercel.json`: build próprio, região São Paulo (`gru1`) e o cron a cada 5 minutos.
- `scripts/vercel-build.mjs`: confere as variáveis essenciais, aplica as migrations no Neon (só em produção) e compila.
- `lib/db-url.ts`: completa a conexão do Neon (`pgbouncer=true`, `sslmode=require`, `connect_timeout=15`).

Ordem: Neon → R2 → Vercel → domínio → primeiro acesso.

## 0. Antes de começar

- **Vercel Pro (US$ 20/mês):** o plano Hobby é só para uso pessoal, não comercial, e não aceita cron a cada 5 minutos (o deploy falha com o `vercel.json` atual).
- **Branch:** junte a `feat/go-live-hardening` na `main` (de preferência com "Squash and merge") e faça o deploy a partir da `main`.
- **Gerar segredos:** cada segredo abaixo é um valor aleatório. Gere um por vez com:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## 1. Neon (banco de dados)

1. Em [console.neon.tech](https://console.neon.tech), crie um projeto:
   - **Região:** AWS São Paulo (`sa-east-1`), a mesma da Vercel (`gru1`);
   - **Postgres:** versão 16 ou mais nova.
2. Em **Connect**, copie as duas strings de conexão:
   - **com pooler** (o host tem `-pooler`): vai em `DATABASE_URL`;
   - **sem pooler** (desligue "Connection pooling"): vai em `DIRECT_URL`, usada só pelas migrations.
3. **Plano:** o gratuito "dorme" depois de 5 minutos sem uso, e o primeiro acesso leva ~1 s para acordar. O app já espera por isso. Para o lançamento, o plano **Launch** dá mais folga de memória e de armazenamento.

**Alternativa:** a integração oficial (Vercel › Storage › Neon) cria `DATABASE_URL` e `DATABASE_URL_UNPOOLED` sozinha; o app usa a segunda como `DIRECT_URL`.
- Se ligar a opção de criar um banco por preview, defina `MIGRATE_ON_BUILD=always` para os previews também receberem as migrations.
- Sem essa opção, os previews usam o banco de produção e só a produção aplica migrations (padrão: `MIGRATE_ON_BUILD=production`).

## 2. Cloudflare R2 (fotos e vídeos)

1. No painel da Cloudflare, abra **R2 › Create bucket** e crie o bucket `vysify-uploads`.
2. **Acesso público para leitura:** em **Settings › Custom Domains**, conecte um subdomínio, por exemplo `arquivos.seudominio.com.br`. Esse endereço vira o `S3_PUBLIC_URL`.
   - O domínio `r2.dev` serve para testes, mas tem limite de requisições e não é recomendado em produção.
3. **Chaves de acesso:** em **R2 › Manage API tokens › Create API token**, escolha a permissão **Object Read & Write**, restrita a esse bucket.
   - Anote o **Access Key ID**, a **Secret Access Key** e o endpoint `https://ID_DA_CONTA.r2.cloudflarestorage.com`.
4. **CORS:** em **Settings › CORS policy**, cole a regra abaixo. Ela é necessária para o botão "Baixar" funcionar direto no navegador.

```json
[
  {
    "AllowedOrigins": ["https://SEU_DOMINIO"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 86400
  }
]
```

O R2 não cobra tráfego de saída: vídeos assistidos e baixados não aumentam a conta.

## 3. Vercel

1. **Add New › Project**, importe o repositório do GitHub. O framework (Next.js), o comando de build e a região vêm do `vercel.json`.
2. Em **Settings › Environment Variables**, cadastre para **Production** (e para Preview, se for usar):

| Variável | Valor |
| --- | --- |
| `DATABASE_URL` | String do Neon **com** pooler |
| `DIRECT_URL` | String do Neon **sem** pooler (dispensável com a integração Neon) |
| `NEXT_PUBLIC_APP_URL` | `https://seudominio.com.br` (por enquanto, o endereço `*.vercel.app` do projeto) |
| `NEXTAUTH_URL` | O mesmo endereço |
| `NEXTAUTH_SECRET` | Segredo novo (seção 0) |
| `ENCRYPTION_KEY` | Segredo novo. **Guarde uma cópia:** se ele mudar, as chaves salvas no Admin precisam ser recadastradas. |
| `CRON_SECRET` | Segredo novo. A Vercel o envia sozinha nas chamadas do cron. |
| `S3_BUCKET` | `vysify-uploads` |
| `S3_REGION` | `auto` |
| `S3_ENDPOINT` | `https://ID_DA_CONTA.r2.cloudflarestorage.com` |
| `S3_PUBLIC_URL` | `https://arquivos.seudominio.com.br` |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | As chaves do token do R2 |

Opcionais: `SENTRY_DSN` e `NEXT_PUBLIC_SENTRY_DSN` (erros). Todo o resto (IA, Stripe, Meta, Resend, dados da empresa) se configura no **Admin**, sem redeploy.

3. **Deploy.** O build:
   - para com uma mensagem clara se faltar alguma variável essencial;
   - aplica as migrations no Neon (no log, "Aplicando migrations no banco…");
   - compila o site.
4. **Settings › Functions:** confira que o **Fluid Compute** está ligado (padrão em projetos novos). As rotas de vídeo usam até 300 s.
5. **Settings › Deployment Protection:** deixe desligada no domínio de produção. As gerações chamam `/api/jobs/run` no próprio site, e a proteção bloquearia essa chamada.

## 4. Domínio

1. **Settings › Domains**, adicione `seudominio.com.br` e siga as instruções de DNS.
2. Troque `NEXT_PUBLIC_APP_URL` e `NEXTAUTH_URL` para o domínio final e faça **Redeploy**.
3. Atualize o domínio no CORS do R2 (seção 2).

## 5. Primeiro acesso e configuração

1. Crie sua conta pelo site.
2. **Torne-se super admin.** O jeito mais simples é o **SQL Editor** do Neon:

```sql
UPDATE "User" SET role = 'SUPERADMIN', "sessionVersion" = "sessionVersion" + 1 WHERE email = 'seu@email.com';
```

   Saia e entre de novo. Alternativa: `npm run admin:promote -- seu@email.com`, com o `.env` local apontando para o Neon.
3. Ative o 2FA em **Configurações**.
4. **Admin › Configurações gerais:**
   - dados da empresa;
   - Resend (e-mails);
   - suporte no WhatsApp.
5. **Admin › IA e custos:**
   - chaves do Gemini, fal.ai e ElevenLabs;
   - modelos;
   - créditos (padrão: imagem 2, vídeo 25 por 5 s, Premium ×1,5).
6. **Admin › Pagamentos:**
   - chave da Stripe e o botão **Criar webhook automaticamente**;
   - pacotes, que são enviados sozinhos para a Stripe;
   - cupons.
7. **URLs de retorno:**
   - Google: `https://SEU_DOMINIO/api/auth/callback/google`;
   - Meta: a URL mostrada em Admin › Integrações;
   - Mercado Pago: `https://SEU_DOMINIO/api/webhooks/mercadopago`.

## 6. Conferência

- `https://SEU_DOMINIO/api/health` responde "ok".
- **Vercel › Settings › Cron Jobs:** `/api/cron/jobs` aparece rodando a cada 5 minutos.
- **Teste de ponta a ponta:**
  1. gere uma campanha de imagem e uma de vídeo;
  2. confira os arquivos no bucket do R2;
  3. baixe o vídeo em outro formato;
  4. publique um Reels de teste.
- **Vercel › Logs:** filtre por "error" na primeira hora.

## 7. Dados antigos do Supabase (opcional)

Como ainda não há clientes, o recomendado é começar com o Neon vazio (o build cria todas as tabelas). Para levar dados de teste:

```bash
pg_dump --no-owner --no-acl -Fc "URL_DIRETA_DO_SUPABASE" -f vysify.dump
```

```bash
pg_restore --no-owner --no-acl -d "URL_SEM_POOLER_DO_NEON" vysify.dump
```

Os arquivos que estavam no Supabase Storage não vão junto, e as URLs gravadas no banco continuariam apontando para lá. Por isso, comece limpo.
