import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import { ArrowRight, Coins, Plus, TrendingDown, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import "dayjs/locale/pt-br";

dayjs.extend(relativeTime);
dayjs.locale("pt-br");

export default async function CreditsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const member = await db.workspaceMember.findFirst({
    where: { userId: session.user.id }
  });

  if (!member) redirect("/dashboard");

  const balance = await db.creditBalance.findUnique({
    where: { workspaceId: member.workspaceId }
  });

  const transactions = await db.creditTransaction.findMany({
    where: { workspaceId: member.workspaceId },
    orderBy: { createdAt: "desc" },
    take: 50
  });

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto space-y-12">
      
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-zinc-900">Seus Créditos</h1>
          <p className="text-zinc-500 mt-2 text-lg">Gerencie seu saldo e veja o histórico de consumo.</p>
        </div>
        <Link href="/billing">
          <Button size="lg" className="rounded-full shadow-sm bg-zinc-900 gap-2 h-12 px-6">
            <Plus className="h-5 w-5" /> Adicionar Créditos
          </Button>
        </Link>
      </header>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-1 bg-zinc-900 rounded-3xl p-8 text-white shadow-xl flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 h-48 w-48 bg-white opacity-5 rounded-full blur-2xl" />
          
          <div>
            <div className="h-12 w-12 rounded-full bg-white/10 flex items-center justify-center mb-6">
              <Coins className="h-6 w-6 text-white" />
            </div>
            <h3 className="text-zinc-400 font-medium uppercase tracking-wider text-sm">Saldo Disponível</h3>
            <p className="text-5xl font-extrabold mt-2 tracking-tight">
              {balance?.balance || 0} <span className="text-2xl text-zinc-500 font-medium">CR</span>
            </p>
          </div>
          
          <div className="mt-12 pt-6 border-t border-white/10">
            <Link href="/billing" className="text-sm font-semibold flex items-center gap-2 hover:text-zinc-300 transition-colors">
              Fazer Upgrade de Plano <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <div className="md:col-span-2 bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-zinc-100 flex justify-between items-center bg-zinc-50/50">
            <h2 className="text-lg font-bold text-zinc-900">Histórico de Transações</h2>
          </div>
          
          <div className="flex-1 overflow-y-auto max-h-[400px]">
            {transactions.length === 0 ? (
              <div className="p-12 text-center text-zinc-500">Nenhuma transação encontrada.</div>
            ) : (
              <ul className="divide-y divide-zinc-100">
                {transactions.map(tx => (
                  <li key={tx.id} className="p-6 flex items-center justify-between hover:bg-zinc-50/50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center ${tx.amount > 0 ? "bg-emerald-100" : "bg-red-100"}`}>
                        {tx.amount > 0 ? (
                          <TrendingUp className="h-5 w-5 text-emerald-600" />
                        ) : (
                          <TrendingDown className="h-5 w-5 text-red-600" />
                        )}
                      </div>
                      <div>
                        <p className="font-semibold text-zinc-900">
                          {tx.type === "CONSUME" ? "Geração de Criativo" : tx.type === "BONUS" ? "Bônus Promocional" : "Compra de Créditos"}
                        </p>
                        <p className="text-xs text-zinc-500 mt-1">{dayjs(tx.createdAt).format("DD MMM, YYYY • HH:mm")}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-bold text-lg ${tx.amount > 0 ? "text-emerald-600" : "text-zinc-900"}`}>
                        {tx.amount > 0 ? "+" : ""}{tx.amount} CR
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
