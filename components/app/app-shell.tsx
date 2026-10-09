"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard, Package, Megaphone, Palette, Plug, Coins, CreditCard, Settings, Shield, LogOut, Menu, X, Plus, Users,
} from "lucide-react";
import { LogoMark } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { MascotCorner } from "@/components/mascot/MascotCorner";
import { VerifyEmailBanner } from "./verify-email-banner";
import { SupportButton } from "@/components/support-button";
import type { SupportConfig } from "@/lib/support";
import { useFormatter, useTranslations } from "next-intl";

const NAV = [
  { href: "/dashboard", key: "dashboard", icon: LayoutDashboard },
  { href: "/products", key: "products", icon: Package },
  { href: "/campaigns", key: "campaigns", icon: Megaphone },
  { href: "/brand", key: "brand", icon: Palette },
  { href: "/team", key: "team", icon: Users },
  { href: "/integrations", key: "integrations", icon: Plug },
  { href: "/credits", key: "credits", icon: Coins },
  { href: "/billing", key: "billing", icon: CreditCard },
  { href: "/settings", key: "settings", icon: Settings },
];

export interface ShellUser {
  name: string | null;
  email: string;
  isAdmin: boolean;
  emailVerified: boolean;
  /** Workspaces da pessoa (o seletor só aparece com mais de um) e o que está em uso. */
  workspaces?: { id: string; name: string }[];
  workspaceId?: string;
  /** Atendimento pelo WhatsApp (sem número configurado, o cartão não aparece). */
  support?: SupportConfig;
}

function WorkspaceSwitcher({ user }: { user: ShellUser }) {
  const t = useTranslations("nav");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  if (!user.workspaces || user.workspaces.length < 2) return null;
  const change = async (id: string) => {
    setBusy(true);
    const res = await fetch("/api/workspace", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ switchTo: id }) });
    setBusy(false);
    if (res.ok) {
      router.push("/dashboard");
      router.refresh();
    }
  };
  return (
    <div className="space-y-1 px-1">
      <label htmlFor="ws-switch" className="text-xs font-medium text-muted-foreground">{t("workspace")}</label>
      <select id="ws-switch" disabled={busy} value={user.workspaceId} onChange={(e) => change(e.target.value)} className="input-base h-9 text-sm">
        {user.workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
      </select>
    </div>
  );
}

function NavLinks({ isAdmin, onNavigate }: { isAdmin: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const items = isAdmin ? [...NAV, { href: "/admin", key: "admin", icon: Shield }] : NAV;
  return (
    <nav className="flex flex-col gap-0.5" aria-label={t("mainNav")}>
      {items.map((item) => {
        const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href + "/")) || pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={`group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
              active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground"
            }`}
          >
            <item.icon className={`h-4 w-4 ${active ? "text-brand" : ""}`} />
            {t(item.key)}
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarContent({ user, balance, onNavigate }: { user: ShellUser; balance: number; onNavigate?: () => void }) {
  const t = useTranslations("nav");
  const format = useFormatter();
  return (
    <div className="flex h-full flex-col gap-6 p-4">
      <Link href="/dashboard" onClick={onNavigate} className="flex items-center gap-2 px-2 pt-1 font-semibold tracking-tight">
        <LogoMark className="h-7 w-7" />
        <span className="text-lg">Vysify</span>
      </Link>

      <Link
        href="/campaigns/new"
        onClick={onNavigate}
        className="flex items-center justify-center gap-2 rounded-xl bg-brand px-3 py-2.5 text-sm font-semibold text-brand-foreground shadow-sm transition hover:brightness-110"
      >
        <Plus className="h-4 w-4" /> {t("newCampaign")}
      </Link>

      <WorkspaceSwitcher user={user} />

      <NavLinks isAdmin={user.isAdmin} onNavigate={onNavigate} />

      <div className="mt-auto space-y-3">
        {user.support?.whatsapp && <SupportButton support={user.support} email={user.email} />}
        <Link href="/credits" onClick={onNavigate} className="surface block p-4 transition hover:border-foreground/20">
          <p className="text-xs font-medium text-muted-foreground">{t("balance")}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">
            {format.number(balance)} <span className="text-sm font-medium text-muted-foreground">{t("creditsUnit", { count: balance })}</span>
          </p>
        </Link>
        <div className="flex items-center gap-2 rounded-xl px-2 py-1.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-sm font-semibold text-brand">
            {(user.name || user.email).slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{user.name || t("myAccount")}</p>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          </div>
          <ThemeToggle />
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="rounded-lg p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
            aria-label={t("signOutLabel")}
            title={t("signOut")}
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function AppShell({ user, balance, children }: { user: ShellUser; balance: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const t = useTranslations("nav");

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-sidebar-border bg-sidebar lg:block">
        <SidebarContent user={user} balance={balance} />
      </aside>

      {/* Barra superior no celular */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/85 px-4 backdrop-blur-md lg:hidden">
        <button onClick={() => setOpen(true)} className="-ml-2 rounded-lg p-2 hover:bg-muted" aria-label={t("openMenu")}>
          <Menu className="h-5 w-5" />
        </button>
        <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
          <LogoMark className="h-6 w-6" /> Vysify
        </Link>
        <Link href="/credits" className="rounded-full bg-muted px-3 py-1 text-xs font-semibold tabular-nums">
          {balance} cr
        </Link>
      </header>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label={t("openMenu")}>
          <div className="absolute inset-0 bg-black/50 animate-in fade-in" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85%] bg-sidebar shadow-xl animate-in slide-in-from-left">
            <button onClick={() => setOpen(false)} className="absolute right-3 top-3 rounded-lg p-2 hover:bg-muted" aria-label={t("closeMenu")}>
              <X className="h-5 w-5" />
            </button>
            <SidebarContent user={user} balance={balance} onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}

      <div className="lg:pl-64">
        {!user.emailVerified && <VerifyEmailBanner />}
        <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10">{children}</main>
      </div>

      <MascotCorner />
    </div>
  );
}
