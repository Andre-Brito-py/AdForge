"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { buttonClass } from "./ui-bits";

export function DeleteButton({
  endpoint,
  redirectTo,
  label,
  confirmText,
}: {
  endpoint: string;
  redirectTo: string;
  label?: string;
  confirmText: string;
}) {
  const router = useRouter();
  const t = useTranslations("common");
  const [loading, setLoading] = useState(false);

  const run = async () => {
    if (!window.confirm(confirmText)) return;
    setLoading(true);
    const res = await fetch(endpoint, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setLoading(false);
      return toast.error(data.error || t("somethingWrong"));
    }
    toast.success(t("deleted"));
    router.push(redirectTo);
    router.refresh();
  };

  return (
    <button onClick={run} disabled={loading} className={buttonClass("ghost")}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
      {label || t("delete")}
    </button>
  );
}
