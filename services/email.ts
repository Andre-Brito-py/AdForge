import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM = process.env.EMAIL_FROM || "Vysify <onboarding@resend.dev>";

export function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000").replace(/\/$/, "");
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function layout(title: string, body: string, cta?: { label: string; href: string }) {
  const button = cta
    ? `<p style="margin:28px 0"><a href="${cta.href}" style="background:#6d28d9;color:#fff;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:600;display:inline-block">${cta.label}</a></p>
       <p style="font-size:12px;color:#71717a">Se o botão não funcionar, copie e cole este link no navegador:<br/><span style="word-break:break-all">${cta.href}</span></p>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#f4f4f5;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#18181b">
  <div style="max-width:560px;margin:0 auto;padding:32px 16px">
    <div style="background:#fff;border:1px solid #e4e4e7;border-radius:16px;padding:32px">
      <p style="font-weight:800;font-size:18px;margin:0 0 24px;letter-spacing:-0.02em">Vysify</p>
      <h1 style="font-size:22px;margin:0 0 16px;letter-spacing:-0.02em">${title}</h1>
      ${body}
      ${button}
    </div>
    <p style="font-size:12px;color:#a1a1aa;text-align:center;margin-top:16px">Você recebeu este e-mail porque tem uma conta na Vysify.</p>
  </div></body></html>`;
}

async function send(to: string, subject: string, html: string, devLink?: string) {
  if (!resend) {
    // Sem Resend configurado (ex.: desenvolvimento local), registramos o link no log
    // para que o fluxo de verificação/recuperação continue testável.
    console.warn(`[email] RESEND_API_KEY ausente. E-mail "${subject}" para ${to} não enviado.${devLink ? ` Link: ${devLink}` : ""}`);
    return;
  }
  try {
    await resend.emails.send({ from: FROM, to, subject, html });
  } catch (error) {
    console.error(`[email] falha ao enviar "${subject}"`, error);
  }
}

export async function sendWelcomeEmail(to: string, name: string) {
  const html = layout(
    `Boas-vindas, ${escapeHtml(name || "criador")}!`,
    `<p style="line-height:1.6;color:#3f3f46">Sua conta está pronta. Cadastre um produto, escolha o objetivo e a Vysify cria a estratégia, os textos e os criativos do seu anúncio.</p>`,
    { label: "Abrir meu painel", href: `${appUrl()}/dashboard` }
  );
  await send(to, "Boas-vindas à Vysify", html);
}

export async function sendVerificationEmail(to: string, name: string, token: string) {
  const link = `${appUrl()}/verify-email?token=${encodeURIComponent(token)}`;
  const html = layout(
    "Confirme seu e-mail",
    `<p style="line-height:1.6;color:#3f3f46">Olá, ${escapeHtml(name || "")}! Confirme seu endereço para liberar a geração de campanhas. O link vale por 24 horas.</p>`,
    { label: "Confirmar e-mail", href: link }
  );
  await send(to, "Confirme seu e-mail na Vysify", html, link);
}

export async function sendPasswordResetEmail(to: string, token: string) {
  const link = `${appUrl()}/reset-password?token=${encodeURIComponent(token)}`;
  const html = layout(
    "Redefinir sua senha",
    `<p style="line-height:1.6;color:#3f3f46">Recebemos um pedido para redefinir a senha da sua conta. O link vale por 1 hora. Se não foi você, ignore este e-mail: sua senha continua a mesma.</p>`,
    { label: "Criar nova senha", href: link }
  );
  await send(to, "Redefinição de senha da Vysify", html, link);
}

export async function sendPurchaseReceipt(to: string, name: string, planName: string, credits: number, amountLabel: string) {
  const html = layout(
    "Pagamento confirmado",
    `<p style="line-height:1.6;color:#3f3f46">Obrigado, ${escapeHtml(name || "")}! Recebemos o pagamento de <strong>${escapeHtml(amountLabel)}</strong> pelo pacote <strong>${escapeHtml(planName)}</strong>.</p>
     <p style="line-height:1.6;color:#3f3f46"><strong>${credits} créditos</strong> já foram adicionados ao seu workspace. Créditos não expiram.</p>`,
    { label: "Criar uma campanha", href: `${appUrl()}/campaigns/new` }
  );
  await send(to, `Recibo: pacote ${planName}`, html);
}

export async function sendCampaignReadyEmail(to: string, campaignName: string, campaignId: string, failedCount: number) {
  const extra = failedCount > 0
    ? `<p style="line-height:1.6;color:#3f3f46">${failedCount} variação(ões) não puderam ser geradas e os créditos correspondentes foram devolvidos automaticamente.</p>`
    : "";
  const html = layout(
    "Sua campanha está pronta",
    `<p style="line-height:1.6;color:#3f3f46">Os criativos de <strong>${escapeHtml(campaignName)}</strong> terminaram de ser gerados.</p>${extra}`,
    { label: "Ver criativos", href: `${appUrl()}/campaigns/${campaignId}` }
  );
  await send(to, `Pronto: ${campaignName}`, html);
}
