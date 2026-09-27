import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { ThemeToggle } from "@/components/theme-toggle";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  return (
    <div className="min-h-screen bg-zinc-50/50 dark:bg-zinc-950 flex flex-col">
      {/* Top Navigation */}
      <header className="sticky top-0 z-50 w-full border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md">
        <div className="container mx-auto max-w-6xl flex h-16 items-center justify-between px-6">
          <div className="flex items-center gap-8">
            <Link href="/dashboard" className="flex items-center gap-2 font-bold text-xl tracking-tighter text-zinc-900 dark:text-white transition-transform hover:scale-105">
              <img src="/logo-icon.png" alt="Vysify Icon" className="h-6 w-6 object-contain dark:hidden block" />
              <img src="/logo-icon-dark.png" alt="Vysify Icon" className="h-6 w-6 object-contain hidden dark:block" />
              Vysify
            </Link>
            <nav className="hidden lg:flex items-center gap-1 text-sm font-medium text-zinc-500 dark:text-zinc-400">
              <Link href="/dashboard" className="px-3 py-2 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-900 hover:text-zinc-900 dark:hover:text-white transition-all">Painel</Link>
              <Link href="/products" className="px-3 py-2 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-900 hover:text-zinc-900 dark:hover:text-white transition-all">Produtos</Link>
              <Link href="/campaigns/new" className="px-3 py-2 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-900 hover:text-zinc-900 dark:hover:text-white transition-all">Campanhas</Link>
              <Link href="/brand" className="px-3 py-2 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-900 hover:text-zinc-900 dark:hover:text-white transition-all">Brand Kit</Link>
              <Link href="/credits" className="px-3 py-2 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-900 hover:text-zinc-900 dark:hover:text-white transition-all">Créditos</Link>
              <Link href="/billing" className="px-3 py-2 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-900 hover:text-zinc-900 dark:hover:text-white transition-all">Planos</Link>
              <Link href="/settings" className="px-3 py-2 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-900 hover:text-zinc-900 dark:hover:text-white transition-all">Config</Link>
              {(session?.user as any)?.role === "SUPERADMIN" && (
                <Link href="/admin" className="px-3 py-2 rounded-md bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-white transition-all ml-2">Admin</Link>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <div className="text-sm font-medium px-4 py-1.5 bg-zinc-100 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 rounded-full border border-zinc-200 dark:border-zinc-800">
              {session?.user?.name || "Usuário"}
            </div>
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
