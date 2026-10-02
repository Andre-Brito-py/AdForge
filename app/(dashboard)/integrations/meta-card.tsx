"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, RefreshCw, Unplug } from "lucide-react";
import { FacebookIcon as Facebook, InstagramIcon as Instagram } from "@/components/brand-icons";
import { toast } from "sonner";
import { useFormatter, useTranslations } from "next-intl";
import { buttonClass } from "@/components/app/ui-bits";


interface Asset {
  pageId: string;
  pageName: string;
  instagram: { id: string; username: string | null; picture: string | null } | null;
}

export interface MetaCardState {
  available: boolean;
  connection: { name: string | null; status: string; expiresAt: string | null; assets: Asset[] } | null;
}

export function MetaCard({ state }: { state: MetaCardState }) {
  const router = useRouter();
  const t = useTranslations("integrations");
  const format = useFormatter();
  const [busy, setBusy] = useState<"refresh" | "disconnect" | null>(null);
  const conn = state.connection;
  const expired = conn && conn.status !== "ACTIVE";

  const call = async (method: "POST" | "DELETE") => {
    setBusy(method === "POST" ? "refresh" : "disconnect");
    const res = await fetch("/api/integrations/meta", { method });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) return toast.error(data.error || "Error");
    toast.success(method === "POST" ? t("refreshed") : t("disconnected"));
    router.refresh();
  };

  return (
    <section className="surface p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex -space-x-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1877F2] text-white ring-2 ring-card"><Facebook className="h-5 w-5" /></span>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-amber-400 via-pink-500 to-purple-600 text-white ring-2 ring-card"><Instagram className="h-5 w-5" /></span>
          </div>
          <div>
            <h2 className="font-semibold">{t("metaTitle")}</h2>
            <p className="text-sm text-muted-foreground">{t("metaText")}</p>
          </div>
        </div>

        {!state.available ? (
          <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">{t("soon")}</span>
        ) : !conn || expired ? (
          // Link normal (não fetch): o navegador precisa ir até o Facebook.
          <a href="/api/integrations/meta/connect" className={buttonClass("brand")}>
            <Facebook className="h-4 w-4" /> {expired ? t("reconnect") : t("connectFacebook")}
          </a>
        ) : (
          <div className="flex gap-2">
            <button onClick={() => call("POST")} disabled={!!busy} className={buttonClass("outline", "sm")}>
              {busy === "refresh" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} {t("refresh")}
            </button>
            <button
              onClick={() => window.confirm(t("disconnectConfirm")) && call("DELETE")}
              disabled={!!busy}
              className={buttonClass("ghost", "sm")}
            >
              {busy === "disconnect" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Unplug className="h-3.5 w-3.5" />} {t("disconnect")}
            </button>
          </div>
        )}
      </div>

      {conn && (
        <div className="mt-5 border-t border-border pt-5">
          {expired && (
            <p className="mb-4 flex items-center gap-2 rounded-xl bg-warning/10 p-3 text-sm">
              <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
              {t("expiredNotice")}
            </p>
          )}
          <p className="text-sm text-muted-foreground">
            {t.rich("connectedAs", { name: conn.name || t("metaAccount"), b: (chunks) => <strong className="text-foreground">{chunks}</strong> })}
            {conn.expiresAt && !expired ? t("validUntil", { date: format.dateTime(new Date(conn.expiresAt), "short") }) : ""}
          </p>
          {conn.assets.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">{t("noPages")}</p>
          ) : (
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {conn.assets.map((a) => (
                <li key={a.pageId} className="rounded-xl border border-border p-3 text-sm">
                  <p className="flex items-center gap-2 font-medium"><Facebook className="h-4 w-4 text-[#1877F2]" /> {a.pageName}</p>
                  <p className="mt-1 flex items-center gap-2 text-muted-foreground">
                    <Instagram className="h-4 w-4" />
                    {a.instagram ? `@${a.instagram.username || a.instagram.id}` : t("noIg")}
                  </p>
                </li>
              ))}
            </ul>
          )}
          {conn.expiresAt && !expired && (
            <p className="mt-4 text-xs text-muted-foreground">
              {t("renewNote")}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
