import { describe, expect, it } from "vitest";
import { allowedTargets, videoAspectFor } from "@/lib/publish-targets";

describe("destinos de publicação", () => {
  it("Reels e Stories recebem o vídeo em 9:16; Feed e Página aceitam o original", () => {
    expect(videoAspectFor("INSTAGRAM_REELS")).toBe("9:16");
    expect(videoAspectFor("INSTAGRAM_STORY")).toBe("9:16");
    expect(videoAspectFor("FACEBOOK_PAGE")).toBeNull();
    expect(videoAspectFor("INSTAGRAM_FEED")).toBeNull();
  });

  it("vídeo em qualquer formato pode ir para Reels (a versão 9:16 é gerada na publicação)", () => {
    expect(allowedTargets("VIDEO", "1:1")).toContain("INSTAGRAM_REELS");
    expect(allowedTargets("IMAGE", "9:16")).not.toContain("INSTAGRAM_FEED");
  });
});
