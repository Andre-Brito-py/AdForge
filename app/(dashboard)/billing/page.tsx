import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Sparkles, ArrowRight, Wallet } from "lucide-react";
import Link from "next/link";
import { cookies } from "next/headers";

export default async function BillingPage() {
  const session = await getServerSession(authOptions);
  
  let balance = 0;
  if (session?.user) {
    const member = await db.workspaceMember.findFirst({
      where: { userId: session.user.id }
    });
    if (member) {
      const balanceRecord = await db.creditBalance.findUnique({ where: { workspaceId: member.workspaceId }});
      balance = balanceRecord?.balance || 0;
    }
  }

  const config = await db.systemConfig.findUnique({ where: { id: "global" } });
  
  // Planos Padrão Fallback
  let plans = [
    {
      id: "starter",
      name: "Starter",
      description: "Para pequenos negócios começando com tráfego pago.",
      price: "R$ 49",
      credits: 300,
      features: ["~100 Imagens", "Editor Básico", "Suporte Email"],
      isFeatured: false
    },
    {
      id: "growth",
      name: "Growth",
      description: "O plano ideal para quem já vende todos os dias.",
      price: "R$ 149",
      credits: 1000,
      features: ["~330 Imagens", "Variações em Lote", "Vídeos Curtos", "Prioridade na IA"],
      isFeatured: true
    },
    {
      id: "agency",
      name: "Agency",
      description: "Alto volume para agências e gestores de tráfego.",
      price: "R$ 399",
      credits: 3000,
      features: ["~1000 Imagens", "Vídeos Ilimitados", "Sem limite de Projetos", "API Access"],
      isFeatured: false
    }
  ];

  const cookieStore = cookies();
  const currency = cookieStore.get('CURRENCY')?.value || 'BRL';
  
  const currencySymbol = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : 'R$';

  if (config?.plansJson) {
    try {
      const parsed = JSON.parse(config.plansJson);
      plans = parsed.map((p: any) => {
        let priceValue = p.price_brl || p.price; // fallback for legacy
        if (currency === 'USD' && p.price_usd) priceValue = p.price_usd;
        if (currency === 'EUR' && p.price_eur) priceValue = p.price_eur;

        return {
          id: p.id,
          name: p.name,
          description: p.description || "O plano perfeito para impulsionar suas vendas com IA.",
          price: `${currencySymbol} ${priceValue}`,
          credits: p.credits,
          features: ["Geração de Copy Inclusa", "Estúdios Ilimitados", "Download em Alta Resolução"],
          isFeatured: p.isFeatured
        };
      });
    } catch(e) {}
  }

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-12">
      
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-zinc-900">Planos e Faturamento</h1>
          <p className="text-zinc-500 mt-2 text-lg">Faça upgrade para escalar suas campanhas.</p>
        </div>
        <Link href="/credits">
          <Button variant="outline" size="lg" className="rounded-full shadow-sm gap-2 h-12 px-6">
            <Wallet className="h-5 w-5" /> Ver Histórico de Uso
          </Button>
        </Link>
      </header>

      {/* Current Plan Indicator */}
      <div className="bg-zinc-900 rounded-3xl p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 h-48 w-48 bg-white opacity-5 rounded-full blur-2xl" />
        <div className="relative z-10">
          <span className="text-zinc-400 text-sm font-semibold uppercase tracking-wider block mb-2">Plano Atual</span>
          <h2 className="text-3xl font-bold">Plano Gratuito (Trial)</h2>
          <p className="text-zinc-400 mt-1">Seu saldo atual é de <strong className="text-white">{balance} CR</strong>.</p>
        </div>
        <div className="relative z-10">
          <Button variant="secondary" className="rounded-full px-8 bg-white text-zinc-900 hover:bg-zinc-100 h-12">
            Adicionar Método de Pagamento
          </Button>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-8 pt-8">
        {plans.map((plan) => (
          <div 
            key={plan.id} 
            className={`relative p-8 rounded-3xl border flex flex-col transition-all ${
              plan.isFeatured 
                ? "bg-zinc-900 border-zinc-900 text-white shadow-2xl scale-105 z-10" 
                : "bg-white border-zinc-200 shadow-sm"
            }`}
          >
            {plan.isFeatured && (
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-blue-500 text-white text-xs font-bold uppercase tracking-wider py-1 px-4 rounded-full shadow-md">
                Mais Popular
              </div>
            )}
            
            <div className="mb-6">
              <h3 className={`text-xl font-bold ${plan.isFeatured ? "text-white" : "text-zinc-900"}`}>{plan.name}</h3>
              <p className={`mt-2 text-sm ${plan.isFeatured ? "text-zinc-400" : "text-zinc-500"}`}>{plan.description}</p>
            </div>
            
            <div className="mb-8">
              <p className={`text-4xl font-extrabold tracking-tight ${plan.isFeatured ? "text-white" : "text-zinc-900"}`}>
                {plan.price} <span className={`text-base font-medium ${plan.isFeatured ? "text-zinc-400" : "text-zinc-500"}`}>/mês</span>
              </p>
              <div className={`mt-3 inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ${plan.isFeatured ? "bg-white/10 text-white" : "bg-zinc-100 text-zinc-700"}`}>
                <Sparkles className="mr-2 h-4 w-4" /> {plan.credits} Créditos inclusos
              </div>
            </div>
            
            <ul className="space-y-4 mb-8 flex-1">
              {plan.features.map((feature: string, idx: number) => (
                <li key={idx} className="flex items-start text-sm">
                  <CheckCircle2 className={`h-5 w-5 mr-3 shrink-0 ${plan.isFeatured ? "text-blue-400" : "text-zinc-900"}`} />
                  <span className={plan.isFeatured ? "text-zinc-300" : "text-zinc-600"}>{feature}</span>
                </li>
              ))}
            </ul>
            
            <Button 
              size="lg" 
              className={`w-full rounded-xl h-12 text-base ${
                plan.isFeatured 
                  ? "bg-white text-zinc-900 hover:bg-zinc-100" 
                  : "bg-zinc-900 text-white hover:bg-zinc-800"
              }`}
            >
              Assinar {plan.name} <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

    </div>
  );
}
