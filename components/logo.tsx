"use client";

import Link from "next/link";
import { useId } from "react";

/** Símbolo "V" da Vysify em SVG: a haste usa a cor do texto (funciona no claro e no escuro). */
export function LogoMark({ className = "h-7 w-7" }: { className?: string }) {
  // ID único por instância: se o gradiente fosse compartilhado e a primeira cópia do logo
  // estivesse oculta (display:none), a "folha" sumiria nas outras.
  const gradientId = `vy-leaf-${useId().replace(/:/g, "")}`;
  return (
    <svg viewBox="185 265 660 545" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="0.9" y1="0" x2="0.2" y2="1">
          <stop offset="0" stopColor="#8b5cf6" />
          <stop offset="1" stopColor="#3b16f5" />
        </linearGradient>
      </defs>
      <path
        fill="currentColor"
        d="M205 276h135c45 0 82 22 106 64l104 190c20 36 54 48 105 48 6 0 9 4 6 9L553 758c-28 46-82 46-108 0L197 290c-4-8 0-14 8-14z"
      />
      <path
        fill={`url(#${gradientId})`}
        d="M548 404l52-78c22-33 58-50 98-50h126c7 0 10 7 7 13L707 506c-23 40-75 49-108 18-8-8-15-17-20-27l-33-63c-5-10-4-21 2-30z"
      />
    </svg>
  );
}

export function Logo({ href = "/", className = "" }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={`inline-flex items-center gap-2 font-semibold tracking-tight text-foreground ${className}`} aria-label="Vysify">
      <LogoMark />
      <span className="text-lg">Vysify</span>
    </Link>
  );
}
