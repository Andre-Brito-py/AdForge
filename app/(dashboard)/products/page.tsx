import Link from "next/link";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { PlusCircle, PackageOpen, ArrowRight } from "lucide-react";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import "dayjs/locale/pt-br";

dayjs.extend(relativeTime);
dayjs.locale("pt-br");

export default async function ProductsPage() {
  const session = await getServerSession(authOptions);
  let products: any[] = [];

  if (session?.user) {
    const workspaceMember = await db.workspaceMember.findFirst({
      where: { userId: session.user.id }
    });
    
    if (workspaceMember) {
      products = await db.product.findMany({
        where: { workspaceId: workspaceMember.workspaceId },
        include: {
          campaigns: {
            include: { _count: { select: { creatives: true } } },
            orderBy: { createdAt: "desc" },
            take: 1
          }
        },
        orderBy: { createdAt: "desc" }
      });
    }
  }

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-12">
      
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-zinc-900">Biblioteca de Produtos</h1>
          <p className="text-zinc-500 mt-2 text-lg">Gerencie os produtos que você deseja anunciar.</p>
        </div>
        <Link href="/products/new">
          <Button size="lg" className="rounded-full shadow-sm hover:shadow-md transition-all gap-2 h-12 px-6">
            <PlusCircle className="h-5 w-5" />
            Adicionar Produto
          </Button>
        </Link>
      </header>

      {products.length === 0 ? (
        <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm p-12 text-center flex flex-col items-center">
          <div className="h-20 w-20 bg-zinc-50 rounded-full flex items-center justify-center mb-6">
            <PackageOpen className="h-8 w-8 text-zinc-400" />
          </div>
          <h3 className="text-xl font-bold text-zinc-900 mb-2">Você ainda não adicionou nenhum produto.</h3>
          <p className="text-zinc-500 max-w-md mx-auto mb-8">
            Para a Inteligência Artificial criar anúncios, ela precisa primeiro conhecer o seu produto.
          </p>
          <Link href="/products/new">
            <Button size="lg" className="rounded-full shadow-sm hover:shadow-md transition-all gap-2 px-8">
              Adicionar Meu Primeiro Produto <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6">
          {products.map((prod) => {
            const lastCampaign = prod.campaigns[0];
            const totalCreatives = prod.campaigns.reduce((acc: number, camp: any) => acc + camp._count.creatives, 0);

            return (
              <Link key={prod.id} href={`/products/${prod.id}`} className="group block bg-white rounded-3xl border border-zinc-200 overflow-hidden shadow-sm hover:shadow-md transition-all hover:-translate-y-1">
                <div className="aspect-[4/3] w-full bg-zinc-100 relative overflow-hidden">
                  <img 
                    src={prod.originalImageUrl} 
                    alt={prod.name} 
                    className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500"
                  />
                  {prod.category && (
                    <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-semibold text-zinc-700 shadow-sm">
                      {prod.category}
                    </div>
                  )}
                </div>
                <div className="p-6">
                  <h3 className="font-bold text-lg text-zinc-900 line-clamp-1">{prod.name}</h3>
                  
                  <div className="mt-4 pt-4 border-t border-zinc-100 flex items-center justify-between text-sm text-zinc-500">
                    <div>
                      <span className="block font-medium text-zinc-900">{totalCreatives}</span>
                      <span className="text-xs">Criativos</span>
                    </div>
                    <div className="text-right">
                      <span className="block font-medium text-zinc-900">
                        {lastCampaign ? dayjs(lastCampaign.createdAt).fromNow() : "Nenhuma"}
                      </span>
                      <span className="text-xs">Última Campanha</span>
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}

    </div>
  );
}
