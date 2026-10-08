import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { getMetaApp, getMetaConnection } from "@/lib/meta/connection";
import { PageHeader } from "@/components/app/ui-bits";
import { MetaCard, type MetaCardState } from "./meta-card";
import { StoresCard, type StoreCardState } from "./stores-card";
import { listStoreConnections, storeAdapter, STORE_SLUGS } from "@/lib/stores";
import { canManageSettings } from "@/lib/workspaces";

export async function generateMetadata() {
  return { title: (await getTranslations("nav"))("integrations") };
}

const MESSAGE_TONE: Record<string, "ok" | "warn" | "error"> = {
  connected: "ok", missing_scopes: "warn", no_pages: "warn",
  denied: "error", invalid_state: "error", exchange_failed: "error", not_configured: "error", rate_limited: "error",
  managers_only: "error", invalid_shop: "error",
};

export default async function IntegrationsPage(props: PageProps<"/integrations">) {
  const user = await requireUser();
  const t = await getTranslations("integrations");
  const sp = await props.searchParams;
  const [app, conn, storeConns, storeApps] = await Promise.all([
    getMetaApp(),
    getMetaConnection(user.workspaceId),
    listStoreConnections(user.workspaceId),
    Promise.all(STORE_SLUGS.map(async (slug) => [slug, !!(await storeAdapter(slug)!.getApp())] as const)),
  ]);

  const key = typeof sp.warning === "string" ? sp.warning : typeof sp.error === "string" ? sp.error : typeof sp.connected === "string" ? "connected" : null;
  const message = key && MESSAGE_TONE[key] ? { tone: MESSAGE_TONE[key], text: t(`messages.${key}`) } : null;

  const meta: MetaCardState = {
    available: !!app,
    connection: conn
      ? {
          name: conn.displayName,
          status: conn.status,
          expiresAt: conn.tokenExpiresAt?.toISOString() || null,
          assets: conn.assets,
        }
      : null,
  };

  const stores: StoreCardState[] = STORE_SLUGS.map((slug) => {
    const c = storeConns.find((s) => s.slug === slug);
    return {
      slug,
      label: storeAdapter(slug)!.label,
      available: storeApps.find(([s]) => s === slug)?.[1] ?? false,
      connection: c ? { name: c.displayName, status: c.status } : null,
    };
  });
  const soon = [{ name: "TikTok", desc: t("stores.tiktok") }];

  return (
    <>
      <PageHeader title={t("title")} description={t("subtitle")} />

      {message && (
        <div className={`mb-6 rounded-2xl border p-4 text-sm ${
          message.tone === "ok" ? "border-success/30 bg-success/10" : message.tone === "warn" ? "border-warning/30 bg-warning/10" : "border-destructive/30 bg-destructive/10"
        }`}>
          {message.text}
        </div>
      )}

      <MetaCard state={meta} />

      <StoresCard stores={stores} canManage={canManageSettings(user.workspaceRole)} />

      <h2 className="mb-3 mt-10 text-sm font-medium text-muted-foreground">{t("soon")}</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {soon.map((s) => (
          <div key={s.name} className="surface flex items-start justify-between gap-3 p-5 opacity-80">
            <div>
              <p className="font-medium">{s.name}</p>
              <p className="mt-1 text-sm text-muted-foreground">{s.desc}</p>
            </div>
            <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">{t("soon")}</span>
          </div>
        ))}
      </div>
    </>
  );
}
