# Custos e Sistema de Créditos

O Vysify utiliza um sistema interno de moedas (Créditos) para abstrair as flutuações de preços em dólar das APIs da OVI, OpenAI e Google.

## Tabela de Conversão

| Funcionalidade | Modelo Usado | Custo em USD (Estimado) | Custo no Vysify (Créditos) |
| :--- | :--- | :--- | :--- |
| **Geração de Textos** | Gemini 2.5 Flash | `$0.001` | Gratuito na criação da Campanha |
| **Imagem (Fast)** | - | `$0.034` | 1 🪙 |
| **Imagem (Standard)** | Placeholder/Mock | `$0.067` | 3 🪙 |
| **Imagem (Premium)** | Flux / Imagen 3 | `$0.151` | 6 🪙 |
| **Vídeo (5 Segundos)** | OVI Image-to-Video | `$0.22` | 10 🪙 |

## Lógica Interna
- No cadastro (NextAuth), cada `Workspace` recém-criado recebe um `CreditBalance` de **100 Créditos** gratuitamente para testar o sistema.
- A função `consumeCredits` em `services/credits/index.ts` é a fonte da verdade para descontar saldo. Ela funciona de forma transacional usando o Prisma ORM, evitando que requisições simultâneas burlem o sistema de saldos.
- Cada operação bem-sucedida cria um `UsageRecord` e um `CreditTransaction` contendo o ID do provedor, modelo e custo para auditoria futura.
