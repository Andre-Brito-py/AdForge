import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import CreativeGalleryClient from "./CreativeGalleryClient";

export default async function CampaignGalleryPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const campaign = await db.campaign.findUnique({
    where: { id: params.id },
    include: {
      product: true,
      creatives: {
        orderBy: { createdAt: "desc" }
      }
    }
  });

  if (!campaign) {
    return (
      <div className="p-10 text-center">
        <h1 className="text-2xl font-bold">Campanha não encontrada</h1>
      </div>
    );
  }

  // Segurança
  const member = await db.workspaceMember.findFirst({
    where: { userId: session.user.id, workspaceId: campaign.workspaceId }
  });
  if (!member) redirect("/dashboard");

  return <CreativeGalleryClient campaign={campaign} />;
}
