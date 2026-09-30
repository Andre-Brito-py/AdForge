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
  const [password, setPassword] = useState("");
  const [token2fa, setToken2fa] = useState("");
  const [step, setStep] = useState<"EMAIL" | "2FA">("EMAIL");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const res = await signIn("credentials", {
      email,
      password,
      token2fa: step === "2FA" ? token2fa : undefined,
      redirect: false,
    });

    if (res?.ok) {
      router.push("/dashboard");
    } else {
      setLoading(false);
      if (res?.error === "2FA_REQUIRED") {
        setStep("2FA");
      } else if (res?.error === "INVALID_2FA") {
        alert("Código 2FA inválido. Tente novamente.");
      } else {
        alert("Erro ao fazer login.");
      }
    }
  };

  const handleGoogleLogin = () => {
    setLoading(true);
    signIn("google", { callbackUrl: "/dashboard" });
  };

  return (
    <div className="min-h-screen grid md:grid-cols-2 bg-white dark:bg-zinc-950">
      {/* Lado Esquerdo - Visual */}
      <div className="hidden md:flex flex-col justify-between bg-zinc-50 dark:bg-zinc-900/20 p-12 border-r border-zinc-100 dark:border-zinc-800 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop')] bg-cover bg-center opacity-[0.03] dark:opacity-[0.08]" />
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-transparent to-zinc-50 dark:to-zinc-950/80" />
        
        <Link href="/" className="flex items-center gap-2 relative z-10 transition-transform hover:scale-105">
          <img src="/logo-full.png" alt="Vysify Logo" className="h-8 object-contain dark:hidden block" />
          <img src="/logo-dark.png" alt="Vysify Logo" className="h-8 object-contain hidden dark:block" />
        </Link>

        <div className="relative z-10 max-w-sm">
          <h2 className="text-3xl font-bold text-zinc-900 dark:text-white mb-4">
            Seu estúdio criativo alimentado por Inteligência Artificial.
          </h2>
          <p className="text-zinc-500 dark:text-zinc-400 text-lg leading-relaxed">
            Junte-se a milhares de marcas que já abandonaram o trabalho manual e estão criando anúncios com a velocidade da luz.
          </p>
        </div>
        
        <div className="relative z-10 text-sm text-zinc-400 dark:text-zinc-500 font-medium">
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
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">Acessar sua conta</h1>
            <p className="text-zinc-500 dark:text-zinc-400 mt-2 text-sm">
              {step === "EMAIL" ? "Entre com seu e-mail ou use o Google." : "Insira o código gerado pelo Google Authenticator."}
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {step === "EMAIL" ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="email" className="text-sm font-medium text-zinc-900 dark:text-zinc-300">Endereço de E-mail</label>
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="voce@exemplo.com"
                    className="w-full p-3 border border-zinc-200 dark:border-zinc-800 rounded-lg outline-none focus:border-violet-600 focus:ring-1 focus:ring-violet-600 transition-all bg-zinc-50/50 dark:bg-zinc-900/50 dark:text-white dark:placeholder-zinc-600"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="password" className="text-sm font-medium text-zinc-900 dark:text-zinc-300">Senha</label>
                  <input
                    id="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full p-3 border border-zinc-200 dark:border-zinc-800 rounded-lg outline-none focus:border-violet-600 focus:ring-1 focus:ring-violet-600 transition-all bg-zinc-50/50 dark:bg-zinc-900/50 dark:text-white dark:placeholder-zinc-600"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <label htmlFor="token2fa" className="text-sm font-medium text-zinc-900 dark:text-zinc-300">Código 2FA (Authenticator)</label>
                <input
                  id="token2fa"
                  type="text"
                  required
                  maxLength={6}
                  value={token2fa}
                  onChange={(e) => setToken2fa(e.target.value)}
                  placeholder="000000"
                  className="w-full p-3 border border-zinc-200 dark:border-zinc-800 rounded-lg outline-none focus:border-violet-600 focus:ring-1 focus:ring-violet-600 transition-all bg-zinc-50/50 dark:bg-zinc-900/50 dark:text-white dark:placeholder-zinc-600 text-center tracking-[0.5em] text-lg font-bold"
                />
              </div>
            )}

            <Button type="submit" size="lg" className="w-full h-12 text-base font-bold rounded-lg group bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 transition-all" disabled={loading}>
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Continuar"}
              {!loading && <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />}
            </Button>
          </form>

          {step === "EMAIL" && (
            <>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-zinc-200 dark:border-zinc-800" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white dark:bg-zinc-950 px-2 text-zinc-400 font-medium tracking-wider">Ou</span>
                </div>
              </div>

              <Button type="button" variant="outline" size="lg" onClick={handleGoogleLogin} disabled={loading} className="w-full h-12 text-base font-semibold rounded-lg group bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all">
                <svg className="h-5 w-5 mr-3" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  <path d="M1 1h22v22H1z" fill="none" />
                </svg>
                Continuar com Google
              </Button>
            </>
          )}

          <p className="text-center text-xs text-zinc-500 leading-relaxed">
            Ao continuar, você concorda com nossos <Link href="#" className="underline hover:text-zinc-900 dark:hover:text-white transition-colors">Termos de Serviço</Link> e <Link href="#" className="underline hover:text-zinc-900 dark:hover:text-white transition-colors">Política de Privacidade</Link>.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
