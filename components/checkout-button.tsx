"use client";

import { useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { buttonClass } from "@/components/app/ui-bits";

export function CheckoutButton({ planId, label, featured, currency }: { planId: string; label: string; featured: boolean; currency: string }) {
  const [loading, setLoading] = useState(false);

  const checkout = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, currency }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) throw new Error(data.error || "Não foi possível iniciar o pagamento");
      window.location.href = data.url;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao iniciar pagamento");
      setLoading(false);
    }
  };

  return (
    <button onClick={checkout} disabled={loading} className={`${buttonClass(featured ? "brand" : "primary", "lg")} w-full`}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {loading ? "Abrindo pagamento..." : label}
      {!loading && <ArrowRight className="h-4 w-4" />}
    </button>
  );
}
