# Créditos e custos

Os créditos abstraem a variação de preço (em dólar) dos provedores de IA. Os valores são editáveis em **Admin › IA e custos**.

| Operação | Créditos (padrão) | Observação |
| --- | --- | --- |
| Estratégia e textos | 0 | Inclusos em toda campanha |
| Imagem | 2 | Por variação |
| Vídeo | 25 | **A cada 5 s** (arredondado para cima), por variação: 15 s = 75; 8 s = 50; 22 s = 125 |
| Qualidade Premium | ×1,5 | Multiplicador sobre imagem ou vídeo (use ×2,5 se o Premium for o Veo 3.1 normal) |
| Cadastro | 0 | Só dá créditos se o admin ativar **Admin › Teste grátis** (quantidade configurável) |

## Custo real e margem (revise antes de lançar)

Os padrões acima e os planos padrão (`DEFAULT_PLANS` em `lib/config.ts`: Teste R$ 45, Avulso R$ 119, Starter R$ 79/mês, Pro R$ 179/mês, Agência R$ 399/mês) foram calculados para o Veo 3.1 Fast com lip-sync: ~R$ 17,80 por vídeo de 15 s. No plano mais barato por crédito, a margem fica em ~30% mesmo se o cliente gastar tudo em vídeo, já descontando taxa da Stripe, imposto do Simples e 10% de falhas. Eles só valem numa instalação nova: o que estiver salvo no Admin tem prioridade.

**Durações do vídeo:** com o Veo 3.1 / Fast (que estende o próprio vídeo: 8 s + blocos de 7 s), o assistente oferece 8, 15, 22 e 29 s, exatamente o que o Veo gera; com os outros modelos, 5, 10, 15, 20 e 30 s. Assim o cliente nunca paga por segundos que seriam descartados.

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
