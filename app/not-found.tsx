import Link from "next/link";
import { PixelMascot } from "@/components/mascot/PixelMascot";
import { buttonClass } from "@/components/app/ui-bits";

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
      <PixelMascot mood="confused" size={88} />
      <p className="mt-6 text-sm font-medium text-brand">Erro 404</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Não encontrei esta página</h1>
      <p className="mt-2 max-w-sm text-muted-foreground">O link pode estar errado ou o conteúdo foi removido.</p>
      <div className="mt-8 flex gap-2">
        <Link href="/" className={buttonClass("outline")}>Página inicial</Link>
        <Link href="/dashboard" className={buttonClass("primary")}>Ir para o painel</Link>
      </div>
    </div>
  );
}
