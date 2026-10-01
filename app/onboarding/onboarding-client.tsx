"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Image as ImageIcon, Loader2, Megaphone, Share2, Sparkles, Store, User, Users, Video } from "lucide-react";
import { toast } from "sonner";
import { Logo } from "@/components/logo";
import { PixelMascot } from "@/components/mascot/PixelMascot";
import { buttonClass } from "@/components/app/ui-bits";

const ROLES = [
  { id: "owner", label: "Tenho uma loja ou marca", icon: Store },
  { id: "agency", label: "Trabalho em agência", icon: Users },
  { id: "social", label: "Sou social media / gestor de tráfego", icon: Share2 },
  { id: "other", label: "Outro", icon: User },
] as const;

const GOALS = [
  { id: "images", label: "Imagens para anúncios", icon: ImageIcon },
  { id: "videos", label: "Vídeos curtos (Reels/TikTok)", icon: Video },
  { id: "posts", label: "Posts para redes sociais", icon: Megaphone },
  { id: "idk", label: "Ainda estou descobrindo", icon: Sparkles },
] as const;

export function OnboardingClient({ welcomeCredits }: { welcomeCredits: number }) {
  const { update } = useSession();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [role, setRole] = useState<string>("");
  const [goal, setGoal] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const finish = async () => {
    setSaving(true);
    const res = await fetch("/api/user/onboarding", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role, goal }) });
    if (!res.ok) {
      setSaving(false);
      return toast.error("Não foi possível salvar. Tente novamente.");
    }
    await update(); // recarrega a sessão a partir do banco
    router.replace("/products/new");
    router.refresh();
  };

  const options = step === 0 ? ROLES : GOALS;
  const selected = step === 0 ? role : goal;
  const select = step === 0 ? setRole : setGoal;

  return (
    <div className="flex min-h-screen flex-col items-center px-4 py-8">
      <div className="flex w-full max-w-xl items-center justify-between">
        <Logo />
        <div className="flex gap-1.5" aria-label={`Etapa ${step + 1} de 3`}>
          {[0, 1, 2].map((i) => <span key={i} className={`h-1.5 w-8 rounded-full ${i <= step ? "bg-brand" : "bg-border"}`} />)}
        </div>
      </div>

      <div className="flex w-full max-w-xl flex-1 flex-col justify-center py-10">
        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.2 }}>
            {step < 2 ? (
              <>
                <div className="mb-6 flex items-center gap-4">
                  <PixelMascot mood="idle" size={56} />
                  <div>
                    <h1 className="text-2xl font-semibold tracking-tight">{step === 0 ? "Oi! Eu sou o Vy." : "E o que você quer criar?"}</h1>
                    <p className="text-muted-foreground">{step === 0 ? "Me conta: como você vai usar a Vysify?" : "Assim eu já deixo tudo do seu jeito."}</p>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {options.map((o) => (
                    <button key={o.id} onClick={() => select(o.id)} data-selected={selected === o.id} className="choice flex items-center gap-3">
                      <o.icon className="h-5 w-5 text-brand" />
                      <span className="font-medium">{o.label}</span>
                    </button>
                  ))}
                </div>
                <div className="mt-8 flex justify-between">
                  <button onClick={() => setStep(step - 1)} disabled={step === 0} className={buttonClass("ghost")}>Voltar</button>
                  <button onClick={() => setStep(step + 1)} disabled={!selected} className={buttonClass("primary")}>
                    Continuar <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center">
                <div className="flex justify-center"><PixelMascot mood="happy" size={96} /></div>
                <h1 className="mt-6 text-3xl font-semibold tracking-tight">Tudo pronto!</h1>
                <p className="mx-auto mt-3 max-w-md text-muted-foreground">
                  {welcomeCredits > 0
                    ? `Você já tem ${welcomeCredits} créditos para testar. O primeiro passo é cadastrar o produto que você quer anunciar.`
                    : "O primeiro passo é cadastrar o produto que você quer anunciar. Quando quiser gerar, é só escolher um pacote de créditos."}
                </p>
                <button onClick={finish} disabled={saving} className={`${buttonClass("brand", "lg")} mt-8`}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Cadastrar meu primeiro produto <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
