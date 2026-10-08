"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { Loader2, Users } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { buttonClass } from "@/components/app/ui-bits";

export const PENDING_INVITE_COOKIE = "vysify_invite";

function setPending(token: string | null) {
  document.cookie = token
    ? `${PENDING_INVITE_COOKIE}=${encodeURIComponent(token)}; path=/; max-age=${7 * 24 * 3600}; samesite=lax`
    : `${PENDING_INVITE_COOKIE}=; path=/; max-age=0; samesite=lax`;
}

/**
 * accept: botão de aceitar. remember: guarda o convite para depois do login/cadastro.
 * clear: convite inválido (esquece). signout: logado com outro e-mail.
 */
export function AcceptInvite({ token, mode }: { token: string; mode: "accept" | "remember" | "clear" | "signout" }) {
  const t = useTranslations("team.invitePage");
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (mode === "remember" || mode === "signout") setPending(token);
    if (mode === "clear") setPending(null);
  }, [mode, token]);

  if (mode === "clear" || mode === "remember") return null;
  if (mode === "signout") {
    return (
      <button onClick={() => signOut({ callbackUrl: `/login?from=${encodeURIComponent(`/invite/${token}`)}` })} className={`${buttonClass("outline", "lg")} w-full`}>
        {t("switchAccount")}
      </button>
    );
  }

  const accept = async () => {
    setLoading(true);
    const res = await fetch("/api/workspace/invites/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setLoading(false);
      return toast.error(data.error || t("error"));
    }
    setPending(null);
    toast.success(t("accepted", { workspace: data.workspace?.name || "" }));
    router.replace("/dashboard");
    router.refresh();
  };

  return (
    <button onClick={accept} disabled={loading} className={`${buttonClass("brand", "lg")} w-full`}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />} {t("accept")}
    </button>
  );
}
