"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight, Check, Coins, Globe, Image as ImageIcon, Palette, PenLine, RotateCcw, ShieldCheck, Sparkles, Upload, Video, Wand2,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { PixelMascot } from "@/components/mascot/PixelMascot";
import { CookieSettingsButton } from "@/components/consent/ConsentManager";

const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "suporte@vysify.com";
import { buttonClass } from "@/components/app/ui-bits";

interface Plan {
  id: string; name: string; description?: string | null; description_en?: string | null; price_brl: number; price_usd: number; price_eur?: number | null; credits: number;
  isFeatured?: boolean; features_pt: string[]; features_en: string[];
}

const COPY = {
  pt: {
    nav: ["Como funciona", "Recursos", "Preços", "Dúvidas"],
    signIn: "Entrar", dashboard: "Abrir painel",
    badge: (n: number) => (n > 0 ? `${n} créditos grátis para testar · sem cartão` : "Comece em menos de um minuto"),
    h1a: "Da foto do produto", h1b: "ao anúncio pronto.",
    sub: "Envie uma foto, escolha o objetivo e receba estratégia, textos, imagens publicitárias e vídeos com locução, prontos para Instagram, TikTok e Facebook.",
    ctaFree: "Começar grátis", cta: "Criar conta", how: "Ver como funciona",
    howTitle: "Três passos. Nenhum designer de plantão.",
    steps: [
      { t: "Envie a foto do produto", d: "Uma foto nítida já basta. Adicione descrição e público se quiser mais precisão." },
      { t: "Escolha objetivo e formato", d: "Vendas, lançamento ou engajamento; feed, stories ou Reels/TikTok; o estilo visual e a qualidade." },
      { t: "Baixe e publique", d: "Receba as variações com headline, copy e CTA. Gere novas versões com instruções extras quando quiser." },
    ],
    featTitle: "Tudo o que um anúncio precisa",
    feats: [
      { icon: PenLine, t: "Estratégia e copy", d: "Ganchos, headlines e textos em português, com ângulos diferentes para teste A/B." },
      { icon: ImageIcon, t: "Imagens publicitárias", d: "Seu produto em cenários profissionais, fiel à foto original, nos formatos 1:1, 4:5 e 9:16." },
      { icon: Video, t: "Vídeos com locução", d: "A foto vira um vídeo curto vertical, com narração do roteiro em áudio separado." },
      { icon: Palette, t: "Brand Kit", d: "Cor e tom de voz da sua marca aplicados automaticamente em todas as gerações." },
      { icon: Globe, t: "Anúncios em 9 idiomas", d: "Venda para outros países: textos e locução em inglês, espanhol, francês, alemão, italiano e mais." },
      { icon: RotateCcw, t: "Estorno automático", d: "Se uma variação falhar, os créditos dela voltam sozinhos para a sua conta." },
      { icon: ShieldCheck, t: "Uso responsável", d: "Moderação automática bloqueia conteúdo enganoso ou proibido antes de cobrar." },
    ],
    priceTitle: "Pague só pelo que usar",
    priceSub: (img: number, vid: number) => `Pacotes avulsos, sem assinatura. Créditos não expiram. Imagem = ${img} créditos · vídeo = ${vid} créditos.`,
    credits: "créditos", buy: "Começar", popular: "Mais escolhido",
    free: {
      name: "Grátis", cta: "Começar grátis",
      description: "Para conhecer a Vysify antes de comprar.",
      features: (n: number, img: number) => [`${n} créditos para testar (~${Math.floor(n / img)} imagens)`, "Sem cartão de crédito", "Todos os formatos e estilos"],
    },
    faqTitle: "Perguntas frequentes",
    faq: [
      ["Os créditos expiram?", "Não. Você compra um pacote uma vez e usa quando quiser. Não há renovação automática."],
      ["E se a geração der errado?", "Se uma variação falhar por qualquer motivo técnico, os créditos dela são devolvidos automaticamente. Você também pode pedir uma nova versão com instruções extras."],
      ["Quem é dono dos criativos?", "Você. O conteúdo gerado a partir das suas fotos pode ser usado comercialmente, desde que você tenha os direitos sobre o produto e a imagem enviada."],
      ["Que tipo de foto funciona melhor?", "Foto nítida, com o produto inteiro no quadro, boa iluminação e fundo simples. Fotos de celular funcionam bem."],
      ["Posso pedir reembolso?", "Sim. Você pode desistir e receber o valor de volta pelos créditos não utilizados em até 7 dias após a compra no Brasil (art. 49 do CDC) e em até 14 dias em compras internacionais."],
      ["Quais formas de pagamento?", "Pix, cartão e boleto pelo Mercado Pago, ou cartão internacional pela Stripe."],
    ],
    finalTitle: "Seu próximo anúncio começa com uma foto.",
    footer: { terms: "Termos de Uso", privacy: "Privacidade", cookies: "Cookies", support: "Suporte", rights: "Todos os direitos reservados." },
  },
  en: {
    nav: ["How it works", "Features", "Pricing", "FAQ"],
    signIn: "Sign in", dashboard: "Open dashboard",
    badge: (n: number) => (n > 0 ? `${n} free credits to try · no card required` : "Get started in under a minute"),
    h1a: "From product photo", h1b: "to ready-to-run ad.",
    sub: "Upload a photo, pick a goal and get strategy, copy, ad images and voiced-over videos ready for Instagram, TikTok and Facebook.",
    ctaFree: "Start free", cta: "Create account", how: "See how it works",
    howTitle: "Three steps. No designer on call.",
    steps: [
      { t: "Upload a product photo", d: "One sharp photo is enough. Add a description and audience for more precision." },
      { t: "Choose goal and format", d: "Sales, launch or engagement; feed, stories or Reels/TikTok; visual style and quality." },
      { t: "Download and publish", d: "Get variations with headline, copy and CTA. Generate new versions with extra instructions anytime." },
    ],
    featTitle: "Everything an ad needs",
    feats: [
      { icon: PenLine, t: "Strategy & copy", d: "Hooks, headlines and copy with different angles for A/B testing." },
      { icon: ImageIcon, t: "Ad images", d: "Your product in professional scenes, faithful to the original photo, in 1:1, 4:5 and 9:16." },
      { icon: Video, t: "Voiced-over videos", d: "Your photo becomes a short vertical video, with the script narrated as a separate audio track." },
      { icon: Palette, t: "Brand Kit", d: "Your brand color and tone of voice applied to every generation." },
      { icon: Globe, t: "Ads in 9 languages", d: "Sell anywhere: copy and voiceover in English, Spanish, French, German, Italian, Portuguese and more." },
      { icon: RotateCcw, t: "Automatic refunds", d: "If a variation fails, its credits go straight back to your balance." },
      { icon: ShieldCheck, t: "Responsible use", d: "Automatic moderation blocks misleading or prohibited content before charging." },
    ],
    priceTitle: "Pay only for what you use",
    priceSub: (img: number, vid: number) => `One-off packs, no subscription. Credits never expire. Image = ${img} credits · video = ${vid} credits.`,
    credits: "credits", buy: "Get started", popular: "Most popular",
    free: {
      name: "Free", cta: "Start free",
      description: "Try Vysify before you buy.",
      features: (n: number, img: number) => [`${n} credits to try (~${Math.floor(n / img)} images)`, "No credit card", "All formats and styles"],
    },
    faqTitle: "FAQ",
    faq: [
      ["Do credits expire?", "No. Buy a pack once and use it whenever you want. No auto-renewal."],
      ["What if a generation fails?", "If a variation fails for any technical reason, its credits are refunded automatically."],
      ["Who owns the creatives?", "You do, as long as you hold the rights to the product and the photo you upload."],
      ["What photos work best?", "Sharp photos with the whole product in frame, good lighting and a simple background."],
      ["Can I get a refund?", "Yes. Unused credits can be refunded within 14 days of purchase, no questions asked. EU/UK consumers keep their statutory withdrawal rights."],
      ["Which languages can the ads be in?", "Portuguese, English, Spanish, French, German and Italian, with regional variants (US/UK English, Spain/Latin America Spanish). The voiceover follows the same language."],
      ["Do you charge sales tax or VAT?", "Where required, tax is calculated at checkout based on your location. Businesses can add a VAT/tax ID and receive an invoice."],
      ["Payment methods?", "Cards worldwide via Stripe; Pix, cards and boleto via Mercado Pago in Brazil."],
    ],
    finalTitle: "Your next ad starts with a photo.",
    footer: { terms: "Terms of Service", privacy: "Privacy", cookies: "Cookies", support: "Support", rights: "All rights reserved." },
  },
};

const fade = { initial: { opacity: 0, y: 16 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: "-60px" }, transition: { duration: 0.45 } };

export default function LandingPageClient({
  plans, signupCredits, freePlanVisible, costs, locale, currency, loggedIn,
}: {
  plans: Plan[]; signupCredits: number; freePlanVisible: boolean; costs: { image: number; video: number }; locale: "pt" | "en"; currency: "BRL" | "USD" | "EUR"; loggedIn: boolean;
}) {
  const showFreePlan = freePlanVisible && signupCredits > 0;
  const priceIn = (p: Plan, c: string) => (c === "BRL" ? p.price_brl : c === "EUR" ? p.price_eur ?? 0 : p.price_usd);
  // Sem preço configurado na moeda do visitante, mostramos em dólar.
  const shownCurrency = plans.some((p) => priceIn(p, currency) > 0) ? currency : "USD";
  const paidPlans = plans.filter((p) => priceIn(p, shownCurrency) > 0);
  const cardCount = paidPlans.length + (showFreePlan ? 1 : 0);
  const t = COPY[locale];
  const isPt = locale === "pt";
  const primaryHref = loggedIn ? "/dashboard" : "/signup";
  const primaryLabel = loggedIn ? t.dashboard : signupCredits > 0 ? t.ctaFree : t.cta;

  const toggleLanguage = () => {
    const next = isPt ? "en" : "pt";
    document.cookie = `NEXT_LOCALE=${next}; path=/; max-age=31536000; samesite=lax`;
    window.location.reload();
  };

  const money = (v: number) => new Intl.NumberFormat(isPt ? "pt-BR" : "en-US", { style: "currency", currency: shownCurrency, maximumFractionDigits: v % 1 ? 2 : 0 }).format(v);
  const anchors = ["como-funciona", "recursos", "precos", "duvidas"];

  return (
    <div className="min-h-screen overflow-x-hidden">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Logo />
          <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
            {t.nav.map((label, i) => <a key={label} href={`#${anchors[i]}`} className="transition hover:text-foreground">{label}</a>)}
          </nav>
          <div className="flex items-center gap-1 sm:gap-2">
            <ThemeToggle />
            <button onClick={toggleLanguage} className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Mudar idioma / Change language">
              <Globe className="h-4 w-4" /> {isPt ? "PT" : "EN"}
            </button>
            {!loggedIn && <Link href="/login" className="hidden px-2 text-sm font-medium text-muted-foreground hover:text-foreground sm:block">{t.signIn}</Link>}
            <Link href={primaryHref} className={buttonClass("primary", "sm")}>{primaryLabel}</Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative px-4 pb-16 pt-16 sm:px-6 sm:pt-24">
          <div className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[420px] w-[900px] max-w-[160vw] -translate-x-1/2 rounded-full bg-brand/15 blur-[110px]" />
          <div className="mx-auto max-w-3xl text-center">
            {/* Animação em CSS: o conteúdo já chega visível no HTML (bom para LCP/SEO, mesmo sem JS). */}
            <p className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-medium text-muted-foreground animate-in fade-in slide-in-from-bottom-2 duration-500">
              <Sparkles className="h-3.5 w-3.5 text-brand" /> {t.badge(signupCredits)}
            </p>
            <h1 className="mt-6 text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl animate-in fade-in slide-in-from-bottom-3 duration-700">
              {t.h1a}<br /><span className="text-brand">{t.h1b}</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground animate-in fade-in slide-in-from-bottom-3 duration-700 delay-100 fill-mode-backwards">
              {t.sub}
            </p>
            <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row animate-in fade-in slide-in-from-bottom-3 duration-700 delay-150 fill-mode-backwards">
              <Link href={primaryHref} className={buttonClass("brand", "lg")}>{primaryLabel} <ArrowRight className="h-4 w-4" /></Link>
              <a href="#como-funciona" className={buttonClass("outline", "lg")}>{t.how}</a>
            </div>
          </div>

          <div className="mx-auto mt-16 max-w-5xl animate-in fade-in slide-in-from-bottom-6 duration-700 delay-300 fill-mode-backwards">
            <ProductPreview isPt={isPt} />
          </div>
        </section>

        {/* Como funciona */}
        <section id="como-funciona" className="scroll-mt-20 border-t border-border bg-muted/30 px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <motion.h2 {...fade} className="max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">{t.howTitle}</motion.h2>
            <div className="mt-12 grid gap-4 md:grid-cols-3">
              {t.steps.map((s, i) => {
                const Icon = [Upload, Wand2, Check][i];
                return (
                  <motion.div key={s.t} {...fade} transition={{ ...fade.transition, delay: i * 0.08 }} className="surface p-6">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-soft text-brand"><Icon className="h-4 w-4" /></span>
                      <span className="text-sm font-medium text-muted-foreground">0{i + 1}</span>
                    </div>
                    <h3 className="mt-5 text-lg font-semibold">{s.t}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.d}</p>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Recursos */}
        <section id="recursos" className="scroll-mt-20 px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <motion.h2 {...fade} className="text-3xl font-semibold tracking-tight sm:text-4xl">{t.featTitle}</motion.h2>
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {t.feats.map((f, i) => (
                <motion.div key={f.t} {...fade} transition={{ ...fade.transition, delay: (i % 3) * 0.06 }} className="surface p-6 transition hover:border-brand/40">
                  <f.icon className="h-5 w-5 text-brand" />
                  <h3 className="mt-4 font-semibold">{f.t}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{f.d}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Preços */}
        {cardCount > 0 && (
          <section id="precos" className="scroll-mt-20 border-t border-border bg-muted/30 px-4 py-20 sm:px-6">
            <div className="mx-auto max-w-6xl">
              <motion.div {...fade} className="max-w-2xl">
                <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">{t.priceTitle}</h2>
                <p className="mt-3 text-muted-foreground">{t.priceSub(costs.image, costs.video)}</p>
              </motion.div>
              <div className={`mt-12 grid gap-4 md:grid-cols-2 ${cardCount >= 4 ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
                {showFreePlan && (
                  <motion.div {...fade} className="surface relative flex flex-col p-6">
                    <h3 className="text-lg font-semibold">{t.free.name}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{t.free.description}</p>
                    <p className="mt-5 text-4xl font-semibold tracking-tight">{money(0)}</p>
                    <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground"><Coins className="h-4 w-4" /> {signupCredits} {t.credits}</p>
                    <ul className="mt-6 flex-1 space-y-2.5 text-sm">
                      {t.free.features(signupCredits, costs.image).map((f) => <li key={f} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-brand" />{f}</li>)}
                    </ul>
                    <Link href={loggedIn ? "/dashboard" : "/signup"} className={`${buttonClass("outline", "lg")} mt-6 w-full`}>{t.free.cta}</Link>
                  </motion.div>
                )}
                {paidPlans.map((p) => {
                  const price = priceIn(p, shownCurrency);
                  const features = (isPt ? p.features_pt : p.features_en).filter((f) => f.trim());
                  return (
                    <motion.div key={p.id} {...fade} className={`surface relative flex flex-col p-6 ${p.isFeatured ? "border-brand ring-1 ring-brand" : ""}`}>
                      {p.isFeatured && <span className="absolute -top-3 left-6 rounded-full bg-brand px-3 py-1 text-xs font-semibold text-brand-foreground">{t.popular}</span>}
                      <h3 className="text-lg font-semibold">{p.name}</h3>
                      {(isPt ? p.description : p.description_en || p.description) && <p className="mt-1 text-sm text-muted-foreground">{isPt ? p.description : p.description_en || p.description}</p>}
                      <p className="mt-5 text-4xl font-semibold tracking-tight">{money(price)}</p>
                      <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground"><Coins className="h-4 w-4" /> {p.credits.toLocaleString(isPt ? "pt-BR" : "en-US")} {t.credits}</p>
                      <ul className="mt-6 flex-1 space-y-2.5 text-sm">
                        {features.map((f) => <li key={f} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-brand" />{f}</li>)}
                      </ul>
                      <Link href={loggedIn ? "/billing" : "/signup"} className={`${buttonClass(p.isFeatured ? "brand" : "primary", "lg")} mt-6 w-full`}>{t.buy}</Link>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* FAQ */}
        <section id="duvidas" className="scroll-mt-20 px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-3xl">
            <motion.h2 {...fade} className="text-3xl font-semibold tracking-tight sm:text-4xl">{t.faqTitle}</motion.h2>
            <div className="mt-10 divide-y divide-border border-y border-border">
              {t.faq.map(([q, a]) => (
                <details key={q} className="group py-5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
                    {q}
                    <span className="text-muted-foreground transition group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* CTA final */}
        <section className="px-4 pb-24 sm:px-6">
          <motion.div {...fade} className="mx-auto flex max-w-4xl flex-col items-center rounded-3xl border border-border bg-card px-6 py-14 text-center">
            <PixelMascot mood="happy" size={64} />
            <h2 className="mt-6 max-w-xl text-3xl font-semibold tracking-tight">{t.finalTitle}</h2>
            <Link href={primaryHref} className={`${buttonClass("brand", "lg")} mt-8`}>{primaryLabel} <ArrowRight className="h-4 w-4" /></Link>
          </motion.div>
        </section>
      </main>

      <footer className="border-t border-border px-4 py-10 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-sm text-muted-foreground md:flex-row">
          <Logo />
          <div className="flex gap-6">
            <Link href="/legal/terms" className="hover:text-foreground">{t.footer.terms}</Link>
            <Link href="/legal/privacy" className="hover:text-foreground">{t.footer.privacy}</Link>
            <Link href="/legal/cookies" className="hover:text-foreground">{t.footer.cookies}</Link>
            <CookieSettingsButton className="hover:text-foreground" />
            <a href={`mailto:${SUPPORT_EMAIL}`} className="hover:text-foreground">{t.footer.support}</a>
          </div>
          <p>© {new Date().getFullYear()} Vysify. {t.footer.rights}</p>
        </div>
      </footer>
    </div>
  );
}

/** Ilustração do fluxo (sem screenshots ou marcas inventadas). */
function ProductPreview({ isPt }: { isPt: boolean }) {
  const cards = [
    { ratio: "aspect-[4/5]", grad: "from-violet-500/30 via-fuchsia-400/20 to-amber-200/30", h: isPt ? "Seu café quente por 12h" : "Coffee hot for 12h", tag: "Feed 4:5" },
    { ratio: "aspect-[9/16]", grad: "from-sky-500/30 via-violet-400/20 to-emerald-200/30", h: isPt ? "Leve para qualquer trilha" : "Take it on any trail", tag: "Reels 9:16", video: true },
    { ratio: "aspect-square", grad: "from-amber-400/30 via-rose-300/20 to-violet-300/30", h: isPt ? "Oferta só até domingo" : "Sale ends Sunday", tag: "Ads 1:1" },
  ];
  return (
    <div className="relative rounded-3xl border border-border bg-card/70 p-3 shadow-2xl shadow-brand/10 backdrop-blur sm:p-4">
      <div className="absolute -top-[30px] right-10 hidden sm:block"><PixelMascot mood="working" size={40} /></div>
      <div className="grid items-center gap-4 rounded-2xl bg-muted/50 p-4 sm:grid-cols-[180px_auto_1fr] sm:p-6">
        <div className="mx-auto w-40 sm:w-full">
          <div className="flex aspect-square items-center justify-center rounded-2xl border border-dashed border-border bg-background">
            <ProductGlyph />
          </div>
          <p className="mt-2 text-center text-xs text-muted-foreground">{isPt ? "Sua foto" : "Your photo"}</p>
        </div>
        <ArrowRight className="mx-auto h-5 w-5 rotate-90 text-brand sm:rotate-0" />
        <div className="grid grid-cols-3 items-end gap-3">
          {cards.map((c) => (
            <div key={c.tag} className="overflow-hidden rounded-xl border border-border bg-background shadow-sm">
              <div className={`relative ${c.ratio} bg-gradient-to-br ${c.grad} flex items-center justify-center`}>
                <ProductGlyph small />
                {c.video && <span className="absolute bottom-2 left-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">▶ 0:05</span>}
              </div>
              <div className="p-2 sm:p-3">
                <p className="truncate text-[11px] font-semibold sm:text-xs">{c.h}</p>
                <p className="text-[10px] text-muted-foreground">{c.tag}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ProductGlyph({ small }: { small?: boolean }) {
  return (
    <svg viewBox="0 0 40 64" className={small ? "h-1/2" : "h-24"} aria-hidden="true">
      <rect x="12" y="2" width="16" height="7" rx="2" className="fill-zinc-700 dark:fill-zinc-300" />
      <rect x="8" y="8" width="24" height="54" rx="7" className="fill-zinc-800 dark:fill-zinc-200" />
      <rect x="8" y="26" width="24" height="12" className="fill-violet-500" />
      <rect x="12" y="12" width="3" height="40" rx="1.5" className="fill-white/25" />
    </svg>
  );
}
