// Promove uma conta existente a SUPERADMIN (substitui o antigo login de admin "hardcoded").
// Uso: crie a conta normalmente pelo site e depois rode:
//   npm run admin:promote -- seu@email.com
import { PrismaClient } from "@prisma/client";

const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  console.error("Uso: npm run admin:promote -- email@dominio.com");
  process.exit(1);
}

const db = new PrismaClient();
try {
  const user = await db.user.update({ where: { email }, data: { role: "SUPERADMIN", sessionVersion: { increment: 1 } } });
  console.log(`✔ ${user.email} agora é SUPERADMIN. Faça login novamente para ver o painel Admin.`);
} catch {
  console.error(`✖ Nenhuma conta encontrada com o e-mail ${email}. Crie a conta pelo site primeiro.`);
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
