"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Camera, Paintbrush, Megaphone, ArrowRight, PlayCircle, Zap, ShieldCheck, Globe, CheckCircle2 } from "lucide-react";
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
      <header className="fixed top-0 z-50 w-full border-b border-zinc-200/50 dark:border-zinc-800/50 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl">
        <div className="container mx-auto flex h-20 max-w-7xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2 transition-transform hover:scale-105">
            <img src="/logo-full.png" alt="Vysify Logo" className="h-8 object-contain dark:hidden block" />
            <img src="/logo-dark.png" alt="Vysify Logo" className="h-8 object-contain hidden dark:block" />
          </Link>
          <nav className="hidden md:flex gap-10 text-sm font-semibold text-zinc-500 dark:text-zinc-400">
            <Link href="#features" className="hover:text-violet-600 dark:hover:text-violet-400 transition-colors">{isPt ? "Recursos" : "Features"}</Link>
            <Link href="#pricing" className="hover:text-violet-600 dark:hover:text-violet-400 transition-colors">{isPt ? "Preços" : "Pricing"}</Link>
          </nav>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <button onClick={toggleLanguage} className="p-2 text-zinc-500 dark:text-zinc-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors flex items-center gap-2" title={isPt ? "Mudar para Inglês" : "Change to Portuguese"}>
              <Globe className="h-5 w-5" />
              <span className="text-sm font-bold hidden sm:block">{isPt ? "PT-BR" : "EN-US"}</span>
            </button>
            <Link href="/api/auth/signin" className="text-sm font-bold text-zinc-700 dark:text-zinc-300 hover:text-violet-600 dark:hover:text-violet-400 transition-colors hidden sm:block">
              {isPt ? "Entrar" : "Sign In"}
            </Link>
            <Link href="/api/auth/signin">
              <Button className="rounded-full shadow-lg hover:shadow-xl shadow-violet-600/20 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white font-bold h-11 px-6 border-0 transition-all">
                {isPt ? "Começar Grátis" : "Start Free"}
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex flex-col items-center">
        
        {/* Hero Section */}
        <section className="relative w-full pt-40 pb-20 md:pt-48 md:pb-32 overflow-hidden flex flex-col items-center text-center px-6">
          <div className="absolute top-0 left-1/2 -z-10 -translate-x-1/2 w-[1000px] h-[500px] bg-gradient-to-r from-blue-400/30 to-violet-500/30 dark:from-blue-600/20 dark:to-violet-800/20 rounded-full blur-[120px] opacity-60" />
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center rounded-full border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-900/30 px-4 py-1.5 text-xs font-bold text-violet-700 dark:text-violet-300 mb-8 shadow-sm"
          >
            <Zap className="h-3.5 w-3.5 mr-2 text-violet-600 dark:text-violet-400" />
            {isPt ? "A revolução dos criativos chegou" : "The revolution of creatives has arrived"}
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-5xl md:text-7xl font-black tracking-tighter text-zinc-900 dark:text-white max-w-5xl leading-[1.1]"
          >
            {isPt ? "Sua foto crua vira" : "Your raw photo becomes"} <br className="hidden md:block" /> 
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-600 via-violet-600 to-purple-600 dark:from-blue-400 dark:via-violet-400 dark:to-purple-400">
              {isPt ? "o anúncio que mais vende." : "the ad that sells the most."}
            </span>
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mt-8 text-lg md:text-xl text-zinc-500 dark:text-zinc-400 max-w-2xl font-medium leading-relaxed"
          >
            {isPt ? "Nossa Inteligência Artificial cria cenários premium, recorta seu produto perfeitamente e escreve os textos persuasivos (Copy) em menos de um minuto." : "Our Artificial Intelligence creates premium scenarios, crops your product perfectly, and writes persuasive ad copies in under a minute."}
          </motion.p>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-12 flex flex-col sm:flex-row gap-4 w-full justify-center max-w-md"
          >
            <Link href="/dashboard" className="w-full sm:w-auto">
              <Button size="lg" className="w-full sm:w-auto h-14 px-8 text-base font-bold rounded-full shadow-xl shadow-violet-600/20 bg-gradient-to-r from-blue-600 to-violet-600 hover:scale-105 transition-all border-0 text-white group">
                {isPt ? "Gerar minha 1ª Campanha" : "Generate my 1st Campaign"}
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <Link href="#demo" className="w-full sm:w-auto">
              <Button size="lg" variant="outline" className="w-full sm:w-auto h-14 px-8 text-base font-bold rounded-full border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-white bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800">
                <PlayCircle className="mr-2 h-5 w-5 text-zinc-400 dark:text-zinc-500" /> {isPt ? "Ver na prática" : "See in action"}
              </Button>
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mt-8 flex items-center justify-center gap-6 text-sm font-semibold text-zinc-400 dark:text-zinc-500"
          >
            <span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-500"/> {isPt ? "Sem cartão para testar" : "No credit card required"}</span>
            <span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-500"/> {isPt ? "Cancele quando quiser" : "Cancel anytime"}</span>
          </motion.div>
        </section>

        {/* Dashboard Preview / Mockup */}
        <motion.section 
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="w-full max-w-6xl px-6 mb-32 z-10"
        >
          <div className="rounded-3xl border border-zinc-200/60 dark:border-zinc-800/60 bg-white/50 dark:bg-zinc-900/50 p-2 md:p-4 shadow-2xl backdrop-blur-md">
            <div className="rounded-2xl border border-zinc-100 dark:border-zinc-800 bg-zinc-900 aspect-[16/9] w-full flex items-center justify-center relative overflow-hidden group cursor-pointer">
              <div className="absolute inset-0 bg-gradient-to-br from-violet-900/40 to-black opacity-80 transition-opacity group-hover:opacity-60" />
              <img src="/logo-icon.png" alt="Vysify" className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 opacity-10 blur-xl mix-blend-overlay" />
              <div className="z-10 text-center transition-transform group-hover:scale-110">
                <div className="h-20 w-20 bg-white rounded-full flex items-center justify-center mx-auto shadow-2xl shadow-violet-500/50 mb-4">
                  <PlayCircle className="h-10 w-10 text-violet-600 ml-1" />
                </div>
                <p className="text-white font-semibold tracking-wide">{isPt ? "ASSISTIR DEMONSTRAÇÃO" : "WATCH DEMO"}</p>
              </div>
            </div>
          </div>
        </motion.section>

        {/* Feature Bento Grid */}
        <section id="features" className="w-full max-w-7xl px-6 py-24">
          <div className="mb-16 md:text-center max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-5xl font-black tracking-tight text-zinc-900 dark:text-white mb-6">
              {isPt ? "O ecossistema perfeito" : "The perfect ecosystem"} <br className="hidden md:block"/> {isPt ? "para escalar seu tráfego." : "to scale your traffic."}
            </h2>
            <p className="text-lg md:text-xl text-zinc-500 dark:text-zinc-400 font-medium">
              {isPt ? "Não pague dezenas de reais por criativos estáticos. Com o Vysify você tem uma agência inteira na sua tela." : "Don't pay dozens of dollars for static creatives. With Vysify you have a full agency on your screen."}
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="md:col-span-2 bg-white dark:bg-zinc-900 rounded-3xl p-8 md:p-12 border border-zinc-200 dark:border-zinc-800 shadow-xl shadow-zinc-100 dark:shadow-none relative overflow-hidden group hover:border-violet-300 dark:hover:border-violet-700 transition-colors">
              <div className="absolute right-0 top-0 w-64 h-64 bg-violet-100 dark:bg-violet-900/30 rounded-full blur-3xl opacity-50 -mr-10 -mt-10 group-hover:bg-violet-200 dark:group-hover:bg-violet-800/40 transition-colors" />
              <div className="relative z-10 max-w-md">
                <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-lg shadow-violet-500/30 mb-8">
                  <Paintbrush className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-3xl font-bold text-zinc-900 dark:text-white mb-4 tracking-tight">{isPt ? "Estúdios Fotográficos Virtuais" : "Virtual Photo Studios"}</h3>
                <p className="text-zinc-500 dark:text-zinc-400 text-lg leading-relaxed font-medium">
                  {isPt ? "Chega de fundo branco. Extraímos seu produto e aplicamos iluminação 3D, sombras realistas e cenários hiper-contextuais com a nossa AI visual de ponta." : "No more white backgrounds. We extract your product and apply 3D lighting, realistic shadows, and hyper-contextual scenarios with our state-of-the-art visual AI."}
                </p>
              </div>
            </div>
            
            <div className="bg-zinc-900 dark:bg-zinc-950/50 rounded-3xl p-8 md:p-12 text-white border border-zinc-800 dark:border-zinc-800 relative overflow-hidden group hover:border-zinc-700 transition-colors">
              <div className="absolute left-0 bottom-0 w-48 h-48 bg-blue-900/50 rounded-full blur-3xl opacity-30 -ml-10 -mb-10 group-hover:bg-violet-800/50 transition-colors" />
              <div className="relative z-10">
                <div className="h-14 w-14 rounded-2xl bg-zinc-800 border border-zinc-700 flex items-center justify-center shadow-lg mb-8">
                  <Megaphone className="h-6 w-6 text-blue-400" />
                </div>
                <h3 className="text-2xl font-bold mb-4 tracking-tight">{isPt ? "Copy de Alta Conversão" : "High-Converting Copy"}</h3>
                <p className="text-zinc-400 leading-relaxed text-base">
                  {isPt ? "A IA não escreve só textos bonitos. Ela analisa o visual do seu produto e gera gatilhos mentais provados para Facebook e Instagram." : "The AI doesn't just write pretty text. It analyzes the visuals of your product and generates proven mental triggers for Facebook and Instagram."}
                </p>
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 rounded-3xl p-8 md:p-12 border border-zinc-200 dark:border-zinc-800 shadow-xl shadow-zinc-100 dark:shadow-none relative overflow-hidden group hover:border-violet-300 dark:hover:border-violet-700 transition-colors">
              <div className="absolute right-0 top-0 w-32 h-32 bg-emerald-100 dark:bg-emerald-900/20 rounded-full blur-3xl opacity-50 group-hover:bg-emerald-200 dark:group-hover:bg-emerald-800/30 transition-colors" />
              <div className="relative z-10">
                <div className="h-14 w-14 rounded-2xl bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/30 mb-8">
                  <Zap className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-zinc-900 dark:text-white mb-4 tracking-tight">{isPt ? "Testes A/B em Segundos" : "A/B Testing in Seconds"}</h3>
                <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed text-base">
                  {isPt ? "Gere 5, 10 ou 20 variações de uma mesma campanha com um clique. Encontre o ângulo que escala suas vendas." : "Generate 5, 10 or 20 variations of the same campaign with one click. Find the angle that scales your sales."}
                </p>
              </div>
            </div>

            <div className="md:col-span-2 bg-gradient-to-br from-zinc-900 to-zinc-950 dark:from-zinc-950 dark:to-black rounded-3xl p-8 md:p-12 text-white border border-zinc-800 relative overflow-hidden group hover:border-zinc-700 transition-colors">
              <div className="absolute right-0 bottom-0 w-64 h-64 bg-violet-900 rounded-full blur-[80px] opacity-20 group-hover:opacity-40 transition-opacity" />
              <div className="relative z-10 max-w-md">
                <div className="h-14 w-14 rounded-2xl bg-zinc-800 border border-zinc-700 flex items-center justify-center shadow-lg mb-8">
                  <Camera className="h-6 w-6 text-violet-400" />
                </div>
                <h3 className="text-3xl font-bold mb-4 tracking-tight">{isPt ? "Formatos Prontos (OVI Tech)" : "Ready Formats (OVI Tech)"}</h3>
                <p className="text-zinc-400 text-lg leading-relaxed">
                  {isPt ? "Seja para Feed Quadrado (1:1), Stories verticais (9:16) ou Banners (16:9), a IA redimensiona e expande a arte perfeitamente sem perder qualidade." : "Whether for Square Feed (1:1), vertical Stories (9:16) or Banners (16:9), the AI resizes and expands the art perfectly without losing quality."}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Testimonials Section */}
        <section className="w-full max-w-7xl px-6 py-24 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/20">
          <div className="mb-16 md:text-center max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-5xl font-black tracking-tight text-zinc-900 dark:text-white mb-6">
              {isPt ? "Quem usa, escala." : "Those who use it, scale it."}
            </h2>
            <p className="text-lg md:text-xl text-zinc-500 dark:text-zinc-400 font-medium">
              {isPt ? "Marcas que multiplicaram seu ROAS após implementar o Vysify." : "Brands that multiplied their ROAS after implementing Vysify."}
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white dark:bg-zinc-900 p-8 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm relative">
              <div className="absolute -top-4 -left-4 text-6xl text-violet-200 dark:text-violet-900/50 font-serif">"</div>
              <p className="text-zinc-600 dark:text-zinc-300 font-medium italic relative z-10 mb-6">
                {isPt ? "Antes eu gastava R$2000 por mês com designers que demoravam dias. Agora eu crio os anúncios da minha loja em 5 minutos pelo celular e o CPA caiu pela metade." : "I used to spend $500/mo on designers who took days. Now I create my store's ads in 5 minutes and my CPA dropped in half."}
              </p>
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                  <img src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=200&auto=format&fit=crop" alt="User" />
                </div>
                <div>
                  <h4 className="font-bold text-zinc-900 dark:text-white">Ricardo M.</h4>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">{isPt ? "Dono de E-commerce" : "E-commerce Owner"}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white dark:bg-zinc-900 p-8 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm relative">
              <div className="absolute -top-4 -left-4 text-6xl text-blue-200 dark:text-blue-900/50 font-serif">"</div>
              <p className="text-zinc-600 dark:text-zinc-300 font-medium italic relative z-10 mb-6">
                {isPt ? "A copy gerada pela inteligência artificial do Vysify bateu nossos melhores copywriters humanos no teste A/B. A ferramenta se pagou no primeiro dia de uso." : "The copy generated by Vysify's AI beat our best human copywriters in A/B testing. The tool paid for itself on day one."}
              </p>
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                  <img src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=200&auto=format&fit=crop" alt="User" />
                </div>
                <div>
                  <h4 className="font-bold text-zinc-900 dark:text-white">Amanda F.</h4>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">{isPt ? "Gestora de Tráfego" : "Traffic Manager"}</p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 p-8 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm relative">
              <div className="absolute -top-4 -left-4 text-6xl text-emerald-200 dark:text-emerald-900/50 font-serif">"</div>
              <p className="text-zinc-600 dark:text-zinc-300 font-medium italic relative z-10 mb-6">
                {isPt ? "Minha agência conseguiu absorver o triplo de clientes sem precisar contratar mais diretores de arte. O Vysify mudou totalmente o nosso fluxo de trabalho." : "My agency absorbed triple the clients without hiring more art directors. Vysify completely changed our workflow."}
              </p>
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                  <img src="https://images.unsplash.com/photo-1560250097-0b93528c311a?q=80&w=200&auto=format&fit=crop" alt="User" />
                </div>
                <div>
                  <h4 className="font-bold text-zinc-900 dark:text-white">Carlos P.</h4>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">{isPt ? "CEO, Agência Digital" : "CEO, Digital Agency"}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="w-full max-w-7xl px-6 py-24 border-t border-zinc-200 dark:border-zinc-800">
          <div className="mb-16 md:text-center max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-5xl font-black tracking-tight text-zinc-900 dark:text-white mb-6">
              {isPt ? "Planos que cabem no seu bolso." : "Plans that fit your budget."}
            </h2>
            <p className="text-lg text-zinc-500 dark:text-zinc-400 font-medium">
              {isPt ? "Escolha o pacote ideal para decolar as suas vendas." : "Choose the perfect package to skyrocket your sales."}
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 justify-center">
            {plans && plans.length > 0 ? plans.map(plan => (
              <div key={plan.id} className={`p-8 rounded-3xl border transition-all ${plan.isFeatured ? 'border-violet-600 shadow-2xl shadow-violet-600/10 scale-105 relative bg-white dark:bg-zinc-900' : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 hover:border-zinc-300 dark:hover:border-zinc-700'}`}>
                {plan.isFeatured && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gradient-to-r from-blue-600 to-violet-600 text-white px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider">
                    {isPt ? "Mais Popular" : "Most Popular"}
                  </div>
                )}
                <h3 className="text-2xl font-bold text-zinc-900 dark:text-white">{plan.name}</h3>
                <div className="mt-6 flex items-baseline gap-2">
                  <span className="text-5xl font-black text-zinc-900 dark:text-white tracking-tighter">
                    {isPt ? `R$${plan.price_brl}` : `$${plan.price_usd}`}
                  </span>
                  <span className="text-zinc-500 dark:text-zinc-400 font-medium">{isPt ? "/mês" : "/mo"}</span>
                </div>
                
                <div className="mt-8 space-y-4">
                  {(isPt ? plan.features_pt : plan.features_en)?.length > 0 ? (
                    (isPt ? plan.features_pt : plan.features_en).map((feature, idx) => (
                      feature.trim() !== "" && (
                        <div key={idx} className="flex items-center gap-3">
                          <CheckCircle2 className={`h-5 w-5 ${plan.isFeatured ? 'text-violet-600' : 'text-zinc-500'}`} />
                          <span className="text-zinc-600 dark:text-zinc-300 font-medium">{feature}</span>
                        </div>
                      )
                    ))
                  ) : (
                    <>
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className={`h-5 w-5 ${plan.isFeatured ? 'text-violet-600' : 'text-zinc-500'}`} />
                        <span className="text-zinc-600 dark:text-zinc-300 font-medium">{plan.credits} {isPt ? "Créditos inclusos" : "Credits included"}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className={`h-5 w-5 ${plan.isFeatured ? 'text-violet-600' : 'text-zinc-500'}`} />
                        <span className="text-zinc-600 dark:text-zinc-300 font-medium">{isPt ? "Geração de Copy IA" : "AI Copy Generation"}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className={`h-5 w-5 ${plan.isFeatured ? 'text-violet-600' : 'text-zinc-500'}`} />
                        <span className="text-zinc-600 dark:text-zinc-300 font-medium">{isPt ? "Geração de Imagens HD" : "HD Image Generation"}</span>
                      </div>
                    </>
                  )}
                </div>

                <Link href="/api/auth/signin">
                  <Button className={`w-full mt-10 rounded-full h-14 font-bold text-base transition-all ${plan.isFeatured ? 'bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white shadow-lg' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white hover:bg-zinc-200 dark:hover:bg-zinc-700'}`}>
                    {isPt ? "Assinar" : "Subscribe to"} {plan.name}
                  </Button>
                </Link>
              </div>
            )) : (
              <div className="col-span-3 text-center py-12">
                <p className="text-zinc-500 dark:text-zinc-400 text-lg">
                  {isPt ? "Nenhum plano configurado no momento." : "No plans configured at the moment."}
                </p>
              </div>
            )}
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="w-full border-t border-zinc-200 dark:border-zinc-800 py-16 px-6 bg-white dark:bg-zinc-950">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <img src="/logo-icon.png" alt="Vysify Icon" className="h-6 object-contain dark:hidden block" />
            <img src="/logo-icon-dark.png" alt="Vysify Icon" className="h-6 object-contain hidden dark:block" />
            <span className="font-extrabold text-xl tracking-tight text-zinc-900 dark:text-white">Vysify</span>
          </div>
          <nav className="flex gap-8 text-sm font-semibold text-zinc-500 dark:text-zinc-400">
            <Link href="#" className="hover:text-violet-600 dark:hover:text-violet-400 transition-colors">{isPt ? "Termos" : "Terms"}</Link>
            <Link href="#" className="hover:text-violet-600 dark:hover:text-violet-400 transition-colors">{isPt ? "Privacidade" : "Privacy"}</Link>
            <Link href="#" className="hover:text-violet-600 dark:hover:text-violet-400 transition-colors">{isPt ? "Contato" : "Contact"}</Link>
          </nav>
          <p className="text-sm font-medium text-zinc-400 dark:text-zinc-500">
            © {new Date().getFullYear()} Vysify AI. {isPt ? "CNPJ Fake 00.000/0001-00." : "All rights reserved."}
          </p>
        </div>
      </footer>
    </div>
  );
}
