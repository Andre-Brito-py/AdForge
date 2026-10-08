"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LogOut, Mail, Pencil, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { useFormatter, useTranslations } from "next-intl";
import { buttonClass } from "@/components/app/ui-bits";

type Role = "OWNER" | "ADMIN" | "MEMBER";
interface Team {
  workspace: { id: string; name: string } | null;
  maxMembers: number;
  members: { id: string; name: string | null; email: string; role: Role; joinedAt: string }[];
  invites: { id: string; email: string; role: Role; expiresAt: string }[];
}

async function call(url: string, method: string, body?: unknown) {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Erro");
  return data;
}

export function TeamClient({ meId, myRole, emailVerified }: { meId: string; myRole: Role; emailVerified: boolean }) {
  const t = useTranslations("team");
  const format = useFormatter();
  const router = useRouter();
  const [team, setTeam] = useState<Team | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"MEMBER" | "ADMIN">("MEMBER");
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState<string | null>(null);
  const manager = myRole !== "MEMBER";

  const load = useCallback(() => call("/api/workspace/members", "GET").then(setTeam).catch((e) => toast.error(e.message)), []);
  useEffect(() => { load(); }, [load]);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!team) return <div className="surface flex h-40 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  const seats = team.members.length + team.invites.length;
  const roleLabel = (r: Role) => t(`roles.${r}`);

  return (
    <div className="space-y-6">
      <section className="surface space-y-3 p-5 sm:p-6">
        {name === null ? (
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-muted-foreground">{t("workspace")}</p>
              <p className="truncate text-lg font-semibold">{team.workspace?.name}</p>
            </div>
            {manager && <button onClick={() => setName(team.workspace?.name || "")} className={buttonClass("ghost", "sm")}><Pencil className="h-3.5 w-3.5" /> {t("rename")}</button>}
          </div>
        ) : (
          <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); run(() => call("/api/workspace", "PATCH", { name }), t("renamed")).then(() => { setName(null); router.refresh(); }); }}>
            <div className="min-w-0 flex-1 space-y-1.5">
              <label htmlFor="ws-name" className="label-base">{t("workspace")}</label>
              <input id="ws-name" className="input-base" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
            </div>
            <button type="submit" disabled={busy || name.trim().length < 2} className={buttonClass("brand")}>{t("save")}</button>
            <button type="button" onClick={() => setName(null)} className={buttonClass("ghost")}>{t("cancel")}</button>
          </form>
        )}
        <p className="text-sm text-muted-foreground">{t("sharedCredits")}</p>
      </section>

      {manager && (
        <section className="surface space-y-4 p-5 sm:p-6">
          <div>
            <h2 className="font-semibold">{t("inviteTitle")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("inviteText", { used: seats, max: team.maxMembers })}</p>
          </div>
          <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => {
            e.preventDefault();
            run(() => call("/api/workspace/members", "POST", { email, role }), t("invited", { email })).then(() => setEmail(""));
          }}>
            <div className="min-w-0 flex-1 space-y-1.5">
              <label htmlFor="invite-email" className="label-base">{t("email")}</label>
              <input id="invite-email" type="email" required className="input-base" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nome@empresa.com" />
            </div>
            <div className="w-40 space-y-1.5">
              <label htmlFor="invite-role" className="label-base">{t("role")}</label>
              <select id="invite-role" className="input-base" value={role} onChange={(e) => setRole(e.target.value as "MEMBER" | "ADMIN")}>
                <option value="MEMBER">{roleLabel("MEMBER")}</option>
                {myRole === "OWNER" && <option value="ADMIN">{roleLabel("ADMIN")}</option>}
              </select>
            </div>
            <button type="submit" disabled={busy || !emailVerified || seats >= team.maxMembers} className={buttonClass("brand")}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} {t("invite")}
            </button>
          </form>
          {!emailVerified && <p className="text-xs text-warning">{t("verifyFirst")}</p>}
          <p className="text-xs text-muted-foreground">{t("rolesHelp")}</p>
        </section>
      )}

      <section className="surface overflow-hidden">
        <h2 className="border-b border-border px-5 py-3 font-semibold">{t("members")}</h2>
        <ul className="divide-y divide-border">
          {team.members.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-sm font-semibold text-brand">{(m.name || m.email).slice(0, 1).toUpperCase()}</div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{m.name || m.email}{m.id === meId ? ` (${t("you")})` : ""}</p>
                <p className="truncate text-xs text-muted-foreground">{m.email} · {t("since", { date: format.dateTime(new Date(m.joinedAt), { dateStyle: "medium" }) })}</p>
              </div>
              {myRole === "OWNER" && m.role !== "OWNER" ? (
                <select aria-label={t("role")} className="input-base h-9 w-36 text-sm" value={m.role} disabled={busy}
                  onChange={(e) => run(() => call(`/api/workspace/members/${m.id}`, "PATCH", { role: e.target.value }), t("roleChanged"))}>
                  <option value="MEMBER">{roleLabel("MEMBER")}</option>
                  <option value="ADMIN">{roleLabel("ADMIN")}</option>
                </select>
              ) : (
                <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">{roleLabel(m.role)}</span>
              )}
              {m.id === meId && m.role !== "OWNER" && (
                <button disabled={busy} className={buttonClass("ghost", "sm")}
                  onClick={() => confirm(t("leaveConfirm")) && run(() => call(`/api/workspace/members/${m.id}`, "DELETE"), t("left")).then(() => { router.push("/dashboard"); router.refresh(); })}>
                  <LogOut className="h-3.5 w-3.5" /> {t("leave")}
                </button>
              )}
              {m.id !== meId && m.role !== "OWNER" && manager && (myRole === "OWNER" || m.role === "MEMBER") && (
                <button disabled={busy} aria-label={t("remove")} className={buttonClass("ghost", "sm")}
                  onClick={() => confirm(t("removeConfirm", { name: m.name || m.email })) && run(() => call(`/api/workspace/members/${m.id}`, "DELETE"), t("removed"))}>
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          ))}
          {team.invites.map((i) => (
            <li key={i.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-muted-foreground">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted"><Mail className="h-4 w-4" /></div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{i.email}</p>
                <p className="text-xs">{t("pending", { date: format.dateTime(new Date(i.expiresAt), { dateStyle: "medium" }) })} · {roleLabel(i.role)}</p>
              </div>
              {manager && (
                <>
                  <button disabled={busy} className={buttonClass("ghost", "sm")} onClick={() => run(() => call("/api/workspace/members", "POST", { email: i.email, role: i.role === "ADMIN" ? "ADMIN" : "MEMBER" }), t("resent"))}>{t("resend")}</button>
                  <button disabled={busy} aria-label={t("cancelInvite")} className={buttonClass("ghost", "sm")} onClick={() => run(() => call(`/api/workspace/invites/${i.id}`, "DELETE"), t("inviteCanceled"))}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
