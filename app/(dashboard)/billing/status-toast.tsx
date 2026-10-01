"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { setMascotMood } from "@/components/mascot/mascot-events";

/** Mostra o resultado ao voltar do checkout (?status=success|pending|canceled). */
export function CheckoutStatusToast() {
  const router = useRouter();
  useEffect(() => {
    const status = new URLSearchParams(window.location.search).get("status");
    if (!status) return;
    if (status === "success") {
      toast.success("Pagamento recebido! Os créditos aparecem em instantes.");
      setMascotMood("happy", 5000);
      // O webhook pode chegar alguns segundos depois do redirecionamento.
      setTimeout(() => router.refresh(), 4000);
    } else if (status === "pending") {
      toast.info("Pagamento pendente. Assim que for confirmado, os créditos entram automaticamente.");
    } else if (status === "canceled") {
      toast("Pagamento cancelado. Nenhuma cobrança foi feita.");
    }
    window.history.replaceState(null, "", window.location.pathname);
  }, [router]);
  return null;
}
