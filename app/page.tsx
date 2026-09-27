"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Camera, Sparkles, Paintbrush, Megaphone, ArrowRight, CheckCircle2, PlayCircle } from "lucide-react";
import { motion } from "framer-motion";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white selection:bg-zinc-900 selection:text-white">
      
      {/* Navigation */}
      <header className="sticky top-0 z-50 w-full border-b border-zinc-100 bg-white/80 backdrop-blur-md">
        <div className="container mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-zinc-900 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight text-zinc-900">Vysify</span>
          </div>
          <nav className="hidden md:flex gap-8 text-sm font-medium text-zinc-500">
            <Link href="#features" className="hover:text-zinc-900 transition-colors">Como Funciona</Link>
            <Link href="#pricing" className="hover:text-zinc-900 transition-colors">Preços</Link>
            <Link href="#faq" className="hover:text-zinc-900 transition-colors">FAQ</Link>
          </nav>
          <div className="flex items-center gap-4">
            <Link href="/api/auth/signin" className="text-sm font-medium text-zinc-600 hover:text-zinc-900 transition-colors hidden sm:block">
              Entrar
            </Link>
            <Link href="/api/auth/signin">
              <Button className="rounded-full shadow-sm">Começar Grátis</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex flex-col items-center">
        
        {/* Hero Section */}
        <section className="relative w-full pt-32 pb-20 md:pt-40 md:pb-32 overflow-hidden flex flex-col items-center text-center px-6">
          {/* Subtle Background Glow */}
          <div className="absolute top-0 left-1/2 -z-10 -translate-x-1/2 w-[800px] h-[400px] bg-zinc-100/60 rounded-full blur-3xl opacity-50" />
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-600 mb-8 shadow-sm"
          >
            <Sparkles className="h-3 w-3 mr-2 text-zinc-900" />
            O futuro da criação de anúncios chegou
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-5xl md:text-7xl font-extrabold tracking-tighter text-zinc-900 max-w-4xl"
          >
            Uma foto do seu produto. <br className="hidden md:block" /> 
            <span className="text-zinc-400">Uma campanha inteira.</span>
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mt-6 text-lg md:text-xl text-zinc-500 max-w-2xl font-medium"
          >
            Nossa inteligência artificial cria cenários, escreve textos persuasivos e gera vídeos curtos para as suas redes sociais em segundos. Sem precisar de agências.
          </motion.p>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-10 flex flex-col sm:flex-row gap-4 w-full justify-center max-w-md"
          >
            <Link href="/dashboard" className="w-full sm:w-auto">
              <Button size="lg" className="w-full sm:w-auto h-12 px-8 text-base rounded-full shadow-lg hover:shadow-xl transition-all">
                Criar minha primeira campanha
              </Button>
            </Link>
            <Link href="#demo" className="w-full sm:w-auto">
              <Button size="lg" variant="outline" className="w-full sm:w-auto h-12 px-8 text-base rounded-full border-zinc-200 text-zinc-700 bg-white hover:bg-zinc-50">
                <PlayCircle className="mr-2 h-5 w-5 text-zinc-400" /> Ver como funciona
              </Button>
            </Link>
          </motion.div>
        </section>

        {/* Dashboard Preview / Mockup */}
        <motion.section 
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.4 }}
          className="w-full max-w-6xl px-6 -mt-10 mb-32 z-10"
        >
          <div className="rounded-2xl border border-zinc-200/60 bg-white/50 p-2 shadow-2xl backdrop-blur-sm">
            <div className="rounded-xl border border-zinc-100 bg-zinc-50 aspect-[16/9] w-full flex items-center justify-center relative overflow-hidden">
              <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop')] bg-cover bg-center opacity-10" />
              <div className="z-10 text-center">
                <div className="h-16 w-16 bg-white rounded-full flex items-center justify-center mx-auto shadow-sm border border-zinc-100 mb-4 cursor-pointer hover:scale-105 transition-transform">
                  <PlayCircle className="h-8 w-8 text-zinc-900 ml-1" />
                </div>
                <p className="text-sm font-medium text-zinc-600">Assista à demonstração (1 min)</p>
              </div>
            </div>
          </div>
        </motion.section>

        {/* Feature Bento Grid */}
        <section id="features" className="w-full max-w-6xl px-6 py-24 border-t border-zinc-100">
          <div className="mb-16 md:text-center max-w-2xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-zinc-900 mb-4">
              Tudo o que você precisa para vender.
            </h2>
            <p className="text-lg text-zinc-500">
              O Vysify automatiza todo o trabalho criativo pesado para que você foque apenas no seu negócio.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="md:col-span-2 bg-zinc-50 rounded-3xl p-8 md:p-12 border border-zinc-100 relative overflow-hidden group">
              <div className="relative z-10 max-w-sm">
                <div className="h-12 w-12 rounded-full bg-white flex items-center justify-center shadow-sm border border-zinc-100 mb-6">
                  <Paintbrush className="h-5 w-5 text-zinc-900" />
                </div>
                <h3 className="text-2xl font-bold text-zinc-900 mb-3">Imagens Cinematográficas</h3>
                <p className="text-zinc-500 leading-relaxed">
                  Fazemos o recorte perfeito do seu produto e o posicionamos em cenários 3D hiper-realistas criados sob medida para o seu público-alvo.
                </p>
              </div>
            </div>
            <div className="bg-zinc-900 rounded-3xl p-8 md:p-12 text-white relative overflow-hidden group">
              <div className="relative z-10">
                <div className="h-12 w-12 rounded-full bg-white/10 flex items-center justify-center border border-white/10 mb-6">
                  <Megaphone className="h-5 w-5 text-white" />
                </div>
                <h3 className="text-2xl font-bold mb-3">Copywriting Persuasivo</h3>
                <p className="text-zinc-400 leading-relaxed text-sm">
                  Deixe a IA escrever headlines magnéticas e legendas focadas em conversão usando frameworks de copywriting provados.
                </p>
              </div>
            </div>
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="w-full border-t border-zinc-100 py-12 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-zinc-900" />
            <span className="font-bold text-lg tracking-tight">Vysify</span>
          </div>
          <p className="text-sm text-zinc-500">
            © {new Date().getFullYear()} Vysify AI. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}
