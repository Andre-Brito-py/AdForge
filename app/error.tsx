"use client";

import { useEffect } from "react";
import Link from "next/link";
import { PixelMascot } from "@/components/mascot/PixelMascot";
import { buttonClass } from "@/components/app/ui-bits";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
      <PixelMascot mood="confused" size={88} />
      <h1 className="mt-6 text-3xl font-semibold tracking-tight">Algo deu errado por aqui</h1>
      <p className="mt-2 max-w-sm text-muted-foreground">
        Já registramos o problema. Tente novamente; se continuar, fale com o suporte.
        {error.digest && <span className="mt-2 block font-mono text-xs">Código: {error.digest}</span>}
      </p>
      <div className="mt-8 flex gap-2">
        <button onClick={reset} className={buttonClass("primary")}>Tentar de novo</button>
        <Link href="/dashboard" className={buttonClass("outline")}>Voltar ao painel</Link>
      </div>
    </div>
  );
}
