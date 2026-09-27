"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Sparkles, ArrowRight, Loader2 } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    // Como estamos num MVP usando Credentials para simular o login/cadastro mágico
    const res = await signIn("credentials", {
      email,
      redirect: false,
    });

    if (res?.ok) {
      router.push("/dashboard");
    } else {
      setLoading(false);
      alert("Erro ao fazer login.");
    }
  };

  return (
    <div className="min-h-screen grid md:grid-cols-2 bg-white">
      {/* Lado Esquerdo - Visual */}
      <div className="hidden md:flex flex-col justify-between bg-zinc-50 p-12 border-r border-zinc-100 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop')] bg-cover bg-center opacity-[0.03]" />
        
        <Link href="/" className="flex items-center gap-2 relative z-10">
          <div className="h-8 w-8 rounded-lg bg-zinc-900 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight text-zinc-900">Vysify</span>
        </Link>

        <div className="relative z-10 max-w-sm">
          <h2 className="text-3xl font-bold text-zinc-900 mb-4">
            Seu estúdio criativo alimentado por Inteligência Artificial.
          </h2>
          <p className="text-zinc-500 text-lg leading-relaxed">
            Junte-se a milhares de marcas que já abandonaram o trabalho manual e estão criando anúncios com a velocidade da luz.
          </p>
        </div>
        
        <div className="relative z-10 text-sm text-zinc-400 font-medium">
          © {new Date().getFullYear()} Vysify AI.
        </div>
      </div>

      {/* Lado Direito - Form */}
      <div className="flex items-center justify-center p-8">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm space-y-8"
        >
          <div className="text-center md:text-left">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Acessar sua conta</h1>
            <p className="text-zinc-500 mt-2 text-sm">Digite seu e-mail para entrar ou criar uma conta gratuita.</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium text-zinc-900">Endereço de E-mail</label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@exemplo.com"
                className="w-full p-3 border border-zinc-200 rounded-lg outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 transition-all bg-zinc-50/50"
              />
            </div>

            <Button type="submit" size="lg" className="w-full h-12 text-base rounded-lg group" disabled={loading}>
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Continuar com E-mail"}
              {!loading && <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />}
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-zinc-200" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-zinc-400 font-medium tracking-wider">Seguro e Rápido</span>
            </div>
          </div>

          <p className="text-center text-xs text-zinc-500 leading-relaxed">
            Ao continuar, você concorda com nossos <Link href="#" className="underline hover:text-zinc-900">Termos de Serviço</Link> e <Link href="#" className="underline hover:text-zinc-900">Política de Privacidade</Link>.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
