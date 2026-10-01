import Link from "next/link";
import { Logo } from "@/components/logo";
import { COMPANY } from "@/lib/company";

export const metadata = { title: "Exclusão de dados da Meta" };

// Página de status exigida pela Meta para pedidos de exclusão de dados.
export default async function MetaDataDeletionPage(props: PageProps<"/meta-data-deletion">) {
  const sp = await props.searchParams;
  const code = typeof sp.code === "string" ? sp.code.slice(0, 32) : null;
  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <Logo />
      <h1 className="mt-10 text-2xl font-semibold tracking-tight">Exclusão de dados do Facebook/Instagram</h1>
      <p className="mt-4 text-muted-foreground">
        Removemos os tokens de acesso e a lista de Páginas e contas do Instagram associados à sua conta da Meta. A Vysify não
        consegue mais publicar em seu nome.
      </p>
      {code && <p className="mt-4 text-sm">Código de confirmação: <code className="rounded bg-muted px-2 py-1 font-mono">{code}</code></p>}
      <p className="mt-6 text-sm text-muted-foreground">
        Para excluir também a sua conta na Vysify (produtos, campanhas e criativos), acesse Configurações › Privacidade ou escreva para{" "}
        <a className="underline" href={`mailto:${COMPANY.privacyEmail}`}>{COMPANY.privacyEmail}</a>. Veja a{" "}
        <Link href="/legal/privacy" className="underline">Política de Privacidade</Link>.
      </p>
    </div>
  );
}
