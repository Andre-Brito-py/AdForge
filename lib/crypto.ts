import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

/**
 * Criptografia simétrica (AES-256-GCM) para segredos guardados no banco
 * (chaves de IA, Stripe, Mercado Pago). A chave vem de ENCRYPTION_KEY.
 *
 * Formato armazenado: "enc:v1:<iv b64>:<tag b64>:<ciphertext b64>"
 * Valores legados sem prefixo são lidos como texto puro (e re-criptografados no próximo save).
 */
const PREFIX = "enc:v1:";

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("ENCRYPTION_KEY não configurada. Gere uma com: openssl rand -base64 32");
    }
    // Apenas para desenvolvimento local: chave derivada do NEXTAUTH_SECRET.
    return createHash("sha256").update(process.env.NEXTAUTH_SECRET || "dev-only-insecure-key").digest();
  }
  // Aceita qualquer string; derivamos 32 bytes via SHA-256 para tolerar formatos diferentes.
  return createHash("sha256").update(raw).digest();
}

export function isEncrypted(value: string | null | undefined): boolean {
  return !!value && value.startsWith(PREFIX);
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64")}:${tag.toString("base64")}:${ciphertext.toString("base64")}`;
}

export function decryptSecret(stored: string | null | undefined): string | null {
  if (!stored) return null;
  if (!isEncrypted(stored)) return stored;
  const [ivB64, tagB64, dataB64] = stored.slice(PREFIX.length).split(":");
  try {
    const decipher = createDecipheriv("aes-256-gcm", getKey(), Buffer.from(ivB64, "base64"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf8");
  } catch {
    // Chave de criptografia trocada ou valor corrompido: trate como não configurado.
    console.error("[crypto] Falha ao descriptografar um segredo. A ENCRYPTION_KEY mudou?");
    return null;
  }
}

/** Mostra só o final do segredo para o painel admin (nunca o valor inteiro). */
export function maskSecret(plain: string | null): { configured: boolean; hint: string | null } {
  if (!plain) return { configured: false, hint: null };
  return { configured: true, hint: plain.length > 8 ? `••••${plain.slice(-4)}` : "••••" };
}

/** Token aleatório para links de e-mail. Guardamos só o hash no banco. */
export function generateToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
