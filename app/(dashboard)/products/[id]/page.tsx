import Link from "next/link";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { ArrowLeft, PlusCircle, Tag, Target, DollarSign, LayoutGrid } from "lucide-react";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import "dayjs/locale/pt-br";

dayjs.extend(relativeTime);
dayjs.locale("pt-br");

export default async function ProductDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  const product = await db.product.findUnique({
    where: { id: params.id },
    include: {
      campaigns: {
        include: { creatives: true },
        orderBy: { createdAt: "desc" }
      }
    }
  });

  if (!product) {
    return (
      <div className="p-10 text-center">
        <h1 className="text-2xl font-bold">Produto não encontrado</h1>
        <Link href="/products" className="text-blue-500 mt-4 inline-block">Voltar</Link>
      </div>
    );
  }

  const totalCreatives = product.campaigns.reduce((acc: number, camp: any) => acc + camp.creatives.length, 0);

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-8">
      <header>
        <Link href="/products" className="inline-flex items-center text-sm font-medium text-zinc-500 hover:text-zinc-900 mb-6 transition-colors">
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para Biblioteca
        </Link>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h1 className="text-4xl font-extrabold tracking-tight text-zinc-900">{product.name}</h1>
          <Link href={`/campaigns/new?productId=${product.id}`}>
            <Button size="lg" className="rounded-full shadow-sm hover:shadow-md transition-all gap-2 h-12 px-6">
              <PlusCircle className="h-5 w-5" />
              Nova Campanha
            </Button>
          </Link>
        </div>
      </header>

      <div className="grid md:grid-cols-3 gap-8">
        
        {/* Coluna da Esquerda: Imagem e Ficha Técnica */}
        <div className="space-y-6">
          <div className="bg-white p-2 rounded-3xl border border-zinc-200 shadow-sm">
            <div className="aspect-[4/3] w-full bg-zinc-100 rounded-2xl overflow-hidden">
              <img src={product.originalImageUrl} alt={product.name} className="object-cover w-full h-full" />
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm space-y-4">
            <h3 className="font-bold text-lg text-zinc-900 border-b border-zinc-100 pb-3">Ficha Técnica</h3>
            
            {product.description && (
              <div>
                <span className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">Descrição</span>
                <p className="text-sm text-zinc-700">{product.description}</p>
              </div>
            )}
            
            <div className="grid grid-cols-2 gap-4 pt-2">
              {product.category && (
                <div>
                  <span className="flex items-center gap-1 text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">
                    <Tag className="h-3 w-3" /> Categoria
                  </span>
                  <p className="text-sm font-medium text-zinc-900">{product.category}</p>
                </div>
              )}
              {product.brandName && (
                <div>
                  <span className="flex items-center gap-1 text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">
                    <Tag className="h-3 w-3" /> Marca
                  </span>
                  <p className="text-sm font-medium text-zinc-900">{product.brandName}</p>
                </div>
              )}
              {product.targetAudience && (
                <div className="col-span-2">
                  <span className="flex items-center gap-1 text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">
                    <Target className="h-3 w-3" /> Público-Alvo
                  </span>
                  <p className="text-sm font-medium text-zinc-900">{product.targetAudience}</p>
                </div>
              )}
              {product.price && (
                <div className="col-span-2">
                  <span className="flex items-center gap-1 text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">
                    <DollarSign className="h-3 w-3" /> Preço Base
                  </span>
                  <p className="text-sm font-medium text-zinc-900">R$ {product.price.toFixed(2)}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Coluna da Direita: Campanhas */}
        <div className="md:col-span-2 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm">
              <h3 className="font-semibold text-sm uppercase tracking-wider text-zinc-500">Campanhas</h3>
              <p className="text-4xl font-extrabold mt-2 text-zinc-900 tracking-tight">{product.campaigns.length}</p>
            </div>
            <div className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm">
              <h3 className="font-semibold text-sm uppercase tracking-wider text-zinc-500">Criativos</h3>
              <p className="text-4xl font-extrabold mt-2 text-zinc-900 tracking-tight">{totalCreatives}</p>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-zinc-100">
              <h2 className="text-xl font-bold text-zinc-900">Campanhas Relacionadas</h2>
            </div>
            
            {product.campaigns.length === 0 ? (
              <div className="p-12 text-center flex flex-col items-center">
                <div className="h-16 w-16 bg-zinc-50 rounded-full flex items-center justify-center mb-4">
                  <LayoutGrid className="h-6 w-6 text-zinc-400" />
                </div>
                <h3 className="text-lg font-bold text-zinc-900 mb-2">Nenhuma campanha criada</h3>
                <p className="text-sm text-zinc-500 max-w-sm mx-auto mb-6">
                  Comece gerando a primeira campanha para este produto.
                </p>
                <Link href={`/campaigns/new?productId=${product.id}`}>
                  <Button className="rounded-full shadow-sm">Criar Primeira Campanha</Button>
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-zinc-100">
                {product.campaigns.map((camp: any) => (
                  <Link key={camp.id} href={`/campaigns/${camp.id}`} className="flex items-center justify-between p-6 hover:bg-zinc-50/50 transition-colors group">
                    <div>
                      <h4 className="font-bold text-zinc-900 group-hover:text-zinc-600 transition-colors">{camp.name}</h4>
                      <p className="text-sm text-zinc-500 mt-1">Criada {dayjs(camp.createdAt).fromNow()} • {camp.objective}</p>
                    </div>
                    <div className="text-right">
                      <span className="block font-bold text-zinc-900">{camp.creatives.length}</span>
                      <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Criativos</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
