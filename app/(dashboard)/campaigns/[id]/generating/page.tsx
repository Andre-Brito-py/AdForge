"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2, Image as ImageIcon, Video, Type } from "lucide-react";
import { motion } from "framer-motion";

export default function GeneratingPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);

  const STEPS = [
    { label: "Analisando o produto e extraindo características...", icon: Sparkles },
    { label: "Escrevendo headlines e copys persuasivas...", icon: Type },
    { label: "Renderizando cenários e fundos imersivos...", icon: ImageIcon },
    { label: "Finalizando variações criativas...", icon: Loader2 },
  ];

  useEffect(() => {
    // Simular a progressão das etapas visuais
    const interval = setInterval(() => {
      setCurrentStep(prev => {
        if (prev < STEPS.length - 1) return prev + 1;
        clearInterval(interval);
        return prev;
      });
    }, 2000);

    // Polling real para checar o status da campanha no banco
    const checkStatus = setInterval(async () => {
      try {
        const res = await fetch(`/api/campaigns/${params.id}`);
        if (res.ok) {
          const camp = await res.json();
          if (camp.status === "COMPLETED" || camp.status === "FAILED") {
            clearInterval(checkStatus);
            router.push(`/campaigns/${params.id}`);
          }
        }
      } catch (e) {
        console.error(e);
      }
    }, 3000);

    return () => {
      clearInterval(interval);
      clearInterval(checkStatus);
    };
  }, [params.id, router, STEPS.length]);

  const StepIcon = STEPS[currentStep].icon;

  return (
    <div className="min-h-[calc(100vh-64px)] bg-zinc-900 flex flex-col items-center justify-center p-6 text-center">
      
      <motion.div 
        key={currentStep}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 1.1 }}
        transition={{ duration: 0.5 }}
        className="h-24 w-24 bg-zinc-800/50 border border-zinc-700/50 rounded-full flex items-center justify-center mb-8 relative"
      >
        <div className="absolute inset-0 rounded-full border border-zinc-500 border-t-zinc-200 animate-spin opacity-50" style={{ animationDuration: "3s" }} />
        <StepIcon className={`h-10 w-10 text-white ${currentStep === 3 ? "animate-spin" : "animate-pulse"}`} />
      </motion.div>

      <motion.h1 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-3xl md:text-4xl font-extrabold tracking-tight text-white mb-4"
      >
        A IA está trabalhando...
      </motion.h1>
      
      <motion.p 
        key={`p-${currentStep}`}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-xl text-zinc-400 font-medium"
      >
        {STEPS[currentStep].label}
      </motion.p>

      <div className="mt-16 w-full max-w-md">
        <div className="flex justify-between text-xs font-semibold text-zinc-500 mb-2 px-1">
          <span>Progresso Estimado</span>
          <span>{Math.round(((currentStep + 1) / STEPS.length) * 100)}%</span>
        </div>
        <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
          <motion.div 
            initial={{ width: "0%" }}
            animate={{ width: `${((currentStep + 1) / STEPS.length) * 100}%` }}
            transition={{ duration: 0.5 }}
            className="h-full bg-white"
          />
        </div>
      </div>

    </div>
  );
}
