"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { buttonClass } from "@/components/app/ui-bits";

function Verify() {
  const token = useSearchParams().get("token") || "";
  const [state, setState] = useState<"loading" | "ok" | "error">(token ? "loading" : "error");
  const [message, setMessage] = useState("Link incompleto.");
  const ran = useRef(false);

  useEffect(() => {
    if (!token || ran.current) return;
    ran.current = true;
    fetch("/api/auth/verify-email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (res.ok) setState("ok");
        else { setState("error"); setMessage(data.error || "Link inválido ou expirado."); }
      })
      .catch(() => { setState("error"); setMessage("Erro de conexão."); });
  }, [token]);

  if (state === "loading") {
    return (
      <AuthShell title="Confirmando seu e-mail..." mood="working">
        <Loader2 className="h-6 w-6 animate-spin text-brand" />
      </AuthShell>
    );
  }
  if (state === "ok") {
    return (
      <AuthShell title="E-mail confirmado!" subtitle="Tudo certo. Agora você já pode gerar campanhas." mood="happy">
        <Link href="/dashboard" className={`${buttonClass("brand", "lg")} w-full`}>Ir para o painel</Link>
      </AuthShell>
    );
  }
  return (
    <AuthShell title="Não foi possível confirmar" subtitle={message} mood="confused">
      <p className="text-sm text-muted-foreground">Entre na sua conta e use o botão “Reenviar link” no aviso do topo da página.</p>
      <Link href="/login" className={`${buttonClass("primary", "lg")} mt-6 w-full`}>Entrar</Link>
    </AuthShell>
  );
}

export default function VerifyEmailPage() {
  return <Suspense><Verify /></Suspense>;
}
