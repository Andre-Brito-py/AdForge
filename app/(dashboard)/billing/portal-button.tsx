"use client";

import { useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { buttonClass } from "@/components/app/ui-bits";

/** Abre o Portal do cliente da Stripe (trocar plano, cartão, faturas e cancelamento). */
export function PortalButton({ label }: { label: string }) {
  const [loading, setLoading] = useState(false);
  const open = async () => {
    setLoading(true);
    const res = await fetch("/api/billing/portal", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.url) {
      setLoading(false);
      return toast.error(data.error || "Erro");
    }
    window.location.href = data.url;
  };
  return (
    <button onClick={open} disabled={loading} className={buttonClass("outline")}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />} {label}
    </button>
  );
}
