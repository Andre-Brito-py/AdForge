import { describe, expect, it } from "vitest";
import pt from "../messages/pt.json";
import en from "../messages/en.json";
import { IMAGE_RIGHTS_TEXT, buildImageRightsRecord, imageRightsCutoff, requestFingerprint, sha256 } from "@/lib/image-rights";
import { toCsv } from "@/lib/csv";

describe("registro da autorização de imagem", () => {
  it("o texto guardado é EXATAMENTE o que o cliente vê na tela", () => {
    expect(IMAGE_RIGHTS_TEXT.pt).toBe(pt.campaigns.wizard.imageRights);
    expect(IMAGE_RIGHTS_TEXT.en).toBe(en.campaigns.wizard.imageRights);
  });

  it("guarda texto no idioma do cliente, hash de cada imagem, IP e navegador", () => {
    const rec = buildImageRightsRecord({
      user: { id: "u1", email: "ana@loja.com", name: "Ana", locale: "en", workspaceId: "w1" },
      campaign: { id: "c1", name: "Garrafa" },
      images: [{ url: "/uploads/a.png", buffer: Buffer.from("abc") }],
      fingerprint: { ipAddress: "200.1.2.3", userAgent: "Mozilla/5.0" },
    });
    expect(rec.declarationText).toBe(IMAGE_RIGHTS_TEXT.en);
    expect(JSON.parse(rec.imageHashes as string)).toEqual([sha256(Buffer.from("abc"))]);
    expect(sha256(Buffer.from("abc"))).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(rec).toMatchObject({ userEmail: "ana@loja.com", campaignId: "c1", ipAddress: "200.1.2.3", userAgent: "Mozilla/5.0", locale: "en" });
  });

  it("IP vem do primeiro endereço do x-forwarded-for", () => {
    const fp = requestFingerprint(new Request("http://x", { headers: { "x-forwarded-for": "177.10.0.1, 10.0.0.1", "user-agent": "UA" } }));
    expect(fp).toEqual({ ipAddress: "177.10.0.1", userAgent: "UA" });
    expect(requestFingerprint(new Request("http://x")).ipAddress).toBeNull();
  });

  it("prazo de guarda de 5 anos", () => {
    expect(imageRightsCutoff(new Date("2031-10-02T12:00:00Z")).toISOString()).toBe("2026-10-02T12:00:00.000Z");
  });
});

describe("exportação CSV", () => {
  it("escapa aspas/separador e neutraliza fórmulas do Excel", () => {
    const csv = toCsv(["a", "b"], [['=HYPERLINK("x")', "ok;sim"], ["-2", 'diz "oi"']]);
    expect(csv.startsWith("﻿a;b\r\n")).toBe(true);
    expect(csv).toContain(`"'=HYPERLINK(""x"")";"ok;sim"`);
    expect(csv).toContain(`'-2;"diz ""oi"""`);
  });
});
