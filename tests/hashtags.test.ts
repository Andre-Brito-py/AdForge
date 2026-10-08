import { describe, expect, it } from "vitest";
import { normalizeHashtags } from "@/services/ai/text";

describe("hashtags", () => {
  it("limpa, tira repetidas (sem diferenciar maiúsculas) e respeita o limite do formato", () => {
    expect(normalizeHashtags(["#Skincare", "skincare", "# pele oleosa", "#Promo!", "#a", "#Beleza Natural"], 10)).toEqual([
      "#Skincare", "#peleoleosa", "#Promo", "#BelezaNatural",
    ]);
    expect(normalizeHashtags(["#um", "#dois", "#tres"], 2)).toEqual(["#um", "#dois"]);
    expect(normalizeHashtags(undefined, 5)).toEqual([]);
  });

  it("aceita acentos e números e recusa símbolos estranhos", () => {
    expect(normalizeHashtags(["#Promoção2026", "#café", "#oi<script>"], 5)).toEqual(["#Promoção2026", "#café"]);
  });
});
