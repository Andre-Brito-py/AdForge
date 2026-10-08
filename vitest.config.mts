import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Os testes NUNCA usam o banco do .env (o Prisma leria o .env sozinho, e ele pode ser o de produção):
// com TEST_DATABASE_URL, usam o banco de teste; sem ela, um endereço inválido (os testes de banco são pulados).
const testDb = process.env.TEST_DATABASE_URL || "postgresql://invalid:invalid@127.0.0.1:1/none";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Os testes de integração compartilham o mesmo banco: rodar em sequência.
    fileParallelism: false,
    testTimeout: 30_000,
    env: { DATABASE_URL: testDb, DIRECT_URL: testDb },
  },
});
