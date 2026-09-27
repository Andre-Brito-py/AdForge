# Integração com Provedores de IA

O Vysify utiliza três camadas diferentes de IA para gerar campanhas publicitárias completas.

## 1. Geração de Texto & Estratégia
**Provedor Atual:** Google Gen AI (`gemini-2.5-flash`)
- **Arquivos:** `services/ai/text.ts` e `app/api/campaigns/route.ts`
- **Fluxo:** O sistema lê a imagem original (`originalImageUrl`) codificada em Base64, e envia para a API Vision do Gemini junto com as instruções (Objetivo, Tom, Público).
- O Gemini devolve um objeto JSON perfeitamente estruturado que quebramos no backend para preencher a entidade `Creative` do tipo `COPY`.

## 2. Geração de Imagens
**Provedor Atual:** Mock (Preparado para Gemini Imagen 3 / Flux)
- **Arquivos:** `services/ai/image.ts`
- **Fluxo:** Recebe o ID do Produto, as opções da campanha e o cenário ideal. Em um ambiente de produção real, usaríamos técnicas de Inpainting/Composição para manter a foto do produto inalterada e alterar apenas o fundo/estilo.

## 3. Geração de Vídeo
**Provedor Atual:** Mock OVI API
- **Arquivos:** `app/api/campaigns/[id]/generate-video/route.ts`
- **Fluxo:** Devido à latência de geração de vídeo, a requisição apenas cria o `Creative` com status `PROCESSING` e retorna para a interface imediatamente.
- O sistema simula um Webhook/Worker de background esperando 10 segundos antes de atualizar o banco de dados via `setTimeout` para `COMPLETED`, imitando o comportamento real de uma fila.
- **Expansão Futura:** Para contornar o limite de 5s da OVI, criaremos Workers em Cloud Run que extraem o último frame (via FFmpeg) e concatenam chamadas em série para gerar vídeos de 15s.
