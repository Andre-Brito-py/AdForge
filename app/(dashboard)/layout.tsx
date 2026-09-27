import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  return (
    <div className="min-h-screen bg-zinc-50/50 flex flex-col">
      {/* Top Navigation */}
      <header className="sticky top-0 z-50 w-full border-b bg-white/80 backdrop-blur-md">
        <div className="container mx-auto max-w-6xl flex h-16 items-center justify-between px-6">
          <div className="flex items-center gap-8">
            <Link href="/dashboard" className="flex items-center gap-2 font-bold text-xl tracking-tighter">
              <div className="h-6 w-6 bg-zinc-900 rounded flex items-center justify-center">
                <span className="text-white text-xs">V</span>
              </div>
              Vysify
            </Link>
            <nav className="hidden lg:flex items-center gap-1 text-sm font-medium text-zinc-500">
              <Link href="/dashboard" className="px-3 py-2 rounded-md hover:bg-zinc-100 hover:text-zinc-900 transition-all">Painel</Link>
              <Link href="/products" className="px-3 py-2 rounded-md hover:bg-zinc-100 hover:text-zinc-900 transition-all">Produtos</Link>
              <Link href="/campaigns/new" className="px-3 py-2 rounded-md hover:bg-zinc-100 hover:text-zinc-900 transition-all">Campanhas</Link>
              <Link href="/brand" className="px-3 py-2 rounded-md hover:bg-zinc-100 hover:text-zinc-900 transition-all">Brand Kit</Link>
              <Link href="/credits" className="px-3 py-2 rounded-md hover:bg-zinc-100 hover:text-zinc-900 transition-all">Créditos</Link>
              <Link href="/billing" className="px-3 py-2 rounded-md hover:bg-zinc-100 hover:text-zinc-900 transition-all">Planos</Link>
              <Link href="/settings" className="px-3 py-2 rounded-md hover:bg-zinc-100 hover:text-zinc-900 transition-all">Config</Link>
              {session?.user?.email && ["admin@vysify.com", "andre@vysify.com"].includes(session.user.email) && (
                <Link href="/admin" className="px-3 py-2 rounded-md bg-zinc-900 text-white hover:bg-zinc-800 transition-all ml-2">Admin</Link>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm font-medium px-4 py-1.5 bg-zinc-100 text-zinc-700 rounded-full border border-zinc-200">
              {session?.user?.name || "Usuário"}
            </div>
            {/* Adicionar botão de logout futuramente */}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}
