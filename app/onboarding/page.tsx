"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Sparkles, ArrowRight, Store, Megaphone, User, Users, Image as ImageIcon, Video, Share2, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function OnboardingPage() {
  const router = useRouter();
  const { data: session, update } = useSession();
  
  const [step, setStep] = useState(1);
  const [role, setRole] = useState("");
  const [goal, setGoal] = useState("");

  const handleNext = () => setStep(step + 1);
  
  const handleFinish = async () => {
    // Aqui no MVP, o usuário terminou o onboarding
    // Vamos chamar uma API para salvar no banco
    const res = await fetch("/api/user/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role, goal })
    });
    
    if (res.ok) {
      await update(); // Atualiza a sessão
      router.push("/products/new"); // Direto para criar produto
    }
  };

  const ROLES = [
    { id: "owner", label: "Dono de Negócio", icon: Store },
    { id: "agency", label: "Agência", icon: Users },
    { id: "social", label: "Social Media", icon: Share2 },
    { id: "other", label: "Outro", icon: User },
  ];

  const GOALS = [
    { id: "images", label: "Imagens para anúncios", icon: ImageIcon },
    { id: "videos", label: "Vídeos curtos (Reels/TikTok)", icon: Video },
    { id: "posts", label: "Posts para redes sociais", icon: Megaphone },
    { id: "idk", label: "Ainda não sei", icon: Sparkles },
  ];

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center p-6">
      
      <div className="w-full max-w-2xl mb-8 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-zinc-900 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight text-zinc-900">Vysify</span>
        </div>
        <div className="flex gap-2">
          <div className={`h-2 w-12 rounded-full ${step >= 1 ? "bg-zinc-900" : "bg-zinc-200"} transition-colors duration-500`} />
          <div className={`h-2 w-12 rounded-full ${step >= 2 ? "bg-zinc-900" : "bg-zinc-200"} transition-colors duration-500`} />
          <div className={`h-2 w-12 rounded-full ${step >= 3 ? "bg-zinc-900" : "bg-zinc-200"} transition-colors duration-500`} />
        </div>
      </div>

      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-xl border border-zinc-100 p-8 md:p-12 overflow-hidden relative min-h-[400px]">
        <AnimatePresence mode="wait">
          
          {step === 1 && (
            <motion.div 
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Conte um pouco sobre você.</h1>
                <p className="text-zinc-500 mt-2 text-lg">Isso nos ajuda a personalizar sua experiência no Vysify.</p>
              </div>
              
              <div className="grid sm:grid-cols-2 gap-4">
                {ROLES.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setRole(r.id)}
                    className={`p-6 border rounded-2xl flex flex-col items-center gap-4 transition-all ${
                      role === r.id ? "border-zinc-900 bg-zinc-50 ring-2 ring-zinc-900/10" : "hover:border-zinc-300"
                    }`}
                  >
                    <r.icon className={`h-8 w-8 ${role === r.id ? "text-zinc-900" : "text-zinc-400"}`} />
                    <span className={`font-semibold ${role === r.id ? "text-zinc-900" : "text-zinc-600"}`}>{r.label}</span>
                  </button>
                ))}
              </div>

              <div className="flex justify-end pt-4">
                <Button size="lg" onClick={handleNext} disabled={!role} className="px-8 rounded-full">
                  Continuar <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div 
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-zinc-900">O que você quer criar?</h1>
                <p className="text-zinc-500 mt-2 text-lg">Qual o seu objetivo principal ao usar a nossa inteligência artificial?</p>
              </div>
              
              <div className="grid sm:grid-cols-2 gap-4">
                {GOALS.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => setGoal(g.id)}
                    className={`p-6 border rounded-2xl flex flex-col gap-3 transition-all text-left ${
                      goal === g.id ? "border-zinc-900 bg-zinc-50 ring-2 ring-zinc-900/10" : "hover:border-zinc-300"
                    }`}
                  >
                    <g.icon className={`h-6 w-6 ${goal === g.id ? "text-zinc-900" : "text-zinc-400"}`} />
                    <span className={`font-semibold ${goal === g.id ? "text-zinc-900" : "text-zinc-600"}`}>{g.label}</span>
                  </button>
                ))}
              </div>

              <div className="flex justify-between pt-4">
                <Button variant="ghost" onClick={() => setStep(1)} className="rounded-full">Voltar</Button>
                <Button size="lg" onClick={handleNext} disabled={!goal} className="px-8 rounded-full">
                  Continuar <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div 
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8 flex flex-col items-center text-center py-8"
            >
              <div className="h-20 w-20 bg-zinc-100 rounded-full flex items-center justify-center mb-4">
                <CheckCircle2 className="h-10 w-10 text-zinc-900" />
              </div>
              
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Tudo pronto!</h1>
                <p className="text-zinc-500 mt-4 text-lg max-w-md mx-auto">
                  Você acaba de ganhar 100 créditos gratuitos. O próximo passo é cadastrar o produto que você quer divulgar.
                </p>
              </div>
              
              <div className="pt-8 w-full max-w-xs">
                <Button size="lg" onClick={handleFinish} className="w-full rounded-full h-14 text-base shadow-lg hover:shadow-xl transition-shadow group">
                  Adicionar meu primeiro produto
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

    </div>
  );
}
