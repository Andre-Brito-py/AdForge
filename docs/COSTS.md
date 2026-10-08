# Créditos e custos

Os créditos abstraem a variação de preço (em dólar) dos provedores de IA. Os valores são editáveis em **Admin › IA e custos**.

| Operação | Créditos (padrão) | Observação |
| --- | --- | --- |
| Estratégia e textos | 0 | Inclusos em toda campanha |
| Imagem | 3 | Por variação |
| Vídeo | 10 | **A cada 5 s** de vídeo, por variação (um vídeo de 20 s = 40) |
| Qualidade Premium | ×2 | Multiplicador sobre imagem ou vídeo |
| Cadastro | 0 | Só dá créditos se o admin ativar **Admin › Teste grátis** (quantidade configurável) |

## Custo real e margem (revise antes de lançar)

Os padrões acima foram definidos antes do vídeo com quadro de abertura, lip-sync e Veo. Com eles, **o vídeo dá prejuízo**: um vídeo de 20 s custa cerca de US$ 3–4 nos provedores, e 40 créditos valem cerca de US$ 1,20–2,00 conforme o pacote.

Em **Admin › IA e custos › Custo real e margem**:

- A tabela mostra, para imagem e vídeo, os créditos cobrados, a receita no pacote de crédito mais barato (o pior caso), o custo estimado e a margem.
- **Sugerir créditos para essa margem** calcula créditos de imagem, vídeo e o multiplicador premium para a margem alvo (60% por padrão). Depois de salvar, ajuste os textos dos pacotes ("~X vídeos").
- **Corrigir o custo dos provedores**: os custos vêm de uma tabela padrão por modelo (`lib/provider-pricing.ts`). Confira nas faturas e corrija quando o provedor mudar o preço. A cotação do real e do euro também fica ali.

O custo estimado de cada cobrança é gravado em `UsageRecord` e somado em **Admin › Visão geral**.

## Ofertas grátis (opt-in)

Ficam **desligadas por padrão**. Em **Admin › Teste grátis**:

- **Créditos grátis no cadastro:** cada conta nova recebe N créditos. Só com essa opção ligada aparecem o selo "créditos grátis", o botão "Começar grátis" e o texto de boas-vindas com créditos.
- **Plano "Grátis" na landing:** mostra um card de R$ 0 ao lado dos pacotes. Só pode ser ligado junto com a opção anterior, para nunca anunciar uma oferta que não existe.

## Cupons de desconto

Em **Admin › Cupons**: porcentagem (até 95%) ou valor fixo numa moeda, limite de usos, validade e pacotes em que vale. O cliente digita o código em **Comprar créditos** e vê o preço com desconto antes de pagar.

- Vale no Mercado Pago (o desconto vai no preço) e na Stripe (criado também como cupom + código promocional, e o desconto aparece na fatura dela).
- O checkout valida de novo o cupom antes de cobrar. Cada uso fica no pagamento (`Payment.couponCode` e `discount`).
- Desconto, validade e limite não mudam depois de criado: desative e crie outro código. Cupom já usado não é apagado, só desativado.

## Regras

- O débito é **atômico** (`UPDATE ... WHERE balance >= custo`): requisições simultâneas não gastam o mesmo saldo e o saldo nunca fica negativo.
- Quantidades negativas ou fracionadas são rejeitadas na validação e no serviço de créditos.
- A estratégia é gerada **antes** da cobrança: se a IA falhar ou o pedido violar a política, nada é cobrado.
- Provedor sem saldo: as gerações que dependem dele ficam pausadas e o cliente não é cobrado (ver `docs/AI_PROVIDERS.md`).
- Cada variação que falha é **estornada automaticamente** (transação `REFUND`, idempotente).
- Compras são registradas na tabela `Payment` com chave única por gateway e pagamento: reenvios de webhook não creditam duas vezes.
- **Estorno ou chargeback no gateway** (Stripe ou Mercado Pago) retira os créditos proporcionais ao valor devolvido, uma única vez. Créditos que o cliente já gastou não deixam o saldo negativo: os super admins recebem um e-mail para decidir o que fazer.
- Todo movimento aparece no extrato do cliente (`/credits`).
