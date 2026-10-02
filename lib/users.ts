import { db } from "./db";
import { getAppConfig } from "./config";

/**
 * Cria usuário + workspace + saldo inicial numa única transação,
 * para nunca existir usuário "órfão" sem workspace.
 */
export async function createUserWithWorkspace(data: {
  email: string;
  name: string;
  passwordHash?: string | null;
  image?: string | null;
  emailVerified?: Date | null;
  locale?: "pt" | "en";
  country?: string | null;
}) {
  const { signupCredits } = await getAppConfig();
  const locale = data.locale || "pt";

  return db.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: data.email,
        name: data.name,
        image: data.image ?? null,
        passwordHash: data.passwordHash ?? null,
        emailVerified: data.emailVerified ?? null,
        locale,
        country: data.country ?? null,
      },
    });
    const workspace = await tx.workspace.create({
      data: {
        name: locale === "en" ? `${data.name}'s workspace` : `Workspace de ${data.name}`,
        creditBalance: { create: { balance: signupCredits, userId: user.id } },
      },
    });
    await tx.workspaceMember.create({ data: { userId: user.id, workspaceId: workspace.id, role: "OWNER" } });
    if (signupCredits > 0) {
      await tx.creditTransaction.create({
        data: {
          userId: user.id,
          workspaceId: workspace.id,
          amount: signupCredits,
          type: "BONUS",
          description: locale === "en" ? "Welcome credits" : "Créditos de boas-vindas",
        },
      });
    }
    return { user, workspaceId: workspace.id };
  });
}

export async function getWorkspaceIdForUser(userId: string): Promise<string | null> {
  const member = await db.workspaceMember.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: { workspaceId: true },
  });
  return member?.workspaceId ?? null;
}
