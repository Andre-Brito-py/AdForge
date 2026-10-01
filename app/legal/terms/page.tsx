export default function TermsPage() {
  return (
    <div className="max-w-4xl mx-auto py-16 px-6">
      <h1 className="text-4xl font-bold mb-8">Termos de Uso</h1>
      
      <div className="prose dark:prose-invert max-w-none space-y-6">
        <p><strong>Última atualização:</strong> {new Date().toLocaleDateString('pt-BR')}</p>
        
        <h2>1. Aceitação dos Termos</h2>
        <p>Ao acessar e utilizar a plataforma Vysify, você concorda com estes Termos de Uso. O Vysify é uma plataforma B2B estritamente destinada à geração de anúncios comerciais e materiais publicitários para produtos legítimos.</p>
        
        <h2>2. Uso Permitido e Moderação de Conteúdo</h2>
        <p>Nossa inteligência artificial possui filtros rigorosos (Guardrails). <strong>É estritamente proibido</strong> utilizar a plataforma para gerar conteúdo relacionado a:</p>
        <ul>
          <li>Violência, pornografia ou conteúdo explícito.</li>
          <li>Deepfakes políticos, materiais difamatórios ou discursos de ódio.</li>
          <li>Qualquer produto ou serviço ilegal no Brasil (ou no país de veiculação).</li>
        </ul>
        <p>Pedidos que violem esta regra serão bloqueados automaticamente. A reincidência pode levar ao banimento da conta sem direito a reembolso dos créditos.</p>

        <h2>3. Propriedade Intelectual e Responsabilidade</h2>
        <p>Todo o conteúdo final (copy, áudio e vídeo) gerado a partir dos prompts e imagens enviadas por você é de sua propriedade. No entanto, <strong>você é o único responsável legal</strong> por garantir que possui os direitos autorais e de imagem dos produtos e marcas que faz upload na plataforma.</p>
        <p>O Vysify não se responsabiliza por infrações de copyright, marca registrada ou uso indevido de imagem gerados pelos usuários.</p>

        <h2>4. Política de Cancelamento e Reembolso (Direito de Arrependimento)</h2>
        <p>Em conformidade com o Artigo 49 do Código de Defesa do Consumidor (CDC) brasileiro:</p>
        <ul>
          <li><strong>Garantia de 7 dias:</strong> Você tem o direito de se arrepender da contratação do plano pago no prazo de até 7 (sete) dias corridos a contar da data da assinatura, recebendo o reembolso integral.</li>
          <li><strong>Como solicitar:</strong> O cancelamento e reembolso dentro do prazo de 7 dias deve ser solicitado via suporte.</li>
          <li><strong>Após 7 dias:</strong> Você pode cancelar a renovação da sua assinatura a qualquer momento no seu painel. O cancelamento evitará cobranças futuras, mas não gerará reembolso proporcional dos dias não utilizados no mês/ano vigente, e você continuará com acesso até o fim do período pago.</li>
        </ul>

        <h2>5. Disponibilidade e Isenção de Garantias</h2>
        <p>Embora busquemos 99.9% de uptime, o Vysify depende de APIs de inteligência artificial de terceiros (como OpenAI, ElevenLabs, Google). Não garantimos que a geração de vídeos será instantânea ou livre de variações intrínsecas à natureza generativa das IAs.</p>
        
        <h2>6. Contato</h2>
        <p>Para dúvidas sobre estes termos, entre em contato através do e-mail suporte@vysify.com.</p>
      </div>
    </div>
  );
}
