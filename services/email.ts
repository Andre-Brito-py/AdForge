import { Resend } from "resend";

// Iniciamos com null caso a chave não esteja no .env ainda.
// Em produção, isso deve ser configurado no painel da Vercel ou local.
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// E-mail remetente padrão (O Resend exige que seja um domínio verificado, como contato@vysify.com)
const DEFAULT_FROM = process.env.EMAIL_FROM || "Vysify <onboarding@resend.dev>"; 

export async function sendWelcomeEmail(to: string, name: string) {
  if (!resend) {
    console.warn("RESEND_API_KEY não configurada. E-mail de Boas-vindas cancelado.");
    return;
  }

  try {
    await resend.emails.send({
      from: DEFAULT_FROM,
      to,
      subject: "Bem-vindo(a) ao Vysify! 🚀",
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Olá, ${name || 'Criador'}!</h2>
          <p>Que incrível ter você a bordo no <strong>Vysify</strong>, o estúdio de IA definitivo para criação de campanhas.</p>
          <p>Aqui você poderá:</p>
          <ul>
            <li>Gerar Estratégias e Cópias Conversacionais.</li>
            <li>Transformar imagens em vídeos realistas.</li>
            <li>Sincronizar locuções naturais para seus anúncios.</li>
          </ul>
          <p>Vá até o seu <a href="${process.env.NEXTAUTH_URL}/dashboard">Dashboard</a> e crie sua primeira campanha agora mesmo!</p>
          <br/>
          <p>Abraços,</p>
          <p>Equipe Vysify</p>
        </div>
      `,
    });
    console.log(`E-mail de boas-vindas enviado para ${to}`);
  } catch (error) {
    console.error("Erro ao enviar e-mail de boas-vindas:", error);
  }
}

export async function sendPurchaseReceipt(to: string, name: string, planName: string, credits: number) {
  if (!resend) {
    console.warn("RESEND_API_KEY não configurada. Recibo de compra cancelado.");
    return;
  }

  try {
    await resend.emails.send({
      from: DEFAULT_FROM,
      to,
      subject: `Obrigado por assinar o plano ${planName}! 💎`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Obrigado pela confiança, ${name || 'Criador'}!</h2>
          <p>Seu pagamento foi confirmado com sucesso. O plano <strong>${planName}</strong> já está ativo na sua conta.</p>
          <p>Foram adicionados <strong>${credits} Créditos</strong> ao seu Workspace.</p>
          <p>Agora é só usar a criatividade para escalar suas vendas usando a Inteligência Artificial.</p>
          <br/>
          <a href="${process.env.NEXTAUTH_URL}/dashboard" style="background-color: #6d28d9; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">Acessar Dashboard</a>
          <br/><br/>
          <p>Abraços,</p>
          <p>Equipe Vysify</p>
        </div>
      `,
    });
    console.log(`Recibo enviado para ${to}`);
  } catch (error) {
    console.error("Erro ao enviar recibo:", error);
  }
}
