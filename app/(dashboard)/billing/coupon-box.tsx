"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Check, TicketPercent, X } from "lucide-react";
import { buttonClass } from "@/components/app/ui-bits";

/** Campo de cupom: o código vai para a URL (?coupon=) e a página recalcula os preços no servidor. */
export function CouponBox({ applied, error }: { applied: string | null; error: string | null }) {
  const t = useTranslations("billing");
  const router = useRouter();
  const params = useSearchParams();
  const [code, setCode] = useState(applied || params.get("coupon") || "");

  const go = (value: string | null) => {
    const next = new URLSearchParams(params.toString());
    next.delete("status");
    if (value) next.set("coupon", value.trim().toUpperCase());
    else next.delete("coupon");
    router.replace(`/billing${next.size ? `?${next}` : ""}`, { scroll: false });
  };

  if (applied) {
    return (
      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-brand/40 bg-brand/5 px-4 py-3 text-sm">
        <Check className="h-4 w-4 text-brand" />
        <span className="font-medium">{t("couponApplied", { code: applied })}</span>
        <button onClick={() => { setCode(""); go(null); }} className={`${buttonClass("ghost", "sm")} ml-auto`}>
          <X className="h-3.5 w-3.5" /> {t("couponRemove")}
        </button>
      </div>
    );
  }

  return (
    <form
      className="mb-6 flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (code.trim()) go(code);
      }}
    >
      <div className="min-w-0 flex-1 space-y-1.5 sm:max-w-xs">
        <label htmlFor="coupon" className="label-base flex items-center gap-1.5"><TicketPercent className="h-4 w-4" /> {t("couponLabel")}</label>
        <input
          id="coupon"
          className="input-base uppercase"
          value={code}
          maxLength={40}
          autoComplete="off"
          placeholder={t("couponPlaceholder")}
          onChange={(e) => setCode(e.target.value)}
          aria-invalid={!!error}
          aria-describedby={error ? "coupon-error" : undefined}
        />
      </div>
      <button type="submit" disabled={!code.trim()} className={buttonClass("outline")}>{t("couponApply")}</button>
      {error && <p id="coupon-error" className="w-full text-sm text-destructive">{error}</p>}
    </form>
  );
}
