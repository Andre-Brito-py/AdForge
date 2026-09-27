"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowRight, Loader2, Target, Users, Megaphone, MonitorPlay, Sparkles, LayoutGrid, Image as ImageIcon, Video, BoxSelect, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export default function NewCampaignWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialProductId = searchParams.get("productId") || "";

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [paywallOpen, setPaywallOpen] = useState(false);

  // FormData state
  const [productId, setProductId] = useState(initialProductId);
  const [objective, setObjective] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [offer, setOffer] = useState("");
  const [platform, setPlatform] = useState("");
  const [format, setFormat] = useState("");
  const [style, setStyle] = useState("");
  const [quality, setQuality] = useState("standard");
  const [variations, setVariations] = useState(3);

  useEffect(() => {
    fetch("/api/products")
      .then(r => r.json())
      .then(data => setProducts(data))
      .catch(console.error);
  }, []);

  const baseCost = platform.includes("Video") || platform.includes("Reels") ? 10 : 3;
  const costPerVariation = quality === "premium" ? baseCost * 2 : baseCost;
  const totalCost = variations * costPerVariation;

  const handleNext = () => setStep(prev => prev + 1);
  const handlePrev = () => setStep(prev => prev - 1);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          objective,
          targetAudience,
          offer,
          platform,
          format,
          style,
          quality,
          variations,
          name: `Campanha de ${objective || "Marketing"}`
        })
      });

      if (!res.ok) {
        if (res.status === 402) { // 402 Payment Required / Saldo Insuficiente
           setPaywallOpen(true);
           setLoading(false);
           return;
        }
        throw new Error();
      }
      const camp = await res.json();
      router.push(`/campaigns/${camp.id}/generating`);
      
    } catch (err) {
      toast.error("Erro ao iniciar campanha. Tente novamente.");
      setLoading(false);
    }
  };

  const stepsHeader = [
    { num: 1, label: "Produto" },
    { num: 2, label: "Objetivo" },
    { num: 3, label: "Público" },
    { num: 4, label: "Oferta" },
    { num: 5, label: "Formato" },
    { num: 6, label: "Qualidade" },
    { num: 7, label: "Estilo" },
    { num: 8, label: "Variações" },
  ];

  const variants = {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] bg-zinc-50 flex flex-col items-center py-12 px-6">
      
      {/* Wizard Header */}
      <div className="w-full max-w-4xl mb-12">
        <div className="flex justify-between items-center relative">
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-zinc-200 rounded-full z-0 overflow-hidden">
            <div 
              className="h-full bg-zinc-900 transition-all duration-500"
              style={{ width: `${((step - 1) / (8 - 1)) * 100}%` }}
            />
          </div>
          {stepsHeader.map(s => (
            <div key={s.num} className="relative z-10 flex flex-col items-center gap-2">
              <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors duration-500 ${step >= s.num ? "bg-zinc-900 text-white" : "bg-zinc-200 text-zinc-400 border-[4px] border-zinc-50"}`}>
                {step > s.num ? <CheckCircle2 className="h-5 w-5" /> : s.num}
              </div>
              <span className={`text-xs font-semibold hidden md:block ${step >= s.num ? "text-zinc-900" : "text-zinc-400"}`}>{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-xl border border-zinc-100 p-8 md:p-12 overflow-hidden min-h-[500px] flex flex-col">
        <AnimatePresence mode="wait">
          
          {step === 1 && (
            <motion.div key="step1" variants={variants} initial="initial" animate="animate" exit="exit" className="flex-1 flex flex-col">
              <div className="mb-8">
                <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Qual produto você quer anunciar?</h1>
                <p className="text-zinc-500 mt-2">Escolha na sua biblioteca ou adicione um novo.</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4 overflow-y-auto max-h-[300px] pr-2">
                <Link href="/products/new" className="border-2 border-dashed border-zinc-200 rounded-2xl flex flex-col items-center justify-center p-6 hover:border-zinc-400 hover:bg-zinc-50 transition-colors text-zinc-500 hover:text-zinc-900">
                  <PlusCircle className="h-8 w-8 mb-2" />
                  <span className="font-semibold text-sm">Adicionar Produto</span>
                </Link>
                {products.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setProductId(p.id)}
                    className={`border rounded-2xl p-2 text-left transition-all ${productId === p.id ? "border-zinc-900 ring-2 ring-zinc-900/10 bg-zinc-50" : "hover:border-zinc-300"}`}
                  >
                    <div className="aspect-[4/3] w-full bg-zinc-100 rounded-xl overflow-hidden mb-2">
                      <img src={p.originalImageUrl} alt={p.name} className="w-full h-full object-cover" />
                    </div>
                    <span className="font-semibold text-sm text-zinc-900 line-clamp-1 px-1">{p.name}</span>
                  </button>
                ))}
              </div>

              <div className="mt-auto pt-8 flex justify-end">
                <Button size="lg" onClick={handleNext} disabled={!productId} className="rounded-full px-8">
                  Continuar <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="step2" variants={variants} initial="initial" animate="animate" exit="exit" className="flex-1 flex flex-col">
              <div className="mb-8">
                <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Qual o seu objetivo?</h1>
                <p className="text-zinc-500 mt-2">A IA usará isso para otimizar a persuasão (Copywriting).</p>
              </div>
              
              <div className="grid gap-4">
                {[
                  { id: "Vendas Diretas", icon: Target, desc: "Focado em conversão e escassez" },
                  { id: "Reconhecimento (Awareness)", icon: Megaphone, desc: "Focado em lembrar a marca" },
                  { id: "Engajamento", icon: Users, desc: "Perguntas e interação" },
                ].map(obj => (
                  <button
                    key={obj.id}
                    onClick={() => setObjective(obj.id)}
                    className={`p-4 border rounded-2xl flex items-center gap-4 transition-all text-left ${objective === obj.id ? "border-zinc-900 ring-2 ring-zinc-900/10 bg-zinc-50" : "hover:border-zinc-300"}`}
                  >
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center ${objective === obj.id ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-500"}`}>
                      <obj.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <span className="font-semibold text-zinc-900 block">{obj.id}</span>
                      <span className="text-sm text-zinc-500">{obj.desc}</span>
                    </div>
                  </button>
                ))}
              </div>

              <div className="mt-auto pt-8 flex justify-between">
                <Button variant="ghost" onClick={handlePrev} className="rounded-full">Voltar</Button>
                <Button size="lg" onClick={handleNext} disabled={!objective} className="rounded-full px-8">
                  Continuar <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div key="step3" variants={variants} initial="initial" animate="animate" exit="exit" className="flex-1 flex flex-col">
              <div className="mb-8">
                <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Quem é o público?</h1>
                <p className="text-zinc-500 mt-2">Descreva com suas palavras ou deixe a IA decidir baseada no produto.</p>
              </div>
              
              <div className="space-y-4">
                <button
                  onClick={() => setTargetAudience("Deixar a IA definir")}
                  className={`w-full p-4 border rounded-2xl flex items-center justify-center gap-3 transition-all ${targetAudience === "Deixar a IA definir" ? "border-zinc-900 bg-zinc-900 text-white" : "hover:border-zinc-300 bg-zinc-50 text-zinc-700 font-medium"}`}
                >
                  <Sparkles className="h-5 w-5" />
                  Deixar a IA decidir (Recomendado)
                </button>
                
                <div className="relative">
                  <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-zinc-200"/></div>
                  <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-zinc-400">Ou digite o seu</span></div>
                </div>

                <Textarea 
                  value={targetAudience === "Deixar a IA definir" ? "" : targetAudience}
                  onChange={e => setTargetAudience(e.target.value)}
                  placeholder="Ex: Mães jovens de 25 a 35 anos que buscam conforto..."
                  className="min-h-[120px] bg-zinc-50 text-base p-4"
                />
              </div>

              <div className="mt-auto pt-8 flex justify-between">
                <Button variant="ghost" onClick={handlePrev} className="rounded-full">Voltar</Button>
                <Button size="lg" onClick={handleNext} disabled={!targetAudience} className="rounded-full px-8">
                  Continuar <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div key="step4" variants={variants} initial="initial" animate="animate" exit="exit" className="flex-1 flex flex-col">
              <div className="mb-8">
                <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Qual a oferta especial? (Opcional)</h1>
                <p className="text-zinc-500 mt-2">Dê um direcionamento sobre descontos, frete grátis ou o CTA desejado.</p>
              </div>
              
              <div className="space-y-4">
                <Textarea 
                  value={offer}
                  onChange={e => setOffer(e.target.value)}
                  placeholder="Ex: 50% de desconto na Black Friday com Frete Grátis. Compre agora no link da bio."
                  className="min-h-[150px] bg-zinc-50 text-base p-4"
                />
              </div>

              <div className="mt-auto pt-8 flex justify-between">
                <Button variant="ghost" onClick={handlePrev} className="rounded-full">Voltar</Button>
                <Button size="lg" onClick={handleNext} className="rounded-full px-8">
                  Continuar <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </motion.div>
          )}

          {step === 5 && (
            <motion.div key="step5" variants={variants} initial="initial" animate="animate" exit="exit" className="flex-1 flex flex-col">
              <div className="mb-8">
                <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Onde você vai postar?</h1>
                <p className="text-zinc-500 mt-2">Isso define o formato (Ratio) e a plataforma do criativo.</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                {[
                  { id: "Instagram Feed", icon: ImageIcon, ratio: "1:1 ou 4:5" },
                  { id: "Instagram Reels/TikTok", icon: Video, ratio: "9:16" },
                  { id: "Facebook Ads", icon: MonitorPlay, ratio: "Vários" },
                  { id: "Stories", icon: BoxSelect, ratio: "9:16" },
                ].map(plat => (
                  <button
                    key={plat.id}
                    onClick={() => { setPlatform(plat.id); setFormat(plat.ratio); }}
                    className={`p-4 border rounded-2xl flex flex-col items-center gap-3 transition-all text-center ${platform === plat.id ? "border-zinc-900 ring-2 ring-zinc-900/10 bg-zinc-50" : "hover:border-zinc-300"}`}
                  >
                    <plat.icon className={`h-6 w-6 ${platform === plat.id ? "text-zinc-900" : "text-zinc-400"}`} />
                    <div>
                      <span className="font-semibold text-sm text-zinc-900 block">{plat.id}</span>
                      <span className="text-xs text-zinc-500">{plat.ratio}</span>
                    </div>
                  </button>
                ))}
              </div>

              <div className="mt-auto pt-8 flex justify-between">
                <Button variant="ghost" onClick={handlePrev} className="rounded-full">Voltar</Button>
                <Button size="lg" onClick={handleNext} disabled={!platform} className="rounded-full px-8">
                  Continuar <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </motion.div>
          )}

          {step === 6 && (
            <motion.div key="step6" variants={variants} initial="initial" animate="animate" exit="exit" className="flex-1 flex flex-col">
              <div className="mb-8">
                <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Qual a qualidade desejada?</h1>
                <p className="text-zinc-500 mt-2">Escolha a resolução ideal para o seu objetivo. Valores mais altos consomem mais créditos.</p>
              </div>
              
              <div className="grid gap-4">
                <button
                  onClick={() => setQuality("standard")}
                  className={`p-6 border rounded-2xl flex flex-col gap-2 transition-all text-left ${quality === "standard" ? "border-zinc-900 ring-2 ring-zinc-900/10 bg-zinc-50" : "hover:border-zinc-300"}`}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-lg text-zinc-900">Standard (HD)</span>
                    <span className="text-sm font-semibold text-zinc-500 bg-zinc-100 px-3 py-1 rounded-full">{baseCost} Créditos / un</span>
                  </div>
                  <span className="text-sm text-zinc-500">Excelente para testar múltiplos criativos rapidamente e validar ofertas.</span>
                </button>
                <button
                  onClick={() => setQuality("premium")}
                  className={`p-6 border rounded-2xl flex flex-col gap-2 transition-all text-left relative overflow-hidden ${quality === "premium" ? "border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/50" : "hover:border-blue-300"}`}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-lg text-blue-900 flex items-center gap-2">Premium (4K) <Sparkles className="h-4 w-4 text-blue-500"/></span>
                    <span className="text-sm font-semibold text-blue-700 bg-blue-100 px-3 py-1 rounded-full">{baseCost * 2} Créditos / un</span>
                  </div>
                  <span className="text-sm text-blue-600/80">Máxima retenção visual. Perfeito para campanhas de conversão pesada e escala.</span>
                </button>
              </div>

              <div className="mt-auto pt-8 flex justify-between">
                <Button variant="ghost" onClick={handlePrev} className="rounded-full">Voltar</Button>
                <Button size="lg" onClick={handleNext} disabled={!quality} className="rounded-full px-8">
                  Continuar <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </motion.div>
          )}

          {step === 7 && (
            <motion.div key="step7" variants={variants} initial="initial" animate="animate" exit="exit" className="flex-1 flex flex-col">
              <div className="mb-8">
                <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Qual o estilo visual?</h1>
                <p className="text-zinc-500 mt-2">A direção de arte que a IA irá seguir.</p>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {["Cinematic", "Minimalist", "Studio Lighting", "Lifestyle", "UGC (User Generated)", "Neon/Cyberpunk"].map(s => (
                  <button
                    key={s}
                    onClick={() => setStyle(s)}
                    className={`p-4 border rounded-2xl flex items-center justify-center text-center transition-all ${style === s ? "border-zinc-900 bg-zinc-900 text-white font-semibold" : "hover:border-zinc-300 bg-zinc-50 text-zinc-700 text-sm font-medium"}`}
                  >
                    {s}
                  </button>
                ))}
              </div>

              <div className="mt-auto pt-8 flex justify-between">
                <Button variant="ghost" onClick={handlePrev} className="rounded-full">Voltar</Button>
                <Button size="lg" onClick={handleNext} disabled={!style} className="rounded-full px-8">
                  Continuar <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </motion.div>
          )}

          {step === 8 && (
            <motion.div key="step8" variants={variants} initial="initial" animate="animate" exit="exit" className="flex-1 flex flex-col">
              <div className="mb-8 text-center">
                <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Quantas variações?</h1>
                <p className="text-zinc-500 mt-2">Quanto mais variações, maior a chance de encontrar o criativo vencedor.</p>
              </div>
              
              <div className="grid grid-cols-4 gap-3 max-w-lg mx-auto w-full mb-8">
                {[3, 5, 10, 20].map(v => (
                  <button
                    key={v}
                    onClick={() => setVariations(v)}
                    className={`p-4 border rounded-2xl flex flex-col items-center justify-center transition-all ${variations === v ? "border-zinc-900 ring-2 ring-zinc-900/10 bg-zinc-50" : "hover:border-zinc-300"}`}
                  >
                    <span className={`text-2xl font-bold ${variations === v ? "text-zinc-900" : "text-zinc-400"}`}>{v}</span>
                  </button>
                ))}
              </div>

              <div className="bg-zinc-100 rounded-2xl p-6 flex items-center justify-between mt-auto mb-8">
                <div>
                  <span className="block text-sm font-semibold text-zinc-500 uppercase tracking-wider">Custo Estimado</span>
                  <span className="text-2xl font-bold text-zinc-900">{totalCost} Créditos</span>
                </div>
                <div className="text-right">
                  <span className="block text-sm font-semibold text-zinc-500 uppercase tracking-wider">Tempo Estimado</span>
                  <span className="text-2xl font-bold text-zinc-900">~ 1 min</span>
                </div>
              </div>

              <div className="flex justify-between">
                <Button variant="ghost" onClick={handlePrev} className="rounded-full" disabled={loading}>Voltar</Button>
                <Button size="lg" onClick={handleSubmit} disabled={loading} className="rounded-full px-10 h-14 text-base shadow-xl group hover:shadow-2xl transition-all">
                  {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Sparkles className="mr-2 h-5 w-5" />}
                  {loading ? "Iniciando IA..." : "Gerar Campanha"}
                </Button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      <Dialog open={paywallOpen} onOpenChange={setPaywallOpen}>
        <DialogContent className="sm:max-w-md bg-white rounded-3xl p-8 text-center flex flex-col items-center">
          <div className="h-16 w-16 bg-blue-50 rounded-full flex items-center justify-center mb-4">
            <Sparkles className="h-8 w-8 text-blue-500" />
          </div>
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-zinc-900 text-center mb-2">Sem créditos suficientes</DialogTitle>
            <DialogDescription className="text-zinc-500 text-base text-center">
              Esta campanha custará <strong>{totalCost} Créditos</strong>, mas seu saldo atual não é suficiente.
            </DialogDescription>
          </DialogHeader>
          
          <div className="mt-8 w-full space-y-3">
            <Link href="/billing" className="w-full block">
              <Button size="lg" className="w-full rounded-xl bg-zinc-900 text-white hover:bg-zinc-800">
                Ver Planos e Fazer Upgrade
              </Button>
            </Link>
            <Button variant="ghost" size="lg" className="w-full rounded-xl" onClick={() => setPaywallOpen(false)}>
              Cancelar Geração
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
