import zlib from "node:zlib";
import { expect, test, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

// Banco de TESTE (o mesmo do servidor dos testes): só para preparar dados que a interface não cria sozinha.
const db = new PrismaClient({ datasources: { db: { url: process.env.E2E_DATABASE_URL } } });

const stamp = Date.now().toString(36);
const user = { name: "Ana Teste", email: `e2e-${stamp}@exemplo.com`, password: "SenhaForte123" };

/** Foto de produto mínima (PNG 64x64) gerada na hora. */
function productPng() {
  const w = 64, h = 64;
  const raw = Buffer.alloc((w * 3 + 1) * h, 0x80);
  for (let y = 0; y < h; y++) raw[y * (w * 3 + 1)] = 0;
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

async function signIn(page: Page) {
  await page.goto("/login");
  await page.locator('input[type="email"]').fill(user.email);
  await page.locator('input[type="password"]').fill(user.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(/\/(dashboard|onboarding)/);
}

test.describe.configure({ mode: "serial" });

test.afterAll(async () => {
  const u = await db.user.findUnique({ where: { email: user.email }, include: { workspaces: true } });
  if (u) {
    await db.workspace.deleteMany({ where: { id: { in: u.workspaces.map((w) => w.workspaceId) } } });
    await db.user.delete({ where: { id: u.id } });
  }
  await db.$disconnect();
});

test("cadastro registra o aceite dos Termos e leva ao onboarding", async ({ page }) => {
  await page.goto("/signup");
  await page.locator("#name").fill(user.name);
  await page.locator("#email").fill(user.email);
  await page.locator("#password").fill(user.password);
  await page.locator('input[type="checkbox"]').check();
  await page.getByRole("button", { name: "Criar conta" }).click();
  await page.waitForURL(/\/onboarding/);

  const saved = await db.user.findUniqueOrThrow({ where: { email: user.email } });
  expect(saved.termsVersion).toBeTruthy();
  expect(await db.consentRecord.count({ where: { userId: saved.id, method: "signup_email" } })).toBe(1);

  await page.getByRole("button", { name: /Tenho uma loja/ }).click();
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("button", { name: /Imagens para anúncios/ }).click();
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("button", { name: /Cadastrar meu primeiro produto/ }).click();
  await page.waitForURL(/\/products/);
});

test("produto → campanha de imagem → galeria com legenda e hashtags", async ({ page }) => {
  // O e-mail não é confirmado no teste (sem caixa de entrada) e a conta precisa de créditos para gerar.
  const u = await db.user.update({ where: { email: user.email }, data: { emailVerified: new Date() }, include: { workspaces: true } });
  await db.creditBalance.update({ where: { workspaceId: u.workspaces[0].workspaceId }, data: { balance: 50 } });
  await signIn(page);

  await page.goto("/products/new");
  await page.locator('input[type="file"]').setInputFiles({ name: "garrafa.png", mimeType: "image/png", buffer: productPng() });
  await page.locator("#name").fill("Garrafa térmica 750 ml");
  await page.getByRole("button", { name: "Salvar produto" }).click();
  await page.waitForURL(/\/products\/[0-9a-f-]{36}$/);
  const productId = page.url().split("/").pop()!;

  await page.goto(`/campaigns/new?productId=${productId}`);
  await page.getByRole("button", { name: /Vendas diretas/ }).click();
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("button", { name: /Instagram Feed/ }).click();
  await page.getByRole("button", { name: /Estúdio profissional/ }).click();
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("button", { name: /Gerar campanha/ }).click();

  // A geração roda em segundo plano; a tela de progresso leva à galeria quando termina.
  await page.waitForURL(/\/campaigns\/[0-9a-f-]{36}$/, { timeout: 90_000 });
  await expect(page.getByText("Café quente por 12 horas").first()).toBeVisible();
  await expect(page.getByText("#garrafatermica #cafe #academia").first()).toBeVisible();
  await expect(page.getByRole("button", { name: /Copiar legenda/ }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /Baixar/ }).first()).toBeVisible();
});

test("comprar créditos: cupom inválido explica o motivo", async ({ page }) => {
  await signIn(page);
  await page.goto("/billing?coupon=NAOEXISTE");
  await expect(page.getByText("Cupom inválido ou desativado.")).toBeVisible();
  await expect(page.getByRole("button", { name: /Comprar Starter/ })).toBeVisible();
});

test("equipe: convite fica pendente na lista", async ({ page }) => {
  await signIn(page);
  await page.goto("/team");
  const guest = `convidado-${stamp}@exemplo.com`;
  await page.locator("#invite-email").fill(guest);
  await page.getByRole("button", { name: "Enviar convite" }).click();
  await expect(page.getByText(guest)).toBeVisible();
  await expect(page.getByText(/Convite pendente/)).toBeVisible();
});
