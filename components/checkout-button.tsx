"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface CheckoutButtonProps {
  planId: string;
  planName: string;
  isFeatured: boolean;
  currency: string;
}

export function CheckoutButton({ planId, planName, isFeatured, currency }: CheckoutButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleCheckout = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, currency })
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || "Erro ao iniciar pagamento");
      }
      
      if (data.url) {
        window.location.href = data.url; // Redireciona para Stripe ou Mercado Pago
      }
    } catch (error: any) {
      toast.error(error.message);
      setLoading(false);
    }
  };

  return (
    <Button 
      onClick={handleCheckout}
      disabled={loading}
      size="lg" 
      className={`w-full rounded-xl h-12 text-base ${
        isFeatured 
          ? "bg-white text-zinc-900 hover:bg-zinc-100" 
          : "bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
      }`}
    >
      {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
      {loading ? "Processando..." : `Assinar ${planName}`} 
      {!loading && <ArrowRight className="ml-2 h-4 w-4" />}
    </Button>
  );
}
