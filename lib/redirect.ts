/** Aceita só caminhos internos, evitando redirecionamento aberto (?from=https://site-malicioso). */
export function safeRedirect(from: string | null | undefined, fallback = "/dashboard") {
  if (!from || !from.startsWith("/") || from.startsWith("//") || from.startsWith("/\\")) return fallback;
  return from;
}
