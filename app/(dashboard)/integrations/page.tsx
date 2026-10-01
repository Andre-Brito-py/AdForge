import { requireUser } from "@/lib/auth";
import { getMetaApp, getMetaConnection } from "@/lib/meta/connection";
import { PageHeader } from "@/components/app/ui-bits";
import { MetaCard, type MetaCardState } from "./meta-card";

export const metadata = { title: "Integrações" };

const MESSAGES: Record<string, { tone: "ok" | "warn" | "error"; text: string }> = {
  "connected=meta": { tone: "ok", text: "Conta da Meta conectada! Agora você pode publicar direto da galeria da campanha." },
  missing_scopes: { tone: "warn", text: "Conectado, mas algumas permissões não foram concedidas. Reconecte e marque todas as opções para publicar." },
  no_pages: { tone: "warn", text: "Conectado, mas nenhuma Página do Facebook foi encontrada. Para publicar, você precisa administrar uma Página (e, para o Instagram, ter uma conta profissional vinculada a ela)." },
  denied: { tone: "error", text: "A conexão foi cancelada no Facebook." },
  invalid_state: { tone: "error", text: "A sessão de conexão expirou. Tente conectar novamente." },
  exchange_failed: { tone: "error", text: "Não foi possível concluir a conexão com a Meta. Tente novamente em instantes." },
  not_configured: { tone: "error", text: "A integração com a Meta ainda não está disponível." },
  rate_limited: { tone: "error", text: "Muitas tentativas. Aguarde alguns minutos." },
};

export default async function IntegrationsPage(props: PageProps<"/integrations">) {
  const user = await requireUser();
  const sp = await props.searchParams;
  const [app, conn] = await Promise.all([getMetaApp(), getMetaConnection(user.workspaceId)]);

  const key = typeof sp.warning === "string" ? sp.warning : typeof sp.error === "string" ? sp.error : sp.connected === "meta" ? "connected=meta" : null;
  const message = key ? MESSAGES[key] : null;

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

  const soon = [
    { name: "Mercado Livre", desc: "Atualizar as fotos dos seus anúncios com os criativos gerados." },
    { name: "Nuvemshop", desc: "Enviar imagens direto para os produtos da sua loja." },
    { name: "Shopify", desc: "Adicionar imagens e vídeos aos produtos da loja." },
    { name: "TikTok", desc: "Publicar os vídeos verticais no seu perfil." },
  ];

  return (
    <>
      <PageHeader title="Integrações" description="Conecte suas contas para publicar os criativos sem sair da Vysify." />

      {message && (
        <div className={`mb-6 rounded-2xl border p-4 text-sm ${
          message.tone === "ok" ? "border-success/30 bg-success/10" : message.tone === "warn" ? "border-warning/30 bg-warning/10" : "border-destructive/30 bg-destructive/10"
        }`}>
          {message.text}
        </div>
      )}

      <MetaCard state={meta} />

      <h2 className="mb-3 mt-10 text-sm font-medium text-muted-foreground">Em breve</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {soon.map((s) => (
          <div key={s.name} className="surface flex items-start justify-between gap-3 p-5 opacity-80">
            <div>
              <p className="font-medium">{s.name}</p>
              <p className="mt-1 text-sm text-muted-foreground">{s.desc}</p>
            </div>
            <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">Em breve</span>
          </div>
        ))}
      </div>
    </>
  );
}
