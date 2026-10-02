import { getLocale } from "next-intl/server";
import { getCompany, LEGAL_UPDATED_AT } from "@/lib/company";
import { PrivacyEn } from "@/components/legal/privacy-en";

export async function generateMetadata() {
  return { title: (await getLocale()) === "en" ? "Privacy Policy" : "Política de Privacidade" };
}

export default async function PrivacyPage() {
  return (await getLocale()) === "en" ? <PrivacyEn /> : <PrivacyPt />;
}

async function PrivacyPt() {
  const COMPANY = await getCompany();
  return (
    <>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Política de Privacidade</h1>
      <p className="mt-2 text-sm">Última atualização: {LEGAL_UPDATED_AT}</p>

      <p className="mt-6">
        Esta política explica como <strong>{COMPANY.name}</strong> (CNPJ {COMPANY.cnpj}), controladora dos dados, trata informações pessoais na Vysify, em
        conformidade com a Lei Geral de Proteção de Dados (Lei 13.709/2018, “LGPD”).
      </p>

      <h2>1. Dados que coletamos</h2>
      <ul>
        <li><strong>Conta:</strong> nome, e-mail, senha (armazenada apenas como hash irreversível) e, se ativado, o segredo do 2FA.</li>
        <li><strong>Conteúdo:</strong> fotos e descrições de produtos, Brand Kit e os Criativos gerados.</li>
        <li><strong>Pagamentos:</strong> pacote comprado, valor, data e identificador da transação. Dados de cartão ficam com o Mercado Pago ou a Stripe.</li>
        <li>
          <strong>Contas conectadas (Facebook/Instagram):</strong> se você conectar sua conta da Meta, guardamos o identificador e o nome da conta,
          a lista das Páginas e contas do Instagram que você autorizou e um token de acesso (criptografado). Usamos esses dados <strong>somente</strong> para
          publicar os criativos que você mandar publicar e mostrar o link do post. Não lemos mensagens, seguidores nem métricas.
        </li>
        <li><strong>Uso e segurança:</strong> histórico de créditos, registros técnicos (endereço IP, data e hora) para prevenção de fraude e abuso.</li>
        <li>
          <strong>Declaração de autorização de imagem:</strong> quando você anexa imagens de referência com pessoas, registramos sua declaração de que tem
          autorização para usar a imagem delas: data e hora, o texto aceito, seu e-mail e nome, IP, navegador, a campanha e a impressão digital (hash
          SHA-256) de cada imagem.
        </li>
      </ul>

      <h2>2. Para que usamos e com qual base legal</h2>
      <ul>
        <li>Prestar o serviço e processar pagamentos: execução de contrato (art. 7º, V).</li>
        <li>Segurança, prevenção de fraude e limites de uso: legítimo interesse (art. 7º, IX).</li>
        <li>Guardar registros de acesso e documentos fiscais: obrigação legal (art. 7º, II; Marco Civil da Internet, art. 15).</li>
        <li>Guardar a declaração de autorização de imagem, como prova em eventuais reclamações ou processos: exercício regular de direitos (art. 7º, VI).</li>
        <li>Enviar novidades e dicas: consentimento (art. 7º, I), que você pode retirar a qualquer momento em Configurações.</li>
      </ul>
      <p>Não vendemos seus dados e não usamos suas fotos para treinar modelos próprios.</p>

      <h2>3. Com quem compartilhamos</h2>
      <p>Somente com operadores necessários para o serviço funcionar, sob contrato:</p>
      <ul>
        <li>Provedores de IA: Google (Gemini), fal.ai, ElevenLabs e OpenAI, que recebem as fotos e textos necessários para cada geração;</li>
        <li>Pagamentos: Mercado Pago e Stripe;</li>
        <li>Meta Platforms (Facebook e Instagram): recebe a imagem ou o vídeo e a legenda que você decidir publicar, na conta que você escolher;</li>
        <li>Infraestrutura: Vercel (hospedagem), Supabase (banco de dados e armazenamento) e Resend (e-mails transacionais).</li>
      </ul>
      <p>
        Alguns desses provedores processam dados fora do Brasil. Nesses casos, a transferência ocorre com base em cláusulas contratuais e nas garantias
        previstas no art. 33 da LGPD.
      </p>

      <h2>4. Por quanto tempo guardamos</h2>
      <ul>
        <li>Dados da conta e conteúdo: enquanto a conta existir. Ao excluir a conta, apagamos conta, produtos, campanhas e arquivos.</li>
        <li>Registros de pagamento: 5 anos, por obrigação fiscal.</li>
        <li>
          Tokens da Meta: até você desconectar a conta em Integrações, remover a Vysify nas configurações do Facebook ou excluir sua conta. Nesses casos,
          apagamos o token e a lista de Páginas imediatamente (veja também <a href="/meta-data-deletion">exclusão de dados da Meta</a>).
        </li>
        <li>Registros de acesso: 6 meses (Marco Civil da Internet).</li>
        <li>
          Declarações de autorização de imagem: 5 anos a partir da declaração (prazo de prescrição do art. 27 do CDC), <strong>mesmo após a exclusão da
          campanha ou da conta</strong>, porque servem de prova (LGPD, art. 16). Guardamos só o hash das imagens, não as imagens. Depois do prazo, o registro
          é apagado automaticamente. Só a administração da Vysify tem acesso, e apenas para defesa em reclamações, processos ou pedidos de autoridades.
        </li>
      </ul>

      <h2>5. Seus direitos</h2>
      <p>Você pode, a qualquer momento:</p>
      <ul>
        <li><strong>Baixar seus dados</strong> (portabilidade) e <strong>excluir sua conta</strong> diretamente em Configurações › Privacidade;</li>
        <li>corrigir dados, saber com quem compartilhamos, revogar consentimentos e pedir informações pelo e-mail <a href={`mailto:${COMPANY.privacyEmail}`}>{COMPANY.privacyEmail}</a>;</li>
        <li>apresentar reclamação à Autoridade Nacional de Proteção de Dados (ANPD).</li>
      </ul>
      <p>Respondemos solicitações em até 15 dias.</p>

      <h2>6. Cookies</h2>
      <p>
        Usamos cookies essenciais para manter você conectado e lembrar idioma, moeda e tema. Cookies de análise ou marketing só são usados se estiverem
        ativados e <strong>somente depois do seu consentimento</strong>. Veja a <a href="/legal/cookies">Política de Cookies</a>.
      </p>

      <h2>7. Segurança</h2>
      <p>
        Usamos conexão criptografada (HTTPS), senhas com hash bcrypt, chaves de API criptografadas, verificação em duas etapas opcional, limites de tentativas
        de login e controle de acesso por conta. Nenhum sistema é 100% seguro; se ocorrer um incidente relevante, avisaremos você e a ANPD conforme a lei.
      </p>

      <h2>8. Encarregado (DPO)</h2>
      <p>
        Fale com nosso encarregado pelo e-mail <a href={`mailto:${COMPANY.privacyEmail}`}>{COMPANY.privacyEmail}</a>.
      </p>
    </>
  );
}
