"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { buttonClass } from "./ui-bits";

export function DeleteButton({
  endpoint,
  redirectTo,
  label = "Excluir",
  confirmText,
}: {
  endpoint: string;
  redirectTo: string;
  label?: string;
  confirmText: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const run = async () => {
    if (!window.confirm(confirmText)) return;
    setLoading(true);
    const res = await fetch(endpoint, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setLoading(false);
      return toast.error(data.error || "Não foi possível excluir");
    }
    toast.success("Excluído");
    router.push(redirectTo);
    router.refresh();
  };

  return (
    <button onClick={run} disabled={loading} className={buttonClass("ghost")}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
      {label}
    </button>
  );
}
