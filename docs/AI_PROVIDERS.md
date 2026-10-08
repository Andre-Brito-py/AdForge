# Provedores de IA

As chaves podem ser cadastradas no painel **Admin › IA e custos** (ficam criptografadas no banco) ou por variáveis de ambiente (`GEMINI_API_KEY`, `OPENAI_API_KEY`, `FAL_KEY`, `ELEVENLABS_API_KEY`). O painel tem prioridade. Os modelos também são trocados no painel, sem deploy.

| Tarefa | Provedor (escolhido no Admin) | Reserva automática |
| --- | --- | --- |
| Estratégia, textos, moderação, revisões e direção de cena | Gemini ou OpenAI | O outro, se tiver chave |
| Imagens e quadro de abertura dos vídeos | Gemini ou OpenAI | Com OpenAI escolhida, o Gemini |
| Vídeo | Wan 2.6 (fal.ai) ou Google Veo 3.1 (chave do Gemini) | Não há |
| Lip-sync final (vídeos com apresentador) | fal.ai (`fal-ai/sync-lipsync/v2`) | Sem ele, o vídeo sai sem a passada final |
| Locução | ElevenLabs (OpenAI TTS como reserva) | Sem chave, o vídeo sai sem locução |

## 1. Estratégia e textos (`services/ai/llm.ts`, `services/ai/text.ts`)

- Recebe a foto do produto e os dados da campanha e devolve análise, ganchos e N variações (headline, copy, CTA e conceito visual).
- Também modera: pedidos fora da política ou do escopo retornam `422` **antes** de qualquer cobrança.
- Os dados digitados pelo usuário vão num bloco isolado e marcados como dados, o que reduz o risco de prompt injection.

## 2. Imagens (`services/ai/image.ts`)

- Usam a foto do produto (e até 3 referências do cliente) e o conceito visual da estratégia.
- Gemini: `gemini-3.1-flash-image` (padrão) e `gemini-3-pro-image` (premium e quadro de abertura). OpenAI: `gpt-image-2.5-flare` e `gpt-image-2.5-sunburst`.

## 3. Vídeos (`services/ai/video.ts`, `services/ai/veo.ts`, `lib/generation.ts`)

- Antes de animar, é gerado e revisado por IA um **quadro de abertura** realista; ele é guardado e reaproveitado se a geração precisar ser retomada.
- Wan 2.6: pedidos de 5/10/15 s com lip-sync nativo. Veo 3.1: 8 s + extensões de 7 s (o produto não muda na emenda); só gera 9:16/16:9, então 1:1 e 4:5 são recortados na montagem.
- Cada geração roda na própria execução (`POST /api/jobs/run`, protegida pelo `CRON_SECRET`); o cron e a tela de progresso acompanham a fila do provedor até o fim.

## 4. Falhas e falta de saldo

- Erros passageiros (sobrecarga, limite por minuto) são tentados de novo dentro do prazo.
- Recusa definitiva (sem créditos, chave inválida, pedido rejeitado): o criativo falha na hora e os créditos do cliente são devolvidos.
- Falta de saldo ou chave recusada gera um **alerta no painel admin** (e e-mail aos super admins, no máximo 1 por hora por provedor) e **pausa por 15 minutos** as gerações que dependem dele: o cliente vê "temporariamente indisponível" e não é cobrado. O botão **Já recarreguei** libera na hora; uma geração bem-sucedida também encerra o alerta.

## Testes sem custo

`GEMINI_BASE_URL`, `FAL_QUEUE_URL`, `FAL_REST_URL`, `OPENAI_BASE_URL` e `ELEVENLABS_BASE_URL` permitem apontar para um gateway ou para um servidor simulado.
