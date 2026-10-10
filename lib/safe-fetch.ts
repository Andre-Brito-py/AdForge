import http from "http";
import https from "https";
import dns from "dns";
import net from "net";
import zlib from "zlib";

/**
 * Busca de URLs informadas pelo cliente (importar produto pelo link) sem abrir brecha de SSRF:
 *  - só http/https nas portas padrão;
 *  - o IP é validado NO MOMENTO DA CONEXÃO (lookup próprio): bloqueia rede interna, loopback, link-local
 *    (metadados da nuvem em 169.254.169.254), CGNAT e IPv6 privado, inclusive via DNS rebinding;
 *  - redirecionamentos seguidos manualmente (cada destino passa pela mesma validação), tempo e tamanho limitados.
 */

export class SafeFetchError extends Error {
  constructor(message: string, readonly code: "INVALID_URL" | "BLOCKED" | "TOO_LARGE" | "TIMEOUT" | "HTTP" | "NETWORK", readonly status?: number) {
    super(message);
  }
}

/** IP que não pode ser acessado a partir do servidor. */
export function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19)) || a >= 224
    );
  }
  if (net.isIPv6(ip)) {
    const v = ip.toLowerCase();
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(v);
    if (mapped) return isPrivateIp(mapped[1]);
    return v === "::" || v === "::1" || /^f[cd]/.test(v) || /^fe[89ab]/.test(v) || /^ff/.test(v) || v.startsWith("64:ff9b:") || v.startsWith("2001:db8");
  }
  return true;
}

function checkUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new SafeFetchError("URL inválida", "INVALID_URL");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new SafeFetchError("Só links http/https", "INVALID_URL");
  if (url.username || url.password) throw new SafeFetchError("Link com usuário/senha não é aceito", "INVALID_URL");
  if (url.port && url.port !== "80" && url.port !== "443") throw new SafeFetchError("Porta não permitida", "BLOCKED");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".local")) {
    throw new SafeFetchError("Endereço não permitido", "BLOCKED");
  }
  if (net.isIP(host) && isPrivateIp(host)) throw new SafeFetchError("Endereço não permitido", "BLOCKED");
  return url;
}

/** Resolve o nome e recusa a conexão se QUALQUER endereço for interno. */
const safeLookup: net.LookupFunction = (hostname, options, callback) => {
  dns.lookup(hostname, { all: true }, (err, addresses) => {
    if (err) return callback(err, "", 4);
    const list = addresses as dns.LookupAddress[];
    const bad = list.find((a) => isPrivateIp(a.address));
    if (bad || list.length === 0) return callback(new SafeFetchError("Endereço não permitido", "BLOCKED") as NodeJS.ErrnoException, "", 4);
    if ((options as dns.LookupOptions).all) return (callback as unknown as (e: null, a: dns.LookupAddress[]) => void)(null, list);
    callback(null, list[0].address, list[0].family);
  });
};

export interface SafeResponse {
  url: string;
  status: number;
  contentType: string;
  body: Buffer;
}

const UA = "Mozilla/5.0 (compatible; VysifyBot/1.0; +https://vysify.com) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36";

function requestOnce(url: URL, opts: { maxBytes: number; timeoutMs: number; accept: string }): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: Buffer }> {
  return new Promise((resolve, reject) => {
    const lib = url.protocol === "https:" ? https : http;
    const req = lib.request(
      url,
      {
        method: "GET",
        lookup: safeLookup,
        headers: { "User-Agent": UA, Accept: opts.accept, "Accept-Encoding": "gzip, deflate, br", "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8" },
        timeout: opts.timeoutMs,
      },
      (res) => {
        const status = res.statusCode || 0;
        if (status >= 300 && status < 400) {
          res.resume();
          return resolve({ status, headers: res.headers, body: Buffer.alloc(0) });
        }
        const declared = Number(res.headers["content-length"] || 0);
        if (declared > opts.maxBytes) {
          res.destroy();
          return reject(new SafeFetchError("Arquivo grande demais", "TOO_LARGE"));
        }
        const enc = String(res.headers["content-encoding"] || "").toLowerCase();
        const stream =
          enc === "gzip" ? res.pipe(zlib.createGunzip()) : enc === "deflate" ? res.pipe(zlib.createInflate()) : enc === "br" ? res.pipe(zlib.createBrotliDecompress()) : res;
        const chunks: Buffer[] = [];
        let size = 0;
        stream.on("data", (c: Buffer) => {
          size += c.length;
          if (size > opts.maxBytes) {
            req.destroy();
            reject(new SafeFetchError("Arquivo grande demais", "TOO_LARGE"));
            return;
          }
          chunks.push(c);
        });
        stream.on("end", () => resolve({ status, headers: res.headers, body: Buffer.concat(chunks) }));
        stream.on("error", (e) => reject(new SafeFetchError(e.message, "NETWORK")));
      }
    );
    req.on("timeout", () => req.destroy(new SafeFetchError("Tempo esgotado", "TIMEOUT")));
    req.on("error", (e) => reject(e instanceof SafeFetchError ? e : new SafeFetchError(e.message, "NETWORK")));
    req.end();
  });
}

/** GET seguro com até 4 redirecionamentos. */
export async function safeFetch(
  raw: string,
  opts: { maxBytes?: number; timeoutMs?: number; accept?: string } = {}
): Promise<SafeResponse> {
  const conf = { maxBytes: opts.maxBytes ?? 3 * 1024 * 1024, timeoutMs: opts.timeoutMs ?? 12_000, accept: opts.accept ?? "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8" };
  let url = checkUrl(raw);
  for (let hop = 0; hop <= 4; hop++) {
    const res = await requestOnce(url, conf);
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.location;
      if (!location) throw new SafeFetchError("Redirecionamento sem destino", "HTTP", res.status);
      url = checkUrl(new URL(location, url).toString());
      continue;
    }
    if (res.status >= 400) throw new SafeFetchError(`HTTP ${res.status}`, "HTTP", res.status);
    return { url: url.toString(), status: res.status, contentType: String(res.headers["content-type"] || ""), body: res.body };
  }
  throw new SafeFetchError("Redirecionamentos demais", "HTTP");
}
