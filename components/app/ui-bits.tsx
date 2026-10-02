import Link from "next/link";
import { AlertCircle, CheckCircle2, CircleDashed, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { PixelMascot, type MascotMood } from "@/components/mascot/PixelMascot";

export function PageHeader({
  title,
  description,
  actions,
  back,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {back && (
          <Link href={back.href} className="mb-3 inline-flex text-sm text-muted-foreground transition hover:text-foreground">
            ← {back.label}
          </Link>
        )}
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        {description && <p className="mt-1.5 text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function EmptyState({
  title,
  description,
  action,
  mood = "idle",
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
  mood?: MascotMood;
}) {
  return (
    <div className="surface flex flex-col items-center px-6 py-14 text-center">
      <PixelMascot mood={mood} size={64} />
      <h3 className="mt-5 text-lg font-semibold">{title}</h3>
      <p className="mt-1.5 max-w-md text-sm text-muted-foreground">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

const STATUS: Record<string, { className: string; icon: React.ElementType; spin?: boolean }> = {
  COMPLETED: { className: "bg-success/12 text-success", icon: CheckCircle2 },
  PARTIAL: { className: "bg-warning/15 text-warning", icon: AlertCircle },
  GENERATING: { className: "bg-brand-soft text-brand", icon: Loader2, spin: true },
  PROCESSING: { className: "bg-brand-soft text-brand", icon: Loader2, spin: true },
  QUEUED: { className: "bg-muted text-muted-foreground", icon: CircleDashed },
  FAILED: { className: "bg-destructive/12 text-destructive", icon: AlertCircle },
};

export function StatusBadge({ status }: { status: string }) {
  const t = useTranslations("status");
  const s = STATUS[status] || { className: "bg-muted text-muted-foreground", icon: CircleDashed };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${s.className}`}>
      <s.icon className={`h-3.5 w-3.5 ${s.spin ? "animate-spin" : ""}`} />
      {t.has(status) ? t(status) : status}
    </span>
  );
}

export function LinkButton({
  href,
  children,
  variant = "primary",
  className = "",
}: {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "brand" | "outline" | "ghost";
  className?: string;
}) {
  return (
    <Link href={href} className={`${buttonClass(variant)} ${className}`}>
      {children}
    </Link>
  );
}

export function buttonClass(variant: "primary" | "brand" | "outline" | "ghost" | "danger" = "primary", size: "md" | "sm" | "lg" = "md") {
  const sizes = { sm: "h-8 px-3 text-xs", md: "h-10 px-4 text-sm", lg: "h-12 px-6 text-base" };
  const variants = {
    primary: "bg-primary text-primary-foreground hover:bg-primary/85",
    brand: "bg-brand text-brand-foreground hover:brightness-110 shadow-sm",
    outline: "border border-border bg-card hover:bg-muted",
    ghost: "hover:bg-muted text-muted-foreground hover:text-foreground",
    danger: "bg-destructive/10 text-destructive hover:bg-destructive/20",
  };
  return `inline-flex items-center justify-center gap-2 rounded-xl font-medium transition disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40 ${sizes[size]} ${variants[variant]}`;
}
