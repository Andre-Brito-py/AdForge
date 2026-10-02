"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Image as ImageIcon, Loader2, Megaphone, Share2, Sparkles, Store, User, Users, Video } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Logo } from "@/components/logo";
import { PixelMascot } from "@/components/mascot/PixelMascot";
import { buttonClass } from "@/components/app/ui-bits";

const ROLES = [
  { id: "owner", icon: Store },
  { id: "agency", icon: Users },
  { id: "social", icon: Share2 },
  { id: "other", icon: User },
] as const;

const GOALS = [
  { id: "images", icon: ImageIcon },
  { id: "videos", icon: Video },
  { id: "posts", icon: Megaphone },
  { id: "idk", icon: Sparkles },
] as const;

export function OnboardingClient({ welcomeCredits }: { welcomeCredits: number }) {
  const t = useTranslations("onboarding");
  const tc = useTranslations("common");
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
      return toast.error(t("error"));
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
        <div className="flex gap-1.5" aria-label={t("step", { current: step + 1, total: 3 })}>
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
                    <h1 className="text-2xl font-semibold tracking-tight">{step === 0 ? t("hello") : t("goalTitle")}</h1>
                    <p className="text-muted-foreground">{step === 0 ? t("helloSub") : t("goalSub")}</p>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {options.map((o) => (
                    <button key={o.id} onClick={() => select(o.id)} data-selected={selected === o.id} className="choice flex items-center gap-3">
                      <o.icon className="h-5 w-5 text-brand" />
                      <span className="font-medium">{step === 0 ? t(`roles.${o.id}`) : t(`goals.${o.id}`)}</span>
                    </button>
                  ))}
                </div>
                <div className="mt-8 flex justify-between">
                  <button onClick={() => setStep(step - 1)} disabled={step === 0} className={buttonClass("ghost")}>{tc("back")}</button>
                  <button onClick={() => setStep(step + 1)} disabled={!selected} className={buttonClass("primary")}>
                    {tc("continue")} <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center">
                <div className="flex justify-center"><PixelMascot mood="happy" size={96} /></div>
                <h1 className="mt-6 text-3xl font-semibold tracking-tight">{t("doneTitle")}</h1>
                <p className="mx-auto mt-3 max-w-md text-muted-foreground">
                  {welcomeCredits > 0 ? t("doneWithCredits", { count: welcomeCredits }) : t("doneNoCredits")}
                </p>
                <button onClick={finish} disabled={saving} className={`${buttonClass("brand", "lg")} mt-8`}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} {t("cta")} <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
