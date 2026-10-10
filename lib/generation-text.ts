// Textos curtos gravados no banco (extrato de créditos), no idioma do cliente.

/** Descrição do extrato no idioma do cliente (fica gravada na transação). */
export function txDescription(locale: string | null | undefined, kind: "campaign" | "variation" | "winner" | "refund", v: { n?: number; media?: string; quality?: string } = {}) {
  const en = locale === "en";
  const media = v.media === "VIDEO" ? (en ? "video" : "vídeo") : en ? "image" : "imagem";
  if (kind === "campaign") return en ? `Campaign: ${v.n}x ${media} (${v.quality})` : `Campanha: ${v.n}x ${media} (${v.quality})`;
  if (kind === "variation") return en ? `New ${media} variation` : `Nova variação de ${media}`;
  if (kind === "winner") return en ? `${v.n}x ${media} based on the winning ad` : `${v.n}x ${media} a partir do anúncio campeão`;
  return en ? "Automatic refund: generation failed" : "Estorno automático: falha na geração";
}
