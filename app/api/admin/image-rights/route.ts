import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { handler } from "@/lib/api";
import { requireApiAdmin } from "@/lib/auth";
import { toCsv } from "@/lib/csv";

const PAGE_SIZE = 25;

/**
 * Registros de declaração de autorização de imagem (prova para defesa em processos e pedidos de autoridades).
 * Acesso só do super admin; cada consulta fica no log do servidor (quem consultou e o filtro usado).
 */
export const GET = handler(async (request: Request) => {
  const admin = await requireApiAdmin();
  const params = new URL(request.url).searchParams;
  const q = params.get("q")?.trim().slice(0, 100) || "";
  const page = Math.max(1, Math.min(1000, Number(params.get("page")) || 1));
  const csv = params.get("format") === "csv";

  const where: Prisma.ImageRightsRecordWhereInput = q
    ? {
        OR: [
          { userEmail: { contains: q, mode: "insensitive" } },
          { userName: { contains: q, mode: "insensitive" } },
          { campaignName: { contains: q, mode: "insensitive" } },
          { campaignId: q },
          { id: q },
        ],
      }
    : {};

  console.info(`[admin] registros de autorização de imagem consultados por ${admin.email} (filtro: "${q}", ${csv ? "CSV" : `página ${page}`})`);

  if (csv) {
    const rows = await db.imageRightsRecord.findMany({ where, orderBy: { createdAt: "desc" }, take: 5000 });
    const body = toCsv(
      ["id", "data_hora_utc", "email", "nome", "campanha", "campanha_id", "versao_declaracao", "texto_declarado", "idioma", "ip", "navegador", "imagens", "sha256"],
      rows.map((r) => [
        r.id, r.createdAt.toISOString(), r.userEmail, r.userName || "", r.campaignName || "", r.campaignId || "", r.declarationVersion,
        r.declarationText, r.locale, r.ipAddress || "", r.userAgent || "", (JSON.parse(r.imageUrls) as string[]).join(" | "), (JSON.parse(r.imageHashes) as string[]).join(" | "),
      ])
    );
    const stamp = new Date().toISOString().slice(0, 10);
    return new NextResponse(body, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="vysify-autorizacoes-de-imagem-${stamp}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const [total, rows] = await Promise.all([
    db.imageRightsRecord.count({ where }),
    db.imageRightsRecord.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
  ]);

  // A campanha ainda existe? (o registro continua valendo mesmo se ela ou a conta forem apagadas)
  const ids = rows.map((r) => r.campaignId).filter((x): x is string => !!x);
  const alive = new Set((await db.campaign.findMany({ where: { id: { in: ids } }, select: { id: true } })).map((c) => c.id));
  const users = new Set((await db.user.findMany({ where: { id: { in: rows.map((r) => r.userId).filter((x): x is string => !!x) } }, select: { id: true } })).map((u) => u.id));

  return NextResponse.json({
    total,
    page,
    pageSize: PAGE_SIZE,
    items: rows.map((r) => ({
      ...r,
      imageUrls: JSON.parse(r.imageUrls) as string[],
      imageHashes: JSON.parse(r.imageHashes) as string[],
      campaignExists: !!r.campaignId && alive.has(r.campaignId),
      accountExists: !!r.userId && users.has(r.userId),
    })),
  });
});
