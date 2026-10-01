export default function PrivacyPage() {
  return (
    <div className="max-w-4xl mx-auto py-16 px-6">
      <h1 className="text-4xl font-bold mb-8">Política de Privacidade</h1>
      
      <div className="prose dark:prose-invert max-w-none space-y-6">
        <p><strong>Última atualização:</strong> {new Date().toLocaleDateString('pt-BR')}</p>
        
        <h2>1. Compromisso com a LGPD</h2>
        <p>A privacidade dos seus dados é prioridade para o Vysify. Esta política descreve como coletamos, usamos e protegemos suas informações em conformidade com a Lei Geral de Proteção de Dados (LGPD - Lei 13.709/2018).</p>
        
        <h2>2. Dados Coletados</h2>
        <ul>
          <li><strong>Dados de Conta:</strong> Nome, e-mail e foto do perfil (via Google OAuth ou login manual).</li>
          <li><strong>Dados de Faturamento:</strong> Endereço e dados fiscais repassados de forma criptografada para nossos gateways de pagamento (Stripe/MercadoPago). Não armazenamos números de cartão de crédito em nossos servidores.</li>
          <li><strong>Mídia e Prompts:</strong> Imagens de produtos e instruções de texto que você envia para gerar as campanhas.</li>
          <li><strong>Cookies e Uso:</strong> Dados de navegação e desempenho da plataforma.</li>
        </ul>

        <h2>3. Como Usamos Seus Dados</h2>
        <p>Utilizamos os dados estritamente para:</p>
        <ul>
          <li>Prestar o serviço de geração de anúncios via inteligência artificial.</li>
          <li>Processar pagamentos e gerar notas fiscais.</li>
          <li>Enviar e-mails transacionais (como recibos de compra e recuperação de senha).</li>
          <li>Melhorar os filtros de segurança e evitar abusos na plataforma.</li>
        </ul>

        <h2>4. Compartilhamento de Dados com Terceiros</h2>
        <p>Para o funcionamento do SaaS, seus prompts de texto, imagens e áudios gerados podem trafegar pelos servidores dos nossos provedores de IA (Google Gemini, ElevenLabs, OpenAI). Estes provedores possuem cláusulas rigorosas de confidencialidade e **não utilizam os dados do Vysify para treinar seus modelos de fundação** publicamente.</p>
        
        <h2>5. Seus Direitos (Art. 18 da LGPD)</h2>
        <p>A qualquer momento, você pode solicitar:</p>
        <ul>
          <li>A confirmação e acesso aos seus dados.</li>
          <li>A correção de dados incompletos ou inexatos.</li>
          <li>A exclusão definitiva da sua conta e de todas as mídias geradas dos nossos servidores.</li>
        </ul>

        <h2>6. Contato do Encarregado (DPO)</h2>
        <p>Para exercer seus direitos, solicitar exclusão de conta ou tirar dúvidas sobre privacidade, envie um e-mail para dpo@vysify.com.</p>
      </div>
    </div>
  );
}
