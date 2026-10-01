# 🚀 Vysify (AdForge AI)

Vysify é um estúdio criativo B2B alimentado por Inteligência Artificial (God Mode), focado na criação de anúncios em escala para e-commerces, dropshippers e agências. Ele automatiza desde a estratégia da copy até a geração final do vídeo usando os modelos mais modernos de IA (Gemini, ElevenLabs e Wan 2.1).

## 🌟 Principais Funcionalidades

- **Workflow em Cascata (Pipeline IA)**: 
  1. Criação de Estratégia e Copy baseada em Gatilhos Mentais (Gemini 2.5 Flash).
  2. Text-to-Speech ultra-realista em Português (ElevenLabs/OpenAI TTS).
  3. Video Generation / S2V (Wan 2.1).
- **Billing e Monetização (Stripe & Mercado Pago)**: Paywall integrado. Planos dinâmicos gerenciados via Painel Admin (Ocultar planos, destacar planos, ativar versão Grátis/Trial). 
- **Landing Page Dinâmica**: Layout Premium em Bento-Grid, que altera os call-to-actions automaticamente ("Começar Grátis" vs "Assinar Agora") se existir algum plano configurado como gratuito.
- **Segurança Legal e Compliance (LGPD e CDC)**:
  - IA com Guardrails (Filtro Anti-NSFW e Moderação) que bloqueia gerações fora do escopo de vendas/anúncios comerciais.
  - Termos de Uso (Direito de Arrependimento de 7 Dias).
  - Política de Privacidade e Banner interativo de Consentimento de Cookies.
- **Comunicação Automatizada**: E-mails transacionais via **Resend** (E-mail de Boas-vindas para novos usuários e Recibo Automático de Pagamento).
- **Painel de Super Admin**: Controle global do sistema, alteração de chaves de APIs em runtime (sem precisar fazer novo deploy).

## 🛠️ Arquitetura e Tecnologias

- **Framework**: Next.js 14+ (App Router)
- **Estilização**: Tailwind CSS + Shadcn UI + Framer Motion (Animações Premium)
- **Banco de Dados**: PostgreSQL hospedado na Supabase.
- **ORM**: Prisma
- **Armazenamento (Cloud Storage)**: Supabase Storage / AWS S3
- **Execução Serverless**: Vercel Functions (usando `waitUntil` para garantir execução de long-running jobs como vídeos da Wan 2.1 sem timeout).

## ⚙️ Como Executar o Projeto (Localmente)

### 1. Requisitos Prévios
- Node.js versão LTS (20.x ou superior)
- Conta na Supabase (para Banco de Dados e Storage S3)
- Conta na Resend (Opcional: para disparo de e-mails reais)

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

# E-mails (Resend)
RESEND_API_KEY="re_sua-chave-aqui"
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
