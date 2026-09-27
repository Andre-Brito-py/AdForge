import Link from "next/link";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { PlusCircle, Wallet, LayoutGrid, Image as ImageIcon, ArrowRight, CircleDashed, CheckCircle2, AlertCircle } from "lucide-react";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import "dayjs/locale/pt-br";

dayjs.extend(relativeTime);
dayjs.locale("pt-br");

export default async function Dashboard() {
  const session = await getServerSession(authOptions);
  
  let balance = 0;
  let campaignsCount = 0;
  let creativesCount = 0;
  let recentCampaigns: any[] = [];

  if (session?.user) {
    const workspaceMember = await db.workspaceMember.findFirst({
      where: { userId: session.user.id }
    });
    
    if (workspaceMember) {
      const wId = workspaceMember.workspaceId;
      const balanceRecord = await db.creditBalance.findUnique({ where: { workspaceId: wId }});
      balance = balanceRecord?.balance || 0;
      
      campaignsCount = await db.campaign.count({ where: { workspaceId: wId } });
      
      const campaigns = await db.campaign.findMany({ where: { workspaceId: wId }, select: { id: true } });
      const cIds = campaigns.map(c => c.id);
      creativesCount = await db.creative.count({ where: { campaignId: { in: cIds } } });

      recentCampaigns = await db.campaign.findMany({
        where: { workspaceId: wId },
        include: { product: true, _count: { select: { creatives: true } } },
        orderBy: { createdAt: "desc" },
        take: 5
      });
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "COMPLETED": return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
      case "GENERATING":
      case "PROCESSING": return <CircleDashed className="h-4 w-4 text-blue-500 animate-spin" />;
      case "FAILED": return <AlertCircle className="h-4 w-4 text-red-500" />;
      default: return <CircleDashed className="h-4 w-4 text-zinc-400" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "COMPLETED": return <span className="text-emerald-700 font-medium bg-emerald-50 px-2 py-1 rounded-full text-xs">Concluído</span>;
      case "GENERATING":
      case "PROCESSING": return <span className="text-blue-700 font-medium bg-blue-50 px-2 py-1 rounded-full text-xs">Processando</span>;
      case "FAILED": return <span className="text-red-700 font-medium bg-red-50 px-2 py-1 rounded-full text-xs">Falhou</span>;
      default: return <span className="text-zinc-700 font-medium bg-zinc-100 px-2 py-1 rounded-full text-xs">Rascunho</span>;
    }
  };

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-12">
      
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-zinc-900">Visão Geral</h1>
          <p className="text-zinc-500 mt-2 text-lg">Pronto para criar sua próxima campanha, {session?.user?.name || "Usuário"}?</p>
        </div>
        <Link href="/campaigns/new">
          <Button size="lg" className="rounded-full shadow-sm hover:shadow-md transition-all gap-2 h-12 px-6">
            <PlusCircle className="h-5 w-5" />
            Criar Nova Campanha
          </Button>
        </Link>
      </header>

      {/* Metrics */}
      <div className="grid sm:grid-cols-3 gap-6">
        <div className="bg-white p-8 rounded-3xl border border-zinc-200 shadow-sm flex flex-col justify-between group hover:shadow-md transition-all">
          <div>
            <div className="h-10 w-10 rounded-full bg-zinc-100 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Wallet className="h-5 w-5 text-zinc-600" />
            </div>
            <h3 className="font-semibold text-sm uppercase tracking-wider text-zinc-500">Saldo Disponível</h3>
            <p className="text-4xl font-extrabold mt-3 text-zinc-900 tracking-tight">{balance} <span className="text-xl text-zinc-400 font-medium">CR</span></p>
          </div>
          <Link href="/billing" className="text-sm font-semibold text-zinc-500 hover:text-zinc-900 mt-6 inline-flex items-center group-hover:translate-x-1 transition-transform">
            Comprar mais créditos &rarr;
          </Link>
        </div>
        
        <div className="bg-white p-8 rounded-3xl border border-zinc-200 shadow-sm flex flex-col justify-between group hover:shadow-md transition-all">
          <div>
            <div className="h-10 w-10 rounded-full bg-zinc-100 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <LayoutGrid className="h-5 w-5 text-zinc-600" />
            </div>
            <h3 className="font-semibold text-sm uppercase tracking-wider text-zinc-500">Campanhas Ativas</h3>
            <p className="text-4xl font-extrabold mt-3 text-zinc-900 tracking-tight">{campaignsCount}</p>
          </div>
        </div>
        
        <div className="bg-white p-8 rounded-3xl border border-zinc-200 shadow-sm flex flex-col justify-between group hover:shadow-md transition-all">
          <div>
            <div className="h-10 w-10 rounded-full bg-zinc-100 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <ImageIcon className="h-5 w-5 text-zinc-600" />
            </div>
            <h3 className="font-semibold text-sm uppercase tracking-wider text-zinc-500">Criativos Gerados</h3>
            <p className="text-4xl font-extrabold mt-3 text-zinc-900 tracking-tight">{creativesCount}</p>
          </div>
        </div>
      </div>

      {/* Start Here / Recent Campaigns */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-zinc-900 mb-6">Campanhas Recentes</h2>
        
        {recentCampaigns.length === 0 ? (
          <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm p-12 text-center flex flex-col items-center">
            <div className="h-20 w-20 bg-zinc-50 rounded-full flex items-center justify-center mb-6">
              <LayoutGrid className="h-8 w-8 text-zinc-400" />
            </div>
            <h3 className="text-xl font-bold text-zinc-900 mb-2">Crie seu primeiro anúncio</h3>
            <p className="text-zinc-500 max-w-md mx-auto mb-8">
              Você ainda não gerou nenhuma campanha. Escolha um produto, defina seu objetivo e deixe a IA fazer o trabalho pesado.
            </p>
            <div className="flex gap-4">
              <div className="flex items-center gap-3 text-sm font-medium text-zinc-400 bg-zinc-50 px-4 py-2 rounded-full border">
                <span className="flex items-center justify-center h-6 w-6 rounded-full bg-white text-zinc-900 border">1</span>
                Produto
              </div>
              <div className="flex items-center gap-3 text-sm font-medium text-zinc-400 bg-zinc-50 px-4 py-2 rounded-full border">
                <span className="flex items-center justify-center h-6 w-6 rounded-full bg-white text-zinc-900 border">2</span>
                Objetivo
              </div>
              <div className="flex items-center gap-3 text-sm font-medium text-zinc-400 bg-zinc-50 px-4 py-2 rounded-full border">
                <span className="flex items-center justify-center h-6 w-6 rounded-full bg-white text-zinc-900 border">3</span>
                Gerar
              </div>
            </div>
            <Link href="/campaigns/new" className="mt-8">
              <Button size="lg" className="rounded-full shadow-sm hover:shadow-md transition-all gap-2 px-8">
                Começar Agora <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-50/50 border-b border-zinc-100 text-zinc-500 font-medium">
                <tr>
                  <th className="px-6 py-4">Campanha</th>
                  <th className="px-6 py-4 hidden md:table-cell">Produto</th>
                  <th className="px-6 py-4">Criativos</th>
                  <th className="px-6 py-4 hidden sm:table-cell">Data</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {recentCampaigns.map((camp) => (
                  <tr key={camp.id} className="hover:bg-zinc-50/50 transition-colors group">
                    <td className="px-6 py-4 font-semibold text-zinc-900">{camp.name}</td>
                    <td className="px-6 py-4 hidden md:table-cell text-zinc-600 flex items-center gap-3">
                      <img src={camp.product.originalImageUrl} alt="" className="h-8 w-8 rounded object-cover border" />
                      {camp.product.name}
                    </td>
                    <td className="px-6 py-4 text-zinc-600">{camp._count.creatives} variações</td>
                    <td className="px-6 py-4 hidden sm:table-cell text-zinc-500">{dayjs(camp.createdAt).fromNow()}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(camp.status)}
                        {getStatusText(camp.status)}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link href={`/campaigns/${camp.id}`}>
                        <Button variant="ghost" size="sm" className="rounded-full group-hover:bg-zinc-200">
                          Ver Detalhes
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
