"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { setMascotMood } from "@/components/mascot/mascot-events";

/** Mostra o resultado ao voltar do checkout (?status=success|pending|canceled). */
export function CheckoutStatusToast() {
  const router = useRouter();
  const t = useTranslations("billing.toast");
  useEffect(() => {
    const status = new URLSearchParams(window.location.search).get("status");
    if (!status) return;
    if (status === "success") {
      toast.success(t("success"));
      setMascotMood("happy", 5000);
      // O webhook pode chegar alguns segundos depois do redirecionamento.
      setTimeout(() => router.refresh(), 4000);
    } else if (status === "pending") {
      toast.info(t("pending"));
    } else if (status === "canceled") {
      toast(t("canceled"));
    }
    window.history.replaceState(null, "", window.location.pathname);
  }, [router, t]);
  return null;
}
