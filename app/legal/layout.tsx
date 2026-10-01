import Link from "next/link";
import { Logo } from "@/components/logo";
import { COMPANY } from "@/lib/company";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4 sm:px-6">
          <Logo />
          <nav className="flex gap-4 text-sm text-muted-foreground">
            <Link href="/legal/terms" className="hover:text-foreground">Termos</Link>
            <Link href="/legal/privacy" className="hover:text-foreground">Privacidade</Link>
          </nav>
        </div>
      </header>
      <main className="legal mx-auto max-w-3xl px-4 py-12 sm:px-6">{children}</main>
      <footer className="border-t border-border px-4 py-8 text-center text-xs text-muted-foreground">
        {COMPANY.name} · CNPJ {COMPANY.cnpj} · {COMPANY.address} · {COMPANY.supportEmail}
      </footer>
    </div>
  );
}
