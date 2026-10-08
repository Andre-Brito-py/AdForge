import { Resend } from "resend";
import { getAppConfig } from "@/lib/config";

type Lang = "pt" | "en";
const lang = (l: string | null | undefined): Lang => (l === "en" ? "en" : "pt");

export function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000").replace(/\/$/, "");
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

const COPY = {
  pt: {
    footer: "Você recebeu este e-mail porque tem uma conta na Vysify.",
    fallback: "Se o botão não funcionar, copie e cole este link no navegador:",
    welcomeSubject: "Boas-vindas à Vysify",
    welcomeTitle: (n: string) => `Boas-vindas, ${n || "criador"}!`,
    welcomeBody: "Sua conta está pronta. Cadastre um produto, escolha o objetivo e a Vysify cria a estratégia, os textos e os criativos do seu anúncio.",
    welcomeCta: "Abrir meu painel",
    verifySubject: "Confirme seu e-mail na Vysify",
    verifyTitle: "Confirme seu e-mail",
    verifyBody: (n: string) => `Olá${n ? `, ${n}` : ""}! Confirme seu endereço para liberar a geração de campanhas. O link vale por 24 horas.`,
    verifyCta: "Confirmar e-mail",
    resetSubject: "Redefinição de senha da Vysify",
    resetTitle: "Redefinir sua senha",
    resetBody: "Recebemos um pedido para redefinir a senha da sua conta. O link vale por 1 hora. Se não foi você, ignore este e-mail: sua senha continua a mesma.",
    resetCta: "Criar nova senha",
    receiptSubject: (plan: string) => `Recibo: pacote ${plan}`,
    receiptTitle: "Pagamento confirmado",
    receiptBody: (n: string, amount: string, plan: string, credits: number) =>
      `<p>Obrigado${n ? `, ${n}` : ""}! Recebemos o pagamento de <strong>${amount}</strong> pelo pacote <strong>${plan}</strong>.</p><p><strong>${credits} créditos</strong> já foram adicionados ao seu workspace. Créditos não expiram.</p>`,
    receiptCta: "Criar uma campanha",
    readySubject: (c: string) => `Pronto: ${c}`,
    readyTitle: "Sua campanha está pronta",
    readyBody: (c: string) => `Os criativos de <strong>${c}</strong> terminaram de ser gerados.`,
    readyFailed: (n: number) => `${n} variação(ões) não puderam ser geradas e os créditos correspondentes foram devolvidos automaticamente.`,
    readyCta: "Ver criativos",
  },
  en: {
    footer: "You received this email because you have a Vysify account.",
    fallback: "If the button doesn't work, copy and paste this link into your browser:",
    welcomeSubject: "Welcome to Vysify",
    welcomeTitle: (n: string) => `Welcome, ${n || "creator"}!`,
    welcomeBody: "Your account is ready. Add a product, pick a goal and Vysify creates the strategy, copy and creatives for your ad.",
    welcomeCta: "Open my dashboard",
    verifySubject: "Confirm your email on Vysify",
    verifyTitle: "Confirm your email",
    verifyBody: (n: string) => `Hi${n ? ` ${n}` : ""}! Confirm your address to start generating campaigns. The link is valid for 24 hours.`,
    verifyCta: "Confirm email",
    resetSubject: "Reset your Vysify password",
    resetTitle: "Reset your password",
    resetBody: "We received a request to reset your account password. The link is valid for 1 hour. If it wasn't you, ignore this email: your password stays the same.",
    resetCta: "Create new password",
    receiptSubject: (plan: string) => `Receipt: ${plan} pack`,
    receiptTitle: "Payment confirmed",
    receiptBody: (n: string, amount: string, plan: string, credits: number) =>
      `<p>Thank you${n ? `, ${n}` : ""}! We received your payment of <strong>${amount}</strong> for the <strong>${plan}</strong> pack.</p><p><strong>${credits} credits</strong> have been added to your workspace. Credits never expire.</p>`,
    receiptCta: "Create a campaign",
    readySubject: (c: string) => `Ready: ${c}`,
    readyTitle: "Your campaign is ready",
    readyBody: (c: string) => `The creatives for <strong>${c}</strong> have finished generating.`,
    readyFailed: (n: number) => `${n} variation(s) couldn't be generated and the corresponding credits were refunded automatically.`,
    readyCta: "View creatives",
  },
};

function layout(l: Lang, title: string, body: string, cta?: { label: string; href: string }) {
  const button = cta
    ? `<p style="margin:28px 0"><a href="${cta.href}" style="background:#6d28d9;color:#fff;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:600;display:inline-block">${cta.label}</a></p>
       <p style="font-size:12px;color:#71717a">${COPY[l].fallback}<br/><span style="word-break:break-all">${cta.href}</span></p>`
    : "";
  return `<!doctype html><html lang="${l === "pt" ? "pt-BR" : "en"}"><body style="margin:0;background:#f4f4f5;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#18181b">
  <div style="max-width:560px;margin:0 auto;padding:32px 16px">
    <div style="background:#fff;border:1px solid #e4e4e7;border-radius:16px;padding:32px;line-height:1.6;color:#3f3f46">
      <p style="font-weight:800;font-size:18px;margin:0 0 24px;letter-spacing:-0.02em;color:#18181b">Vysify</p>
      <h1 style="font-size:22px;margin:0 0 16px;letter-spacing:-0.02em;color:#18181b">${title}</h1>
      ${body}
      ${button}
    </div>
    <p style="font-size:12px;color:#a1a1aa;text-align:center;margin-top:16px">${COPY[l].footer}</p>
  </div></body></html>`;
}

// Reaproveita o cliente enquanto a chave não muda (a chave vem do painel Admin ou do RESEND_API_KEY).
let client: { key: string; resend: Resend } | null = null;

async function send(to: string, subject: string, html: string, devLink?: string) {
  const { secrets, settings } = await getAppConfig();
  const key = secrets.resendKey;
  if (!key) {
    // Sem Resend configurado (ex.: desenvolvimento local), registramos o link no log
    // para que o fluxo de verificação/recuperação continue testável.
    console.warn(`[email] RESEND_API_KEY ausente. E-mail "${subject}" para ${to} não enviado.${devLink ? ` Link: ${devLink}` : ""}`);
    return;
  }
  if (client?.key !== key) client = { key, resend: new Resend(key) };
  try {
    await client.resend.emails.send({ from: settings.emailFrom, to, subject, html });
  } catch (error) {
    console.error(`[email] falha ao enviar "${subject}"`, error);
  }
}

export async function sendWelcomeEmail(to: string, name: string, locale?: string | null) {
  const l = lang(locale), c = COPY[l];
  await send(to, c.welcomeSubject, layout(l, c.welcomeTitle(escapeHtml(name)), `<p>${c.welcomeBody}</p>`, { label: c.welcomeCta, href: `${appUrl()}/dashboard` }));
}

export async function sendVerificationEmail(to: string, name: string, token: string, locale?: string | null) {
  const l = lang(locale), c = COPY[l];
  const link = `${appUrl()}/verify-email?token=${encodeURIComponent(token)}`;
  await send(to, c.verifySubject, layout(l, c.verifyTitle, `<p>${c.verifyBody(escapeHtml(name))}</p>`, { label: c.verifyCta, href: link }), link);
}

export async function sendPasswordResetEmail(to: string, token: string, locale?: string | null) {
  const l = lang(locale), c = COPY[l];
  const link = `${appUrl()}/reset-password?token=${encodeURIComponent(token)}`;
  await send(to, c.resetSubject, layout(l, c.resetTitle, `<p>${c.resetBody}</p>`, { label: c.resetCta, href: link }), link);
}

export async function sendPurchaseReceipt(to: string, name: string, planName: string, credits: number, amountLabel: string, locale?: string | null) {
  const l = lang(locale), c = COPY[l];
  const html = layout(l, c.receiptTitle, c.receiptBody(escapeHtml(name), escapeHtml(amountLabel), escapeHtml(planName), credits), {
    label: c.receiptCta,
    href: `${appUrl()}/campaigns/new`,
  });
  await send(to, c.receiptSubject(planName), html);
}

/** Aviso operacional para os admins (sempre em português, como o painel). `lines` são texto puro. */
export async function sendAdminAlertEmail(to: string, subject: string, lines: string[]) {
  const body = lines.map((line) => `<p>${escapeHtml(line)}</p>`).join("");
  await send(to, `[Vysify admin] ${subject}`, layout("pt", escapeHtml(subject), body, { label: "Abrir o painel admin", href: `${appUrl()}/admin` }));
}

export async function sendCampaignReadyEmail(to: string, campaignName: string, campaignId: string, failedCount: number, locale?: string | null) {
  const l = lang(locale), c = COPY[l];
  const body = `<p>${c.readyBody(escapeHtml(campaignName))}</p>${failedCount > 0 ? `<p>${c.readyFailed(failedCount)}</p>` : ""}`;
  await send(to, c.readySubject(campaignName), layout(l, c.readyTitle, body, { label: c.readyCta, href: `${appUrl()}/campaigns/${campaignId}` }));
}
