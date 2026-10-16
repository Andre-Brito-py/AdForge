import { describe, expect, it } from "vitest";
import { directDatabaseUrl, prismaDatabaseUrl } from "@/lib/db-url";

describe("conexão com o Neon", () => {
  it("pooler do Neon ganha pgbouncer, SSL e tempo para o banco acordar", () => {
    const url = new URL(prismaDatabaseUrl("postgresql://u:p@ep-cool-123-pooler.sa-east-1.aws.neon.tech/neondb")!);
    expect(url.searchParams.get("pgbouncer")).toBe("true");
    expect(url.searchParams.get("sslmode")).toBe("require");
    expect(url.searchParams.get("connect_timeout")).toBe("15");
  });

  it("não sobrescreve o que já veio na URL", () => {
    const url = new URL(prismaDatabaseUrl("postgresql://u:p@ep-x-pooler.us-east-2.aws.neon.tech/db?sslmode=verify-full&connect_timeout=30")!);
    expect(url.searchParams.get("sslmode")).toBe("verify-full");
    expect(url.searchParams.get("connect_timeout")).toBe("30");
  });

  it("conexão direta do Neon não usa pgbouncer; outros bancos ficam como estão", () => {
    expect(new URL(prismaDatabaseUrl("postgresql://u:p@ep-x.sa-east-1.aws.neon.tech/db")!).searchParams.has("pgbouncer")).toBe(false);
    expect(prismaDatabaseUrl("postgresql://postgres:postgres@localhost:54329/vysify")).toBe("postgresql://postgres:postgres@localhost:54329/vysify");
    expect(prismaDatabaseUrl(undefined)).toBeUndefined();
  });

  it("migrations usam DIRECT_URL ou a URL sem pooler da integração da Vercel", () => {
    expect(directDatabaseUrl({ DIRECT_URL: "a", DATABASE_URL_UNPOOLED: "b" })).toBe("a");
    expect(directDatabaseUrl({ DATABASE_URL_UNPOOLED: "b" })).toBe("b");
    expect(directDatabaseUrl({ POSTGRES_URL_NON_POOLING: "c" })).toBe("c");
    expect(directDatabaseUrl({})).toBeUndefined();
  });
});
