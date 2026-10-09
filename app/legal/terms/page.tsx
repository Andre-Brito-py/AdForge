import { getLocale } from "next-intl/server";
import { getCompany, LEGAL_UPDATED_AT } from "@/lib/company";
import { getAppConfig } from "@/lib/config";
import { TermsEn } from "@/components/legal/terms-en";

export async function generateMetadata() {
  return { title: (await getLocale()) === "en" ? "Terms of Service" : "Termos de Uso" };
}

export default async function TermsPage() {
  return (await getLocale()) === "en" ? <TermsEn /> : <TermsPt />;
}

async function TermsPt() {
  const COMPANY = await getCompany();
  const fee = (await getAppConfig()).settings.cancellationFeePercent;
  return (
    <>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Termos de Uso</h1>
      <p className="mt-2 text-sm">Última atualização: {LEGAL_UPDATED_AT}</p>

      <h2>1. Quem somos</h2>
      <p>
        A Vysify é um serviço on-line operado por <strong>{COMPANY.name}</strong>, inscrita no CNPJ sob o nº {COMPANY.cnpj}, com sede em {COMPANY.address}
        (“Vysify”, “nós”). Contato: <a href={`mailto:${COMPANY.supportEmail}`}>{COMPANY.supportEmail}</a>.
      </p>

      <h2>2. O serviço</h2>
      <p>
        A Vysify usa modelos de inteligência artificial de terceiros para criar estratégias, textos, imagens, vídeos e locuções de anúncios a partir das
        informações e fotos de produtos enviadas por você (“Criativos”). Ao criar uma conta, você declara ter pelo menos 18 anos e capacidade para contratar.
      </p>

      <h2>3. Créditos e pagamentos</h2>
      <ul>
        <li>As gerações consomem créditos, conforme a tabela exibida na plataforma antes de cada geração.</li>
        <li>Créditos são vendidos em <strong>pacotes avulsos</strong> (pagamento único, sem renovação) ou em <strong>planos mensais</strong>, renovados automaticamente todo mês até o cancelamento.</li>
        <li>
          A assinatura pode ser cancelada a qualquer momento em Comprar créditos. Depois do cancelamento <strong>nenhuma cobrança futura é feita</strong>: o plano
          vale até o fim do período já pago e os créditos recebidos continuam no saldo.{" "}
          {fee > 0
            ? <>Há taxa de cancelamento de <strong>{fee}% de uma mensalidade</strong>, cobrada uma única vez e informada antes da contratação e da confirmação do cancelamento; ela não é cobrada nos 7 primeiros dias da assinatura (direito de arrependimento).</>
            : <>Não há taxa de cancelamento.</>}
        </li>
        <li>Créditos não expiram enquanto a conta estiver ativa e não podem ser convertidos em dinheiro, exceto nos casos de reembolso abaixo.</li>
        <li>Se uma geração falhar por motivo técnico, os créditos daquela geração são devolvidos automaticamente.</li>
        <li>Os pagamentos são processados pelo Mercado Pago ou pela Stripe. Não armazenamos dados de cartão.</li>
      </ul>

      <h2>4. Direito de arrependimento e reembolso</h2>
      <p>
        Conforme o art. 49 do Código de Defesa do Consumidor, você pode desistir da compra em até <strong>7 (sete) dias</strong> contados do pagamento,
        pedindo o reembolso pelo e-mail <a href={`mailto:${COMPANY.supportEmail}`}>{COMPANY.supportEmail}</a>. O valor é devolvido pelo mesmo meio de pagamento.
        Créditos já utilizados para gerar Criativos entregues podem ser descontados proporcionalmente, pois o serviço foi prestado a seu pedido.
      </p>

      <h2>5. Uso permitido</h2>
      <p>A plataforma é destinada exclusivamente à criação de anúncios de produtos e serviços lícitos. É proibido usá-la para gerar conteúdo que:</p>
      <ul>
        <li>contenha nudez, conteúdo sexual, violência, armas, drogas ilícitas ou incentive atividades ilegais;</li>
        <li>use a imagem, a voz ou o nome de pessoas reais sem autorização, incluindo deepfakes;</li>
        <li>faça propaganda enganosa ou abusiva, promessas de cura ou de ganhos financeiros garantidos;</li>
        <li>viole marcas, direitos autorais ou direitos de imagem de terceiros;</li>
        <li>tenha caráter político-partidário, discriminatório ou de ódio;</li>
        <li>mostre pessoa que aparente ser menor de 18 anos em roupa íntima, roupa de banho ou qualquer contexto sensual.</li>
      </ul>
      <p>
        Moda íntima, lingerie, modeladores e moda praia são permitidos <strong>como produto</strong>: em cabide, manequim, foto do produto aberto ou
        vestidos por adultos em pose de catálogo, com as partes íntimas cobertas e sem transparência. As imagens enviadas (foto do produto, logotipo e
        imagens de referência) passam por moderação automática e podem ser recusadas. Ao anexar fotos com pessoas, você declara ter autorização para usar a
        imagem delas; registramos essa declaração.
      </p>
      <p>
        Usamos moderação automática que pode bloquear pedidos antes da cobrança. Violações podem levar à suspensão da conta. Créditos de contas suspensas por
        violação grave destes Termos não são reembolsados, salvo o previsto na lei.
      </p>

      <h2>6. Seu conteúdo e os Criativos</h2>
      <ul>
        <li>Você declara ter os direitos necessários sobre as fotos, marcas e informações que envia.</li>
        <li>Os Criativos gerados a partir do seu conteúdo podem ser usados por você para fins comerciais.</li>
        <li>
          Conteúdo gerado por IA pode conter imprecisões ou semelhanças com outros conteúdos. <strong>Revise os Criativos antes de publicar</strong>, especialmente
          preços, características do produto e afirmações sobre benefícios. Você é responsável pelos anúncios que veicular.
        </li>
        <li>Você nos concede licença limitada para armazenar e processar seu conteúdo apenas para prestar o serviço.</li>
      </ul>

      <h2>7. Publicação em redes sociais</h2>
      <p>
        Ao conectar sua conta do Facebook/Instagram, você autoriza a Vysify a publicar <strong>apenas</strong> os criativos que você escolher, na conta e no
        formato selecionados, quando clicar em “Publicar”. Você continua responsável pelo conteúdo publicado e pelo cumprimento das políticas da Meta
        (incluindo as de publicidade e de comércio). Você pode desconectar a conta a qualquer momento em Integrações.
      </p>

      <h2>8. Disponibilidade</h2>
      <p>
        Trabalhamos para manter o serviço disponível, mas ele depende de provedores de IA e infraestrutura de terceiros e pode passar por instabilidades ou
        manutenções. Resultados de IA variam e não garantimos desempenho de vendas dos anúncios.
      </p>

      <h2>9. Responsabilidade</h2>
      <p>
        Na máxima extensão permitida pela lei, nossa responsabilidade total relacionada ao serviço se limita ao valor pago por você nos 12 meses anteriores ao
        evento. Nada nestes Termos limita direitos garantidos pelo Código de Defesa do Consumidor.
      </p>

      <h2>10. Encerramento</h2>
      <p>
        Você pode excluir sua conta a qualquer momento em Configurações. Podemos suspender contas que violem estes Termos, com aviso quando possível.
      </p>

      <h2>11. Alterações e foro</h2>
      <p>
        Podemos atualizar estes Termos; mudanças relevantes serão comunicadas por e-mail ou na plataforma com antecedência razoável. Fica eleito o foro do
        domicílio do consumidor para resolver eventuais disputas, na forma da lei brasileira.
      </p>
    </>
  );
}
