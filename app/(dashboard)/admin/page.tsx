import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/app/ui-bits";
import { appUrl } from "@/services/email";
import { AdminClient } from "./admin-client";

export const metadata = { title: "Admin" };

export default async function AdminPage() {
  const user = await requireUser();
  if (!user.isAdmin) notFound();
  return (
    <>
      <PageHeader title="Administração" description="Métricas, usuários, chaves de IA, pacotes e pagamentos." />
      <AdminClient baseUrl={appUrl()} />
    </>
  );
}
