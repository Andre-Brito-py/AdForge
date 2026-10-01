# Provedores de IA

As chaves podem ser cadastradas no painel **Admin › IA e custos** (ficam criptografadas no banco) ou por variáveis de ambiente (`GEMINI_API_KEY`, `FAL_KEY`, `ELEVENLABS_API_KEY`, `OPENAI_API_KEY`). O painel tem prioridade.

## 1. Estratégia e textos: Gemini (`services/ai/text.ts`)

- Recebe a foto do produto e os dados da campanha e devolve análise, ganchos e N variações (headline, copy, CTA e conceito visual em inglês).
- Também modera: pedidos fora da política retornam `422` **antes** de qualquer cobrança.
- Os dados digitados pelo usuário vão num bloco isolado e marcados como dados, o que reduz o risco de prompt injection.
- A OpenAI (`gpt-4o-mini`) é usada como reserva real se o Gemini falhar.

## 2. Imagens: Gemini Image (`services/ai/image.ts`)

- Usa a foto do produto como referência e o conceito visual da estratégia.
- Modelo padrão: `gemini-2.5-flash-image`. No Premium usa `gemini-3-pro-image-preview` em 2K, com queda automática para o modelo padrão se o premium não estiver disponível na conta.

## 3. Vídeos: fal.ai / Wan (`services/ai/video.ts`)

- Image-to-video assíncrono: o pedido entra na fila da fal.ai e o `GenerationJob` guarda `request_id`, `status_url` e `response_url`.
- `advanceCampaign()` (chamado pelo polling da tela e pelo cron) consulta o status, baixa o MP4 e salva no S3.
- Resolução: 480p no padrão e 720p no Premium.

## 4. Locução: ElevenLabs ou OpenAI TTS (`services/ai/audio.ts`)

- Gera o MP3 do texto da variação e entrega junto com o vídeo.
- Se nenhuma chave estiver configurada, o vídeo é entregue sem locução (não há falha).

## Testes sem custo

`GEMINI_BASE_URL` e `FAL_QUEUE_URL` permitem apontar para um gateway ou para um servidor simulado. Foi assim que o pipeline completo (estratégia → imagens/vídeo → falha → estorno) foi validado localmente.
