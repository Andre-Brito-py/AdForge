# 🚀 Vysify (AdForge AI)

Vysify é um estúdio criativo B2B alimentado por Inteligência Artificial (God Mode), focado na criação de anúncios em escala para e-commerces, dropshippers e agências. Ele automatiza desde a estratégia da copy até a geração final do vídeo usando os modelos mais modernos de IA (Gemini, ElevenLabs e Wan 2.1).

## 🌟 Principais Funcionalidades

- **Omnichannel Distribution**: Geração nativa para WhatsApp, Instagram, Facebook Ads, TikTok Ads e Shopify.
- **Workflow em Cascata (Pipeline IA)**: 
  1. Criação de Estratégia e Copy (Gemini 2.5 Flash).
  2. Text-to-Speech ultra-realista em Português (ElevenLabs/OpenAI TTS).
  3. Video Generation / S2V (Wan 2.1).
- **Billing e Monetização**: Paywall integrado com Stripe e MercadoPago. Assinaturas e venda de Créditos avulsos.
- **Catálogo de Produtos**: Importação de imagens, detecção de paleta de cores e informações base da marca.
- **Autenticação Segura**: Suporte a Google OAuth, Login com Magic/Credenciais (com validação segura de SuperAdmin) e MFA (2FA via Authenticator).
- **Painel de Super Admin**: Controle global do sistema, alteração de APIs em runtime (sem precisar fazer novo deploy) e monitoramento de saldo/usuários.

## 🛠️ Arquitetura e Tecnologias

- **Framework**: Next.js 14+ (App Router)
- **Estilização**: Tailwind CSS + Shadcn UI
- **Banco de Dados**: PostgreSQL hospedado na Supabase.
- **ORM**: Prisma
- **Armazenamento (Cloud Storage)**: Supabase Storage / Cloudflare R2 / AWS S3
- **Execução Serverless**: Vercel Functions (usando `waitUntil` para vídeos pesados e longos).

## ⚙️ Como Executar o Projeto (Localmente)

### 1. Requisitos Prévios
- Node.js versão LTS (20.x ou superior)
- Conta na Supabase (para Banco de Dados e Storage S3)

### 2. Variáveis de Ambiente
Renomeie o arquivo `.env.example` para `.env` e preencha com as suas chaves:
```bash
# Banco de Dados
DATABASE_URL="postgres://user:pass@host:6543/postgres?pgbouncer=true"
DIRECT_URL="postgres://user:pass@host:5432/postgres"

# S3 Storage (Para imagens e áudios gerados)
S3_BUCKET="vysify-uploads"
S3_REGION="us-east-1"
S3_ENDPOINT="https://[PROJECT-ID].supabase.co/storage/v1/s3"
S3_PUBLIC_URL="https://[PROJECT-ID].supabase.co/storage/v1/object/public/vysify-uploads"
S3_ACCESS_KEY_ID="sua-chave"
S3_SECRET_ACCESS_KEY="sua-secret"

# Credenciais Hardcoded do Super Admin
ADMIN_EMAIL="andre@vysify.com"
ADMIN_PASSWORD="AdminSeguro123!"
```

### 3. Instalação e Banco de Dados

Instale as dependências:
```bash
npm install
```

Sincronize as tabelas do Prisma com a nuvem (Supabase):
```bash
npm run db:push
npm run db:generate
```

### 4. Rodando o App
Inicie o servidor de desenvolvimento:
```bash
npm run dev
```
Acesse [http://localhost:3000](http://localhost:3000) e faça o login com as credenciais do Admin que você configurou no `.env` para acessar o painel completo.

## 📝 Licença
Desenvolvido com exclusividade. Todos os direitos reservados.
