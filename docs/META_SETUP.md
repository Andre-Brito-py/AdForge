# Configurando a integração com a Meta (Instagram + Facebook)

O código da Vysify já está pronto: login com Facebook, escolha de Páginas e contas do Instagram, publicação em Feed, Reels, Stories e Páginas, e os callbacks de desautorização e exclusão de dados. Este guia cobre o que **só você** pode fazer no lado da Meta.

> Os nomes dos menus mudam com frequência no painel da Meta. Se algo não bater exatamente, procure pelo nome equivalente.

## 0. Antes de começar

- [ ] Um **portfólio empresarial** (Meta Business Suite, em business.facebook.com) em nome da empresa (CNPJ).
- [ ] Uma **Página do Facebook** e uma conta do **Instagram profissional** (Empresa ou Criador de conteúdo) **vinculada à Página**. Você vai usar ambas para testar e para gravar o vídeo do App Review.
- [ ] A Vysify publicada em um **domínio com HTTPS** (ex.: `https://app.vysify.com.br`). A Meta não aceita `localhost` no App Review e precisa baixar as imagens por uma URL pública.
- [ ] Termos de Uso e Política de Privacidade publicados (já existem em `/legal/terms` e `/legal/privacy`).

## 1. Criar o app

1. Acesse **developers.facebook.com › Meus apps › Criar app**.
2. Tipo de app: **Empresa** (Business). Vincule ao seu portfólio empresarial.
3. Adicione os produtos/casos de uso:
   - **Login do Facebook para Empresas** (Facebook Login for Business);
   - **API do Instagram com Login do Facebook** (Instagram API with Facebook Login).
4. Em **Login do Facebook para Empresas › Configurações**, crie uma **configuração** do tipo *token de acesso do usuário* com as permissões abaixo. Copie o **ID da configuração** e coloque na variável `META_LOGIN_CONFIG_ID`. Sem ela, a Vysify pede as permissões pelo método clássico (`scope`).

Permissões usadas:

| Permissão | Para quê |
| --- | --- |
| `pages_show_list` | Listar as Páginas que o cliente administra |
| `pages_read_engagement` | Ler dados básicos da Página (nome, conta do Instagram vinculada) |
| `pages_manage_posts` | Publicar fotos e vídeos na Página |
| `instagram_basic` | Ler o @ e o ID da conta do Instagram |
| `instagram_content_publish` | Publicar no Feed, Reels e Stories |
| `instagram_manage_insights` | Ler os resultados dos posts publicados (alcance, curtidas, salvos) para apontar o criativo campeão |
| `business_management` | Acessar Páginas e contas que estão dentro de um portfólio empresarial |

## 2. Preencher as URLs

No **Admin › Integrações** da Vysify todas as URLs aparecem prontas para copiar. Cadastre:

- **Login do Facebook › Configurações › URIs de redirecionamento do OAuth válidos:** `https://SEU_DOMINIO/api/integrations/meta/callback`
- **Configurações do app › Básico:**
  - Domínios do app: `SEU_DOMINIO`
  - URL da Política de Privacidade: `https://SEU_DOMINIO/legal/privacy`
  - URL dos Termos de Serviço: `https://SEU_DOMINIO/legal/terms`
  - URL de instruções de exclusão de dados: `https://SEU_DOMINIO/api/integrations/meta/data-deletion` (opção "URL de retorno de chamada")
  - Ícone 1024×1024 e categoria (ex.: Negócios e páginas)
- **Desautorizar (cancelar autorização):** `https://SEU_DOMINIO/api/integrations/meta/deauthorize`

## 3. Colocar as credenciais na Vysify

Em **Configurações do app › Básico**, copie o **ID do app** e a **Chave secreta do app** e cole em **Admin › Integrações**. Elas ficam criptografadas no banco. Também dá para usar as variáveis `META_APP_ID` e `META_APP_SECRET`.

A partir daí, o botão "Conectar com Facebook" aparece em **Integrações** para os clientes.

## 4. Testar em modo de desenvolvimento (antes do App Review)

Com o app em **modo de desenvolvimento**, tudo já funciona para quem tem **função no app**:

1. Em **Funções do app**, adicione você (e quem for testar) como administrador ou testador.
2. Na Vysify, vá em **Integrações › Conectar com Facebook**, marque a Página e o Instagram e conclua.
3. Gere uma campanha e use **Publicar** em um criativo. Teste Feed, Stories, Reels (vídeo) e Página.

Contas sem função no app recebem erro de permissão até a aprovação. Isso é esperado.

## 5. Verificação da empresa

Em **business.facebook.com › Configurações › Central de segurança › Verificação da empresa**, envie os documentos da empresa (CNPJ, comprovante de endereço). A Meta exige a verificação para conceder **Acesso Avançado** às permissões. Leva de alguns dias a algumas semanas.

## 6. App Review (Análise do app)

Em **Análise do app › Permissões e recursos**, peça **Acesso Avançado** para cada permissão da tabela. Para cada uma, a Meta pede:

1. **Descrição de uso** (em inglês). Sugestão, ajuste se precisar:

   > Vysify is a SaaS that creates advertising creatives (images and short videos) from product photos. Business owners connect their Facebook Page and Instagram professional account so they can publish the creatives they generated directly to their own Page and Instagram (feed, Reels and Stories). We use **[PERMISSÃO]** to [listar as Páginas do usuário / publicar na Página selecionada / publicar na conta do Instagram selecionada / acessar ativos dentro do portfólio empresarial]. Content is only published when the user explicitly clicks "Publish now" and reviews the caption.

2. **Screencast** (vídeo de tela, de preferência com a interface em inglês ou com legendas), mostrando:
   1. Login na Vysify;
   2. Integrações › Conectar com Facebook → a tela de permissões da Meta → seleção da Página e do Instagram;
   3. Uma campanha pronta → **Publicar** → escolha "Instagram · Feed" → **Publicar agora**;
   4. O post aparecendo no Instagram (abra o link "ver post");
   5. O mesmo fluxo para a Página do Facebook e para um Reels;
   6. Integrações › Desconectar.

3. **Usuário de teste** para os revisores: crie uma conta na Vysify com créditos (Admin › Usuários › Ajustar créditos) e informe e-mail e senha nas instruções. Deixe o 2FA **desligado** nessa conta.

Depois de aprovado, mude o app para o **modo Ao vivo**.

## 7. Limites e requisitos que a Vysify já trata

- **Formato:** o Instagram só aceita imagem JPEG. A Vysify converte automaticamente.
- **Proporção:** o feed aceita de 4:5 a 1.91:1. Imagens 9:16 só aparecem como opção para Stories e Página.
- **Vídeos:** o Instagram processa os vídeos em segundo plano. A Vysify acompanha o status (pela tela e pelo cron) e publica quando estiverem prontos.
- **Limite diário:** a Meta limita quantos posts uma conta pode fazer por API em 24 horas. O erro é mostrado ao cliente.
- **Token:** dura cerca de 60 dias. Quando expira, a Vysify marca a conexão e pede para reconectar.
- **Mídia pública:** as URLs do S3 precisam ser HTTPS e de leitura pública.
- **Duplicidade:** cliques repetidos no mesmo destino em até 2 minutos não geram posts duplicados.

## 8. Fora do escopo atual

- **Criar anúncios pagos** (Gerenciador de Anúncios/Marketing API) exige a permissão `ads_management` e outra rodada de revisão. A estrutura de conexões já suporta isso: é o próximo passo natural depois da aprovação das permissões orgânicas.
- **Agendamento** de posts para uma data futura.
