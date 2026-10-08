import { db } from "./db";

/**
 * Papéis no workspace:
 * - OWNER: quem criou (um por workspace). Tudo, inclusive mudar papéis.
 * - ADMIN: compra créditos/assinatura, convida e remove membros, Brand Kit e integrações.
 * - MEMBER: produtos, campanhas (gasta os créditos do workspace) e publicações.
 */
export type WorkspaceRole = "OWNER" | "ADMIN" | "MEMBER";
export const WORKSPACE_ROLES: WorkspaceRole[] = ["OWNER", "ADMIN", "MEMBER"];

export function normalizeRole(role: string | null | undefined): WorkspaceRole {
  return role === "OWNER" || role === "ADMIN" ? role : "MEMBER";
}

export const canManageBilling = (role: string | null | undefined) => normalizeRole(role) !== "MEMBER";
export const canManageMembers = (role: string | null | undefined) => normalizeRole(role) !== "MEMBER";
export const canManageSettings = (role: string | null | undefined) => normalizeRole(role) !== "MEMBER";

/** Membros por workspace (padrão; o admin muda em Admin › Configurações gerais). */
export const DEFAULT_MAX_MEMBERS = 5;

/**
 * Workspace em uso: o escolhido no menu (se a pessoa ainda for membro) ou o mais antigo.
 * Devolve também o papel dela nele.
 */
export async function resolveWorkspace(userId: string, activeWorkspaceId?: string | null): Promise<{ workspaceId: string; role: WorkspaceRole } | null> {
  if (activeWorkspaceId) {
    const active = await db.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId, workspaceId: activeWorkspaceId } },
      select: { workspaceId: true, role: true },
    });
    if (active) return { workspaceId: active.workspaceId, role: normalizeRole(active.role) };
  }
  const first = await db.workspaceMember.findFirst({ where: { userId }, orderBy: { createdAt: "asc" }, select: { workspaceId: true, role: true } });
  return first ? { workspaceId: first.workspaceId, role: normalizeRole(first.role) } : null;
}

/** Workspaces da pessoa (para o seletor no menu). */
export async function listUserWorkspaces(userId: string) {
  const rows = await db.workspaceMember.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: { role: true, workspace: { select: { id: true, name: true, _count: { select: { members: true } } } } },
  });
  return rows.map((r) => ({ id: r.workspace.id, name: r.workspace.name, role: normalizeRole(r.role), members: r.workspace._count.members }));
}
