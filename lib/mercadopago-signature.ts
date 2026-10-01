import { createHmac, timingSafeEqual } from "crypto";

/**
 * Valida o header x-signature do Mercado Pago.
 * Manifesto oficial: "id:{data.id};request-id:{x-request-id};ts:{ts};"
 */
export function verifyMercadoPagoSignature(opts: {
  secret: string;
  signatureHeader: string | null;
  requestId: string | null;
  dataId: string | null;
  maxAgeSeconds?: number;
}): boolean {
  if (!opts.signatureHeader || !opts.dataId) return false;

  const parts = Object.fromEntries(
    opts.signatureHeader.split(",").map((p) => {
      const [k, ...v] = p.trim().split("=");
      return [k, v.join("=")];
    })
  );
  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) return false;

  if (opts.maxAgeSeconds) {
    const tsSeconds = ts.length > 10 ? Number(ts) / 1000 : Number(ts);
    if (!Number.isFinite(tsSeconds) || Math.abs(Date.now() / 1000 - tsSeconds) > opts.maxAgeSeconds) return false;
  }

  const id = /^[a-z0-9]+$/i.test(opts.dataId) ? opts.dataId.toLowerCase() : opts.dataId;
  let manifest = `id:${id};`;
  if (opts.requestId) manifest += `request-id:${opts.requestId};`;
  manifest += `ts:${ts};`;

  const expected = createHmac("sha256", opts.secret).update(manifest).digest("hex");
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(v1, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}
