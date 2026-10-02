/**
 * CSV simples (separador ";" e BOM UTF-8, que o Excel em português abre direto).
 * Células que começam com = + - @ recebem um apóstrofo, evitando que o Excel as execute como fórmula.
 */
export function toCsv(header: string[], rows: (string | number)[][]): string {
  const cell = (v: string | number) => {
    let s = String(v ?? "");
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + [header, ...rows].map((r) => r.map(cell).join(";")).join("\r\n") + "\r\n";
}
