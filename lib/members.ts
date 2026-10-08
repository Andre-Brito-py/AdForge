import { db } from "./db";
import { HttpError } from "./api";
import { getAppConfig } from "./config";
import { generateToken, hashToken } from "./crypto";
import { canManageMembers, normalizeRole, type WorkspaceRole } from "./workspaces";
import { sendInviteEmail } from "@/services/email";
import type { SessionUser } from "./auth";

const INVITE_TTL_MS = 7 * 24 * 60 * 60_000;

function assertManager(user: SessionUser) {
  if (!canManageMembers(user.workspaceRole)) throw new HttpError(403, "errors.forbidden", "FORBIDDEN");
}

export async function listTeam(workspaceId: string) {
  const [workspace, members, invites] = await Promise.all([
    db.workspace.findUnique({ where: { id: workspaceId }, select: { id: true, name: true } }),
    db.workspaceMember.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "asc" },
      select: { role: true, createdAt: true, user: { select: { id: true, name: true, email: true, image: true } } },
    }),
    db.workspaceInvite.findMany({
      where: { workspaceId, acceptedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
      select: { id: true, email: true, role: true, expiresAt: true, createdAt: true },
    }),
  ]);
  const { settings } = await getAppConfig();
  return {
    workspace,
    maxMembers: settings.maxMembers,
    members: members.map((m) => ({ ...m.user, role: normalizeRole(m.role), joinedAt: m.createdAt })),
    invites,
  };
}

export async function inviteMember(user: SessionUser, emailRaw: string, role: WorkspaceRole) {
  assertManager(user);
  // Só o dono cria outros administradores.
  if (role === "OWNER" || (role === "ADMIN" && user.workspaceRole !== "OWNER")) throw new HttpError(403, "errors.forbidden", "FORBIDDEN");
  const email = emailRaw.trim().toLowerCase();

  const [members, pending, workspace, { settings }] = await Promise.all([
    db.workspaceMember.findMany({ where: { workspaceId: user.workspaceId }, select: { user: { select: { email: true } } } }),
    db.workspaceInvite.count({ where: { workspaceId: user.workspaceId, acceptedAt: null, expiresAt: { gt: new Date() }, email: { not: email } } }),
    db.workspace.findUniqueOrThrow({ where: { id: user.workspaceId }, select: { name: true } }),
    getAppConfig(),
  ]);
  if (members.some((m) => m.user.email.toLowerCase() === email)) throw new HttpError(409, "errors.team.alreadyMember", "ALREADY_MEMBER");
  if (members.length + pending + 1 > settings.maxMembers) {
    throw new HttpError(400, "errors.team.limit", "TEAM_LIMIT", { max: settings.maxMembers });
  }

  // Um convite ativo por e-mail: reenviar troca o link (o antigo deixa de valer).
  await db.workspaceInvite.deleteMany({ where: { workspaceId: user.workspaceId, email, acceptedAt: null } });
  const { token, tokenHash } = generateToken();
  const invite = await db.workspaceInvite.create({
    data: { workspaceId: user.workspaceId, email, role, tokenHash, invitedById: user.id, expiresAt: new Date(Date.now() + INVITE_TTL_MS) },
  });
  const invitee = await db.user.findUnique({ where: { email }, select: { locale: true } });
  await sendInviteEmail(email, user.name || user.email, workspace.name, token, invitee?.locale ?? user.locale);
  return invite;
}

export async function cancelInvite(user: SessionUser, inviteId: string) {
  assertManager(user);
  await db.workspaceInvite.deleteMany({ where: { id: inviteId, workspaceId: user.workspaceId, acceptedAt: null } });
}

/** Convite pelo link do e-mail (para a tela de aceite). Nulo se não existir, já usado ou vencido. */
export async function findInvite(token: string) {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return null;
  const invite = await db.workspaceInvite.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { workspace: { select: { id: true, name: true } } },
  });
  if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) return null;
  const inviter = invite.invitedById ? await db.user.findUnique({ where: { id: invite.invitedById }, select: { name: true, email: true } }) : null;
  return { ...invite, inviterName: inviter?.name || inviter?.email || null };
}

/**
 * Aceita o convite. O e-mail da conta precisa ser o convidado (um link vazado não serve para outra pessoa).
 * A pessoa passa a usar o workspace novo na hora (e pode voltar ao dela pelo menu).
 */
export async function acceptInvite(user: SessionUser, token: string) {
  const invite = await findInvite(token);
  if (!invite) throw new HttpError(404, "errors.team.inviteInvalid", "INVITE_INVALID");
  if (invite.email.toLowerCase() !== user.email.toLowerCase()) {
    throw new HttpError(403, "errors.team.inviteOtherEmail", "INVITE_OTHER_EMAIL", { email: invite.email });
  }
  const { settings } = await getAppConfig();
  await db.$transaction(async (tx) => {
    const count = await tx.workspaceMember.count({ where: { workspaceId: invite.workspaceId } });
    const already = await tx.workspaceMember.findUnique({ where: { userId_workspaceId: { userId: user.id, workspaceId: invite.workspaceId } } });
    if (!already && count >= settings.maxMembers) throw new HttpError(400, "errors.team.limit", "TEAM_LIMIT", { max: settings.maxMembers });
    if (!already) await tx.workspaceMember.create({ data: { userId: user.id, workspaceId: invite.workspaceId, role: normalizeRole(invite.role) === "ADMIN" ? "ADMIN" : "MEMBER" } });
    await tx.workspaceInvite.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } });
    await tx.user.update({ where: { id: user.id }, data: { activeWorkspaceId: invite.workspaceId } });
  });
  return invite.workspace;
}

export async function changeRole(user: SessionUser, targetUserId: string, role: WorkspaceRole) {
  if (user.workspaceRole !== "OWNER") throw new HttpError(403, "errors.forbidden", "FORBIDDEN");
  if (targetUserId === user.id || role === "OWNER") throw new HttpError(400, "errors.team.cantChangeOwner");
  const updated = await db.workspaceMember.updateMany({
    where: { workspaceId: user.workspaceId, userId: targetUserId, role: { not: "OWNER" } },
    data: { role },
  });
  if (updated.count === 0) throw new HttpError(404, "errors.team.memberNotFound");
}

/** Remove alguém (dono/admin) ou sai do workspace (qualquer membro, menos o dono). */
export async function removeMember(user: SessionUser, targetUserId: string) {
  const target = await db.workspaceMember.findUnique({ where: { userId_workspaceId: { userId: targetUserId, workspaceId: user.workspaceId } } });
  if (!target) throw new HttpError(404, "errors.team.memberNotFound");
  const leaving = targetUserId === user.id;
  if (normalizeRole(target.role) === "OWNER") throw new HttpError(400, "errors.team.cantRemoveOwner");
  if (!leaving) {
    assertManager(user);
    // Admin não remove outro admin: só o dono.
    if (normalizeRole(target.role) === "ADMIN" && user.workspaceRole !== "OWNER") throw new HttpError(403, "errors.forbidden", "FORBIDDEN");
  }
  await db.$transaction([
    db.workspaceMember.delete({ where: { id: target.id } }),
    // Quem sai volta para o próprio workspace no próximo acesso.
    db.user.updateMany({ where: { id: targetUserId, activeWorkspaceId: user.workspaceId }, data: { activeWorkspaceId: null } }),
  ]);
}

export async function switchWorkspace(userId: string, workspaceId: string) {
  const member = await db.workspaceMember.findUnique({ where: { userId_workspaceId: { userId, workspaceId } } });
  if (!member) throw new HttpError(404, "errors.team.memberNotFound");
  await db.user.update({ where: { id: userId }, data: { activeWorkspaceId: workspaceId } });
}

export async function renameWorkspace(user: SessionUser, name: string) {
  assertManager(user);
  await db.workspace.update({ where: { id: user.workspaceId }, data: { name: name.trim().slice(0, 80) } });
}
