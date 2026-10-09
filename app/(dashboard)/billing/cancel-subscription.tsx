"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RotateCcw, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useFormatter, useTranslations } from "next-intl";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { buttonClass } from "@/components/app/ui-bits";

interface Quote { fee: number; currency: string; percent: number; waived: "withdrawal" | "none" | null; accessUntil: string | null; immediate: boolean }

/** Cancelar a assinatura (com a taxa e a data de acesso mostradas antes) ou desfazer o cancelamento. */
export function CancelSubscription({ canceled, canResume }: { canceled: boolean; canResume: boolean }) {
  const t = useTranslations("billing.cancel");
  const format = useFormatter();
  const router = useRouter();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const openDialog = async () => {
    setBusy(true);
    const res = await fetch("/api/billing/subscription");
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return toast.error(data.error || t("error"));
    setQuote(data.quote);
    setOpen(true);
  };

  const act = async (action: "cancel" | "resume") => {
    setBusy(true);
    const res = await fetch("/api/billing/subscription", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return toast.error(data.error || t("error"));
    if (action === "resume") toast.success(t("resumed"));
    else if (data.feeStatus === "FAILED") toast.warning(t("canceledFeeFailed"), { duration: 10_000 });
    else toast.success(t("canceled"));
    setOpen(false);
    router.refresh();
  };

  if (canceled) {
    return canResume ? (
      <button onClick={() => act("resume")} disabled={busy} className={buttonClass("outline")}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />} {t("resume")}
      </button>
    ) : null;
  }

  const money = (v: number, c: string) => format.number(v, { style: "currency", currency: c });
  const date = quote?.accessUntil ? format.dateTime(new Date(quote.accessUntil), { dateStyle: "long" }) : null;

  return (
    <>
      <button onClick={openDialog} disabled={busy} className={buttonClass("ghost")}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />} {t("button")}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("title")}</DialogTitle>
            <DialogDescription>{t("description")}</DialogDescription>
          </DialogHeader>
          {quote && (
            <ul className="space-y-2 text-sm">
              <li>• {quote.immediate ? t("endsNow") : date ? t("accessUntil", { date }) : t("noMoreCharges")}</li>
              <li>• {t("keepCredits")}</li>
              <li className="font-medium">
                • {quote.fee > 0
                  ? t("fee", { amount: money(quote.fee, quote.currency), percent: quote.percent })
                  : quote.waived === "withdrawal" ? t("noFeeWithdrawal") : t("noFee")}
              </li>
            </ul>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setOpen(false)} className={buttonClass("ghost")}>{t("keep")}</button>
            <button onClick={() => act("cancel")} disabled={busy} className={buttonClass("primary")}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} {t("confirm")}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
