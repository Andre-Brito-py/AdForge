import { describe, expect, it } from "vitest";
import { generationAspect, planSegments, videoModelCaps } from "@/lib/video-models";
import { defaultVideoPerSecond } from "@/lib/provider-pricing";

describe("Kling na fal.ai", () => {
  it("v2.6 faz 5/10 s, v3 até 15 s; o formato segue a imagem (sem recorte)", () => {
    const v26 = videoModelCaps("fal-ai/kling-video/v2.6/pro/image-to-video");
    const v3 = videoModelCaps("fal-ai/kling-video/v3/pro/image-to-video");
    expect(v26).toMatchObject({ provider: "fal", family: "kling", durations: [5, 10], lipSyncAudio: false });
    expect(v3.durations).toEqual([5, 10, 15]);
    expect(planSegments(20, v26.durations)).toEqual([10, 10]);
    expect(planSegments(30, v3.durations)).toEqual([15, 15]);
    expect(generationAspect(v26, "4:5")).toEqual({ generate: "4:5", cropTo: null });
  });

  it("tem preço próprio na tabela de custo", () => {
    expect(defaultVideoPerSecond("fal-ai/kling-video/v2.6/pro/image-to-video", false)).toBe(0.07);
    expect(defaultVideoPerSecond("fal-ai/kling-video/v3/pro/image-to-video", true)).toBe(0.224);
  });
});
