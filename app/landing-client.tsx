"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Camera, Paintbrush, Megaphone, ArrowRight, PlayCircle, Zap, ShieldCheck, Globe, CheckCircle2, Video, Volume2, Target, BarChart3, Fingerprint } from "lucide-react";
import { motion } from "framer-motion";
import { ThemeToggle } from "@/components/theme-toggle";

export default function LandingPageClient({ plans, initialLocale }: { plans: any[], initialLocale: string }) {
  const toggleLanguage = () => {
    const newLocale = initialLocale === 'pt' ? 'en' : 'pt';
    const newCurrency = newLocale === 'pt' ? 'BRL' : 'USD';
    document.cookie = `NEXT_LOCALE=${newLocale}; path=/`;
    document.cookie = `CURRENCY=${newCurrency}; path=/`;
    window.location.reload();
  };

  const isPt = initialLocale === 'pt';

  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-zinc-950 selection:bg-violet-600 selection:text-white font-sans transition-colors duration-300">
      
      {/* Navigation */}
      <header className="fixed top-0 z-50 w-full border-b border-zinc-200/50 dark:border-zinc-800/50 bg-white/70 dark:bg-zinc-950/70 backdrop-blur-xl">
        <div className="container mx-auto flex h-20 max-w-7xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2 transition-transform hover:scale-105">
            <img src="/logo-full.png" alt="Vysify Logo" className="h-8 object-contain dark:hidden block" />
            <img src="/logo-dark.png" alt="Vysify Logo" className="h-8 object-contain hidden dark:block" />
          </Link>
          <nav className="hidden md:flex gap-10 text-sm font-semibold text-zinc-500 dark:text-zinc-400">
            <Link href="#features" className="hover:text-violet-600 dark:hover:text-violet-400 transition-colors">{isPt ? "Recursos" : "Features"}</Link>
            <Link href="#how-it-works" className="hover:text-violet-600 dark:hover:text-violet-400 transition-colors">{isPt ? "Como Funciona" : "How it Works"}</Link>
            <Link href="#pricing" className="hover:text-violet-600 dark:hover:text-violet-400 transition-colors">{isPt ? "Planos" : "Pricing"}</Link>
          </nav>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <button onClick={toggleLanguage} className="p-2 text-zinc-500 dark:text-zinc-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors flex items-center gap-2" title={isPt ? "Mudar idioma" : "Change language"}>
              <Globe className="h-5 w-5" />
              <span className="text-sm font-bold hidden sm:block">{isPt ? "PT-BR" : "EN-US"}</span>
            </button>
            <Link href="/login" className="text-sm font-bold text-zinc-700 dark:text-zinc-300 hover:text-violet-600 dark:hover:text-violet-400 transition-colors hidden sm:block">
              {isPt ? "Entrar" : "Sign In"}
            </Link>
            <Link href="/login">
              <Button className="rounded-full shadow-lg hover:shadow-violet-600/25 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-100 font-bold h-11 px-6 border-0 transition-all">
                {isPt ? "Começar Grátis" : "Start Free"}
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex flex-col items-center">
        
        {/* Hero Section */}
        <section className="relative w-full pt-40 pb-20 md:pt-48 md:pb-24 overflow-hidden flex flex-col items-center text-center px-6">
          <div className="absolute top-0 left-1/2 -z-10 -translate-x-1/2 w-[1000px] h-[500px] bg-gradient-to-b from-violet-200/50 to-transparent dark:from-violet-900/20 dark:to-transparent rounded-full blur-[100px] opacity-70" />
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center rounded-full border border-violet-200 dark:border-violet-800/50 bg-white/50 dark:bg-violet-900/10 px-4 py-1.5 text-xs font-bold text-violet-700 dark:text-violet-300 mb-8 backdrop-blur-sm"
          >
            <Zap className="h-3.5 w-3.5 mr-2 text-violet-600 dark:text-violet-400" />
            {isPt ? "Agora com Wan 2.1 e ElevenLabs Voice" : "Powered by Wan 2.1 & ElevenLabs Voice"}
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-5xl md:text-7xl font-black tracking-tighter text-zinc-900 dark:text-white max-w-5xl leading-[1.1]"
          >
            {isPt ? "Não crie anúncios." : "Don't create ads."} <br className="hidden md:block" /> 
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-600 via-violet-600 to-purple-600 dark:from-blue-400 dark:via-violet-400 dark:to-purple-400">
              {isPt ? "Gere máquinas de conversão." : "Generate conversion machines."}
            </span>
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mt-8 text-lg md:text-xl text-zinc-500 dark:text-zinc-400 max-w-2xl font-medium leading-relaxed"
          >
            {isPt ? "Da sua foto crua de produto até um vídeo cinematográfico com locução ultra-realista e roteiro persuasivo. Tudo em 60 segundos." : "From a raw product photo to a cinematic video with ultra-realistic voiceovers and persuasive scripts. All in 60 seconds."}
          </motion.p>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-12 flex flex-col sm:flex-row gap-4 w-full justify-center max-w-md"
          >
            <Link href="/login" className="w-full sm:w-auto">
              <Button size="lg" className="w-full sm:w-auto h-14 px-8 text-base font-bold rounded-full shadow-xl shadow-violet-600/20 bg-violet-600 hover:bg-violet-700 text-white transition-all border-0 group">
                {isPt ? "Testar Gratuitamente" : "Start Free Trial"}
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <Link href="#demo" className="w-full sm:w-auto">
              <Button size="lg" variant="outline" className="w-full sm:w-auto h-14 px-8 text-base font-bold rounded-full border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-white bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800">
                <PlayCircle className="mr-2 h-5 w-5 text-zinc-400 dark:text-zinc-500" /> {isPt ? "Ver como funciona" : "See how it works"}
              </Button>
            </Link>
          </motion.div>
        </section>

        {/* Dashboard Preview / Mockup */}
        <motion.section 
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="w-full max-w-6xl px-6 mb-20 z-10"
          id="demo"
        >
          <div className="rounded-[2.5rem] border border-zinc-200/60 dark:border-zinc-800/60 bg-white/40 dark:bg-zinc-900/40 p-3 shadow-2xl shadow-violet-900/5 backdrop-blur-xl">
            <div className="rounded-[2rem] border border-zinc-100 dark:border-zinc-800 bg-zinc-950 aspect-[16/9] w-full flex flex-col items-center justify-center relative overflow-hidden group cursor-pointer">
              
              <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop')] bg-cover bg-center opacity-40 mix-blend-overlay transition-transform duration-1000 group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/80 to-transparent opacity-80" />
              
              <div className="z-10 text-center transition-transform duration-500 group-hover:scale-110">
                <div className="h-20 w-20 bg-white/10 backdrop-blur-md border border-white/20 rounded-full flex items-center justify-center mx-auto shadow-2xl shadow-violet-500/20 mb-6">
                  <PlayCircle className="h-10 w-10 text-white ml-1" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">{isPt ? "O fim do trabalho manual" : "The end of manual work"}</h3>
                <p className="text-zinc-400 font-medium">{isPt ? "Assista ao Vysify gerando uma campanha" : "Watch Vysify generating a campaign"}</p>
              </div>
            </div>
          </div>
        </motion.section>

        {/* Trusted By */}
        <section className="w-full border-y border-zinc-100 dark:border-zinc-900 bg-white dark:bg-zinc-950/50 py-10 flex flex-col items-center overflow-hidden">
          <p className="text-sm font-semibold text-zinc-400 dark:text-zinc-600 mb-8 uppercase tracking-widest">{isPt ? "Confiado pelas marcas mais inovadoras" : "Trusted by innovative brands"}</p>
          <div className="flex gap-12 md:gap-24 items-center justify-center opacity-50 grayscale hover:grayscale-0 transition-all duration-500 flex-wrap px-6">
            <span className="text-xl md:text-2xl font-black text-zinc-800 dark:text-zinc-200">ACME Corp</span>
            <span className="text-xl md:text-2xl font-black text-zinc-800 dark:text-zinc-200 tracking-tighter">GlobalDrop</span>
            <span className="text-xl md:text-2xl font-black text-zinc-800 dark:text-zinc-200">StellarAds</span>
            <span className="text-xl md:text-2xl font-black text-zinc-800 dark:text-zinc-200 uppercase">Nexus</span>
            <span className="text-xl md:text-2xl font-black text-zinc-800 dark:text-zinc-200 italic">Lumina</span>
          </div>
        </section>

        {/* How it Works (Pipeline) */}
        <section id="how-it-works" className="w-full max-w-7xl px-6 py-24 md:py-32">
          <div className="mb-16 md:text-center max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-5xl font-black tracking-tight text-zinc-900 dark:text-white mb-6">
              {isPt ? "Magia, explicada." : "Magic, explained."}
            </h2>
            <p className="text-lg md:text-xl text-zinc-500 dark:text-zinc-400 font-medium">
              {isPt ? "Nosso pipeline integra as 3 IAs mais avançadas do mundo em um único fluxo invisível e perfeito." : "Our pipeline integrates the 3 most advanced AIs in the world into a single, invisible, and perfect flow."}
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 relative">
            <div className="hidden md:block absolute top-1/2 left-0 w-full h-0.5 bg-zinc-100 dark:bg-zinc-800 -z-10 -translate-y-1/2" />
            
            <div className="bg-white dark:bg-zinc-900 p-8 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm relative group hover:-translate-y-2 transition-transform duration-300">
              <div className="h-12 w-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center font-black text-xl mb-6 text-zinc-900 dark:text-white border-4 border-white dark:border-zinc-950">1</div>
              <h3 className="text-xl font-bold mb-3">{isPt ? "Estratégia & Copy" : "Strategy & Copy"}</h3>
              <p className="text-zinc-500 dark:text-zinc-400 text-sm leading-relaxed">
                {isPt ? "O modelo Gemini analisa seu produto, entende seu público e escreve roteiros de vendas usando gatilhos mentais comprovados." : "The Gemini model analyzes your product, understands your audience, and writes sales scripts using proven mental triggers."}
              </p>
            </div>

            <div className="bg-white dark:bg-zinc-900 p-8 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm relative group hover:-translate-y-2 transition-transform duration-300">
              <div className="h-12 w-12 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center font-black text-xl mb-6 text-violet-600 dark:text-violet-400 border-4 border-white dark:border-zinc-950">2</div>
              <h3 className="text-xl font-bold mb-3">{isPt ? "Locução Sincronizada" : "Synced Voiceover"}</h3>
              <p className="text-zinc-500 dark:text-zinc-400 text-sm leading-relaxed">
                {isPt ? "A ElevenLabs assume e transforma o roteiro em uma narração ultra-realista que prende a atenção e transmite confiança (Text-to-Speech)." : "ElevenLabs takes over and transforms the script into an ultra-realistic voiceover that grabs attention and conveys trust (Text-to-Speech)."}
              </p>
            </div>

            <div className="bg-white dark:bg-zinc-900 p-8 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm relative group hover:-translate-y-2 transition-transform duration-300">
              <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center font-black text-xl mb-6 text-blue-600 dark:text-blue-400 border-4 border-white dark:border-zinc-950">3</div>
              <h3 className="text-xl font-bold mb-3">{isPt ? "Geração Visual (Wan 2.1)" : "Visual Generation"}</h3>
              <p className="text-zinc-500 dark:text-zinc-400 text-sm leading-relaxed">
                {isPt ? "O estado-da-arte em Image-to-Video funde o áudio com animações de tirar o fôlego do seu produto, renderizando a campanha final." : "State-of-the-art Image-to-Video merges the audio with breathtaking animations of your product, rendering the final campaign."}
              </p>
            </div>
          </div>
        </section>

        {/* Feature Bento Grid */}
        <section id="features" className="w-full bg-zinc-50 dark:bg-zinc-900/20 py-24 border-y border-zinc-100 dark:border-zinc-900">
          <div className="max-w-7xl mx-auto px-6">
            <div className="mb-16 md:text-center max-w-3xl mx-auto">
              <h2 className="text-3xl md:text-5xl font-black tracking-tight text-zinc-900 dark:text-white mb-6">
                {isPt ? "Tudo que uma agência faz." : "Everything an agency does."} <br className="hidden md:block"/> {isPt ? "Em uma tela." : "On one screen."}
              </h2>
            </div>

            <div className="grid md:grid-cols-4 gap-4">
              <div className="md:col-span-2 bg-white dark:bg-zinc-900 rounded-3xl p-8 border border-zinc-200 dark:border-zinc-800 hover:border-violet-300 dark:hover:border-violet-700 transition-colors overflow-hidden relative">
                <Video className="h-8 w-8 text-violet-500 mb-6" />
                <h3 className="text-2xl font-bold mb-3">{isPt ? "Vídeos de Alta Retenção" : "High Retention Videos"}</h3>
                <p className="text-zinc-500 dark:text-zinc-400 mb-8">{isPt ? "Gere materiais dinâmicos focados no primeiro segundo (Hook), retendo a audiência nos Reels e TikTok." : "Generate dynamic materials focused on the first second (Hook), retaining audiences on Reels and TikTok."}</p>
              </div>
              
              <div className="md:col-span-2 bg-white dark:bg-zinc-900 rounded-3xl p-8 border border-zinc-200 dark:border-zinc-800 hover:border-blue-300 dark:hover:border-blue-700 transition-colors">
                <Volume2 className="h-8 w-8 text-blue-500 mb-6" />
                <h3 className="text-2xl font-bold mb-3">{isPt ? "Áudio Profissional" : "Professional Audio"}</h3>
                <p className="text-zinc-500 dark:text-zinc-400">{isPt ? "Integração direta com os melhores modelos de TTS do mercado. Vozes reais, entonação perfeita." : "Direct integration with the best TTS models on the market. Real voices, perfect intonation."}</p>
              </div>

              <div className="md:col-span-1 bg-white dark:bg-zinc-900 rounded-3xl p-8 border border-zinc-200 dark:border-zinc-800">
                <Target className="h-8 w-8 text-emerald-500 mb-6" />
                <h3 className="text-xl font-bold mb-3">{isPt ? "Direto ao Alvo" : "Right on Target"}</h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">{isPt ? "Estratégias customizadas por objetivo (Vendas, Brand Awareness)." : "Custom strategies by objective (Sales, Awareness)."}</p>
              </div>

              <div className="md:col-span-2 bg-zinc-900 dark:bg-zinc-950 rounded-3xl p-8 border border-zinc-800 text-white relative overflow-hidden">
                <div className="absolute right-0 bottom-0 w-32 h-32 bg-violet-600 rounded-full blur-3xl opacity-30" />
                <BarChart3 className="h-8 w-8 text-violet-400 mb-6" />
                <h3 className="text-2xl font-bold mb-3">{isPt ? "Testes A/B Ilimitados" : "Unlimited A/B Testing"}</h3>
                <p className="text-zinc-400">{isPt ? "Gere dezenas de variações do mesmo produto para testar no Meta Ads e descobrir o criativo campeão." : "Generate dozens of variations to test on Meta Ads and find the winning creative."}</p>
              </div>

              <div className="md:col-span-1 bg-white dark:bg-zinc-900 rounded-3xl p-8 border border-zinc-200 dark:border-zinc-800">
                <Fingerprint className="h-8 w-8 text-amber-500 mb-6" />
                <h3 className="text-xl font-bold mb-3">{isPt ? "Segurança Legal" : "Legal Security"}</h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">{isPt ? "Filtros de conteúdo e proteção de direitos (AI Guardrails)." : "Content filters and rights protection (AI Guardrails)."}</p>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="w-full max-w-7xl px-6 py-24 md:py-32">
          <div className="mb-16 md:text-center max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-5xl font-black tracking-tight text-zinc-900 dark:text-white mb-6">
              {isPt ? "Invista no seu crescimento." : "Invest in your growth."}
            </h2>
            <p className="text-lg text-zinc-500 dark:text-zinc-400 font-medium">
              {isPt ? "Pague apenas pelos créditos que usar ou assine para escalar infinito." : "Pay only for the credits you use or subscribe to scale infinitely."}
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {plans.map((plan: any, i: number) => (
              <div key={plan.id} className={`bg-white dark:bg-zinc-900 rounded-3xl p-8 border ${plan.isFeatured ? 'border-violet-500 dark:border-violet-500 ring-4 ring-violet-500/10' : 'border-zinc-200 dark:border-zinc-800'} relative flex flex-col`}>
                {plan.isFeatured && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-violet-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                    {isPt ? "MAIS POPULAR" : "MOST POPULAR"}
                  </div>
                )}
                <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                <div className="mb-6">
                  <span className="text-4xl font-black">{isPt ? `R$${plan.price_brl}` : `$${plan.price_usd}`}</span>
                  <span className="text-zinc-500 dark:text-zinc-400">/mês</span>
                </div>
                <ul className="space-y-4 mb-8 flex-1">
                  <li className="flex items-center gap-3 text-sm font-medium">
                    <CheckCircle2 className="h-5 w-5 text-violet-500" />
                    {plan.credits} {isPt ? "Créditos IA" : "AI Credits"}
                  </li>
                  <li className="flex items-center gap-3 text-sm font-medium">
                    <CheckCircle2 className="h-5 w-5 text-violet-500" />
                    {isPt ? "Vídeos Wan 2.1 e Imagens" : "Wan 2.1 Videos & Images"}
                  </li>
                  <li className="flex items-center gap-3 text-sm font-medium">
                    <CheckCircle2 className="h-5 w-5 text-violet-500" />
                    {isPt ? "Locução ElevenLabs" : "ElevenLabs Voiceover"}
                  </li>
                  <li className="flex items-center gap-3 text-sm font-medium">
                    <CheckCircle2 className="h-5 w-5 text-violet-500" />
                    {isPt ? "Suporte Prioritário" : "Priority Support"}
                  </li>
                </ul>
                <Link href="/login" className="w-full">
                  <Button className={`w-full rounded-xl h-12 font-bold ${plan.isFeatured ? 'bg-violet-600 hover:bg-violet-700 text-white' : 'bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white'}`}>
                    {isPt ? "Assinar Agora" : "Subscribe Now"}
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="w-full bg-white dark:bg-zinc-950 border-t border-zinc-200 dark:border-zinc-800 py-12 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <img src="/logo-icon.png" alt="Vysify Logo" className="h-8 opacity-80" />
            <span className="font-bold text-lg">Vysify</span>
          </div>
          <div className="flex gap-6 text-sm font-medium text-zinc-500 dark:text-zinc-400">
            <Link href="/legal/terms" className="hover:text-violet-600 transition-colors">Termos de Uso</Link>
            <Link href="/legal/privacy" className="hover:text-violet-600 transition-colors">Privacidade (LGPD)</Link>
            <a href="mailto:contato@vysify.com" className="hover:text-violet-600 transition-colors">Suporte</a>
          </div>
          <p className="text-zinc-400 text-sm">© {new Date().getFullYear()} Vysify AI. Todos os direitos reservados.</p>
        </div>
      </footer>

    </div>
  );
}
