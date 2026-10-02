"use client";

import { useRouter } from "next/navigation";

/** Troca a moeda de exibição/cobrança (cookie CURRENCY) e recarrega os preços. */
export function CurrencySwitcher({ value, options, label }: { value: string; options: string[]; label: string }) {
  const router = useRouter();
  return (
    <div className="inline-flex items-center gap-1 rounded-xl border border-border bg-card p-1" role="radiogroup" aria-label={label}>
      {options.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={c === value}
          onClick={() => {
            document.cookie = `CURRENCY=${c}; path=/; max-age=31536000; samesite=lax`;
            router.refresh();
          }}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${c === value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          {c}
        </button>
      ))}
    </div>
  );
}
