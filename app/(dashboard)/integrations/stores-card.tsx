"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Store, Unplug } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { buttonClass } from "@/components/app/ui-bits";

export interface StoreCardState {
  slug: "mercadolivre" | "nuvemshop" | "shopify";
  label: string;
  available: boolean;
  connection: { name: string | null; status: string } | null;
}

export function StoresCard({ stores, canManage }: { stores: StoreCardState[]; canManage: boolean }) {
  const t = useTranslations("integrations.storesCard");
  const router = useRouter();
  const [shop, setShop] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const disconnect = async (slug: string) => {
    if (!confirm(t("disconnectConfirm"))) return;
    setBusy(slug);
    const res = await fetch(`/api/integrations/stores/${slug}`, { method: "DELETE" });
    setBusy(null);
    if (!res.ok) return toast.error((await res.json().catch(() => ({}))).error || t("error"));
    toast.success(t("disconnected"));
    router.refresh();
  };

  return (
    <section className="mt-10">
      <h2 className="mb-1 text-lg font-semibold tracking-tight">{t("title")}</h2>
      <p className="mb-4 text-sm text-muted-foreground">{t("subtitle")}</p>
      <div className="grid gap-3 md:grid-cols-3">
        {stores.map((s) => {
          const connected = s.connection?.status === "ACTIVE";
          const expired = s.connection && !connected;
          return (
            <div key={s.slug} className="surface flex flex-col gap-3 p-5">
              <div className="flex items-start justify-between gap-2">
                <p className="flex items-center gap-2 font-medium"><Store className="h-4 w-4 text-brand" /> {s.label}</p>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
                  connected ? "bg-success/12 text-success" : expired ? "bg-warning/15 text-warning" : "bg-muted text-muted-foreground"
                }`}>
                  {connected ? t("connected") : expired ? t("expired") : s.available ? t("notConnected") : t("soon")}
                </span>
              </div>
              <p className="flex-1 text-sm text-muted-foreground">{s.connection?.name ? s.connection.name : t(`desc.${s.slug}`)}</p>
              {!s.available ? null : !canManage ? (
                !connected && <p className="text-xs text-muted-foreground">{t("managersOnly")}</p>
              ) : connected ? (
                <button onClick={() => disconnect(s.slug)} disabled={busy === s.slug} className={buttonClass("outline", "sm")}>
                  {busy === s.slug ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Unplug className="h-3.5 w-3.5" />} {t("disconnect")}
                </button>
              ) : s.slug === "shopify" ? (
                <div className="space-y-2">
                  <label htmlFor="shopify-shop" className="label-base">{t("shopLabel")}</label>
                  <input id="shopify-shop" className="input-base" placeholder="minha-loja.myshopify.com" value={shop} onChange={(e) => setShop(e.target.value)} />
                  {/* Rota de API (redireciona para a Shopify): navegação completa, por link. */}
                  <a href={shop.trim() ? `/api/integrations/stores/shopify/connect?shop=${encodeURIComponent(shop.trim())}` : undefined}
                    aria-disabled={!shop.trim()} className={`${buttonClass("brand", "sm")} w-full ${shop.trim() ? "" : "pointer-events-none opacity-50"}`}>
                    {expired ? t("reconnect") : t("connect")}
                  </a>
                </div>
              ) : (
                <a href={`/api/integrations/stores/${s.slug}/connect`} className={buttonClass("brand", "sm")}>{expired ? t("reconnect") : t("connect")}</a>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
