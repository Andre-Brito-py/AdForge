import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handler } from "@/lib/api";
import { requireApiAdmin } from "@/lib/auth";

// Métricas reais da plataforma (substitui os números fixos do painel antigo).
export const GET = handler(async () => {
  await requireApiAdmin();
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [users, newUsers, campaigns, creatives, failedJobs, revenue, revenue30, aiCost30] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { createdAt: { gte: since } } }),
    db.campaign.count(),
    db.creative.count({ where: { type: { in: ["IMAGE", "VIDEO"] }, status: "COMPLETED" } }),
    db.generationJob.count({ where: { status: "FAILED", createdAt: { gte: since } } }),
    db.payment.groupBy({ by: ["currency"], _sum: { amount: true }, _count: true }),
    db.payment.groupBy({ by: ["currency"], where: { createdAt: { gte: since } }, _sum: { amount: true }, _count: true }),
    db.usageRecord.aggregate({ where: { createdAt: { gte: since } }, _sum: { estimatedCost: true } }),
  ]);

  const recentPayments = await db.payment.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
    include: { user: { select: { email: true } } },
  });

  return NextResponse.json({
    users,
    newUsers30d: newUsers,
    campaigns,
    creatives,
    failedJobs30d: failedJobs,
    revenue: revenue.map((r) => ({ currency: r.currency, total: r._sum.amount || 0, count: r._count })),
    revenue30d: revenue30.map((r) => ({ currency: r.currency, total: r._sum.amount || 0, count: r._count })),
    estimatedAiCostUsd30d: aiCost30._sum.estimatedCost || 0,
    recentPayments: recentPayments.map((p) => ({
      id: p.id, provider: p.provider, amount: p.amount, currency: p.currency, credits: p.credits,
      createdAt: p.createdAt, email: p.user?.email || "(conta excluída)",
    })),
  });
});
