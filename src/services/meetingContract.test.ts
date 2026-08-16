import { describe, expect, it } from "vitest";
import { parseMeetingResponse } from "./meetingContract";

function payload(parallelCount = 1, divergenceCount = 1) {
  return {
    status: "ok",
    result: {
      summary: "Две линзы встретились без требования совпасть.",
      hasStrongParallels: parallelCount > 0,
      confidenceNote: parallelCount ? "Частичный резонанс" : "Разные плоскости",
      parallels: Array.from({ length: parallelCount }, () => ({
        theme: "Темп",
        codeAnchor: "Код описывает последовательное движение.",
        mythAnchor: "Миф удерживает образ остановки.",
        synthesis: "Их встреча делает темп предметом выбора.",
      })),
      divergences: Array.from({ length: divergenceCount }, () => ({
        theme: "Напор и пауза",
        codeAspect: "Структура подчёркивает действие.",
        mythAspect: "Образ просит оставить место тишине.",
        reflection: "Это разные ракурсы, а не ошибка одного из них.",
      })),
      albertInsight: "Сопоставление остаётся гипотезой, которую человек может принять или отвергнуть.",
      reflectiveQuestion: "Где действие и пауза перестают быть противоположностями?",
      disclaimer: "Два отражения независимы; совпадения ничего не доказывают.",
    },
  };
}

describe("Meeting of Mirrors contract", () => {
  it("accepts 0 resonances as a complete honest result", () => {
    const parsed = parseMeetingResponse(payload(0, 2));
    expect(parsed.result?.hasStrongParallels).toBe(false);
    expect(parsed.result?.parallels).toHaveLength(0);
  });

  it("accepts the upper 4/2 boundary", () => {
    const parsed = parseMeetingResponse(payload(4, 2));
    expect(parsed.result?.parallels).toHaveLength(4);
    expect(parsed.result?.divergences).toHaveLength(2);
  });

  it("rejects fabricated strong status without anchors", () => {
    const invalid = payload(0, 0);
    invalid.result.hasStrongParallels = true;
    expect(() => parseMeetingResponse(invalid)).toThrow("meeting_strong_without_evidence");
  });

  it("rejects arrays outside the frozen contract", () => {
    expect(() => parseMeetingResponse(payload(5, 0))).toThrow("meeting_invalid_parallel_count");
    expect(() => parseMeetingResponse(payload(1, 3))).toThrow("meeting_invalid_divergence_count");
  });
});
