/**
 * Integração (equipe e assinaturas): precisa de TEST_DATABASE_URL com as migrations aplicadas.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";

const url = process.env.TEST_DATABASE_URL;
const sentInvites: { to: string; token: string }[] = [];
vi.mock("@/services/email", () => ({
  sendPurchaseReceipt: vi.fn(async () => {}),
  sendWelcomeEmail: vi.fn(async () => {}),
  sendAdminAlertEmail: vi.fn(async () => {}),
  sendInviteEmail: vi.fn(async (to: string, _i: string, _w: string, token: string) => { sentInvites.push({ to, token }); }),
  appUrl: () => "http://localhost:3000",
}));

describe.skipIf(!url)("equipe e assinaturas", async () => {
  const { db } = await import("@/lib/db");
  const { createUserWithWorkspace } = await import("@/lib/users");
  const { acceptInvite, changeRole, inviteMember, listTeam, removeMember, switchWorkspace } = await import("@/lib/members");
  const { resolveWorkspace } = await import("@/lib/workspaces");
  const { handleInvoicePaid, syncSubscription, activeSubscription } = await import("@/lib/subscriptions");
  const { getWorkspaceBalance } = await import("@/services/credits");

  const stamp = Date.now();
  const emails = { owner: `dono-${stamp}@exemplo.com`, guest: `convidado-${stamp}@exemplo.com`, other: `outro-${stamp}@exemplo.com` };
  const ids: Record<string, { userId: string; workspaceId: string }> = {};

  // Usuário de sessão mínimo (o que as funções usam).
  const session = async (key: keyof typeof emails) => {
    const u = await db.user.findUniqueOrThrow({ where: { id: ids[key].userId } });
    const ws = await resolveWorkspace(u.id, u.activeWorkspaceId);
    return { ...u, workspaceId: ws!.workspaceId, workspaceRole: ws!.role, hasPassword: false, isAdmin: false } as never;
  };

  beforeAll(async () => {
    for (const key of Object.keys(emails) as (keyof typeof emails)[]) {
      const { user, workspaceId } = await createUserWithWorkspace({ email: emails[key], name: key });
      ids[key] = { userId: user.id, workspaceId };
    }
  });

  afterAll(async () => {
    const wsIds = Object.values(ids).map((i) => i.workspaceId);
    await db.payment.deleteMany({ where: { workspaceId: { in: wsIds } } });
    await db.workspace.deleteMany({ where: { id: { in: wsIds } } });
    await db.user.deleteMany({ where: { id: { in: Object.values(ids).map((i) => i.userId) } } });
    await db.$disconnect();
  });

  it("convite só pode ser aceito pelo e-mail convidado e troca o workspace em uso", async () => {
    const owner = await session("owner");
    await inviteMember(owner, emails.guest, "MEMBER");
    const { token } = sentInvites.find((s) => s.to === emails.guest)!;

    await expect(acceptInvite(await session("other"), token)).rejects.toMatchObject({ code: "INVITE_OTHER_EMAIL" });
    await acceptInvite(await session("guest"), token);

    const guest = await session("guest");
    expect((guest as { workspaceId: string }).workspaceId).toBe(ids.owner.workspaceId);
    expect((guest as { workspaceRole: string }).workspaceRole).toBe("MEMBER");
    // O link não vale de novo.
    await expect(acceptInvite(guest, token)).rejects.toMatchObject({ code: "INVITE_INVALID" });
    expect((await listTeam(ids.owner.workspaceId)).members).toHaveLength(2);
  });

  it("membro não convida; só o dono muda papéis; ninguém remove o dono", async () => {
    const guest = await session("guest");
    await expect(inviteMember(guest, emails.other, "MEMBER")).rejects.toMatchObject({ status: 403 });
    await expect(removeMember(guest, ids.owner.userId)).rejects.toBeTruthy();
    const owner = await session("owner");
    await changeRole(owner, ids.guest.userId, "ADMIN");
    expect(((await session("guest")) as { workspaceRole: string }).workspaceRole).toBe("ADMIN");
  });

  it("quem sai volta para o próprio workspace", async () => {
    await switchWorkspace(ids.guest.userId, ids.owner.workspaceId);
    await removeMember(await session("guest"), ids.guest.userId);
    expect(((await session("guest")) as { workspaceId: string }).workspaceId).toBe(ids.guest.workspaceId);
  });

  it("cada fatura paga da assinatura credita uma vez", async () => {
    const sub = {
      id: `sub_${stamp}`, customer: `cus_${stamp}`, status: "active", cancel_at_period_end: false, currency: "usd",
      metadata: { workspaceId: ids.owner.workspaceId, userId: ids.owner.userId, planId: "pro", planName: "Pro", credits: "500" },
      items: { data: [{ current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400, price: { currency: "usd", unit_amount: 2000 } }] },
    } as unknown as Stripe.Subscription;
    await syncSubscription(sub);
    expect((await activeSubscription(ids.owner.workspaceId))?.creditsPerPeriod).toBe(500);

    const stripe = { subscriptions: { retrieve: async () => sub } } as unknown as Stripe;
    const invoice = {
      id: `in_${stamp}`, amount_paid: 2000, currency: "usd", customer_name: "Dono", customer_tax_ids: [], customer_address: { country: "BR" },
      total_discount_amounts: [], parent: { subscription_details: { subscription: sub.id } },
    } as unknown as Stripe.Invoice;
    const before = await getWorkspaceBalance(ids.owner.workspaceId);
    expect(await handleInvoicePaid(stripe, invoice)).toBe("credited");
    expect(await handleInvoicePaid(stripe, invoice)).toBe("duplicate");
    expect(await getWorkspaceBalance(ids.owner.workspaceId)).toBe(before + 500);
  });
});
