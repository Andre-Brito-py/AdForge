# Créditos e custos

Os créditos abstraem a variação de preço (em dólar) dos provedores de IA. Os valores são editáveis em **Admin › IA e custos**.

| Operação | Créditos (padrão) | Observação |
| --- | --- | --- |
| Estratégia e textos | 0 | Inclusos em toda campanha |
| Imagem | 3 | Por variação |
| Vídeo + locução | 10 | Por variação |
| Qualidade Premium | ×2 | Multiplicador sobre imagem ou vídeo |
| Cadastro | 0 | Só dá créditos se o admin ativar **Admin › Teste grátis** (quantidade configurável) |

## Ofertas grátis (opt-in)

Ficam **desligadas por padrão**. Em **Admin › Teste grátis**:

- **Créditos grátis no cadastro:** cada conta nova recebe N créditos. Só com essa opção ligada aparecem o selo "créditos grátis", o botão "Começar grátis" e o texto de boas-vindas com créditos.
- **Plano "Grátis" na landing:** mostra um card de R$ 0 ao lado dos pacotes. Só pode ser ligado junto com a opção anterior, para nunca anunciar uma oferta que não existe.

## Regras

- O débito é **atômico** (`UPDATE ... WHERE balance >= custo`): requisições simultâneas não gastam o mesmo saldo e o saldo nunca fica negativo.
- Quantidades negativas ou fracionadas são rejeitadas na validação e no serviço de créditos.
- A estratégia é gerada **antes** da cobrança: se a IA falhar ou o pedido violar a política, nada é cobrado.
- Cada variação que falha é **estornada automaticamente** (transação `REFUND`, idempotente).
- Compras são registradas na tabela `Payment` com chave única por gateway e pagamento: reenvios de webhook não creditam duas vezes.
- Todo movimento aparece no extrato do cliente (`/credits`) e o custo estimado em dólar fica em `UsageRecord`, visível no painel admin.
