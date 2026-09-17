import { describe, expect, it } from "vitest";
import { isSpuriousDecorativeGrounding, isUnsupportedSupportClaim, parseMeetingResponse } from "./meetingContract";

function payload(parallelCount = 1, divergenceCount = 1) {
  return {
    status: "ok",
    result: {
      summary: "Две линзы встретились без требования совпасть.",
      hasStrongParallels: parallelCount > 0,
      confidenceNote: parallelCount ? "Частичный резонанс" : "Разные плоскости",
      possibleSupport: "Опорой может стать уже названная пауза: можно проверить, меняет ли она темп следующего действия.",
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

  it("keeps possible support provisional and rejects hidden-potential claims", () => {
    expect(isUnsupportedSupportClaim("Опорой может стать пауза, которую человек уже назвал; можно проверить её в одном разговоре.")).toBe(false);
    expect(isUnsupportedSupportClaim("В вас уже есть скрытая сила, и вы способны преодолеть это.")).toBe(true);

    const invalid = payload(1, 0);
    invalid.result.possibleSupport = "Ваша скрытая сила уже находится внутри вас.";
    expect(() => parseMeetingResponse(invalid)).toThrow("meeting_unsupported_support_claim");
  });

  it("detects spurious decorative grounding promoted to psychological/burnout claims", () => {
    const spuriousParallel = {
      theme: "Риск истощения от включённости",
      codeAnchor: "Направление 8: «Тенденция поглощаться работой на 100%, забывая про тело, семью и радость».",
      mythAnchor: "«Мокрые листы акварели на натянутой верёвке под тёплой настольной лампой» — образ сосредоточенного вечернего труда.",
      synthesis: "Миф рисует сцену, где работа продолжается вечерами, а Код предупреждает о возможном перевесе работы.",
    };
    expect(isSpuriousDecorativeGrounding(spuriousParallel)).toBe(true);

    const validParallel = {
      theme: "Аналитическая пауза перед действием",
      codeAnchor: "Путь 3: «Паралич анализа: слишком долгое обдумывание заменяет само действие».",
      mythAnchor: "«Третий вечер выбираю первую картину... никак не решу» — прямой ответ пользователя о ситуации выбора.",
      synthesis: "В обоих источниках появляется тема паузы перед выбором.",
    };
    expect(isSpuriousDecorativeGrounding(validParallel)).toBe(false);
  });

  it("filters out spurious decorative parallels in parseMeetingResponse, preserving valid ones", () => {
    const base = payload(1, 1);
    base.result.parallels.push({
      theme: "Риск истощения от включённости",
      codeAnchor: "Направление 8: «Тенденция поглощаться работой на 100%, забывая про тело, семью и радость».",
      mythAnchor: "«Мокрые листы акварели на натянутой верёвке под тёплой настольной лампой» — образ сосредоточенного вечернего труда.",
      synthesis: "Миф рисует сцену, где работа продолжается вечерами, а Код предупреждает о возможном перевесе работы.",
    });

    const parsed = parseMeetingResponse(base);
    expect(parsed.result?.parallels).toHaveLength(1);
    expect(parsed.result?.parallels[0].theme).toBe("Темп");
    expect(parsed.result?.hasStrongParallels).toBe(true);
  });

  it("honestly sets hasStrongParallels to false if no parallels survive grounding", () => {
    const base = {
      status: "ok",
      result: {
        summary: "Две линзы сопоставлены.",
        hasStrongParallels: true,
        confidenceNote: "Резонанс",
        possibleSupport: "Можно проверить, станет ли опорой точный вопрос к собственной ситуации.",
        parallels: [
          {
            theme: "Риск истощения от включённости",
            codeAnchor: "Направление 8: «Тенденция поглощаться работой на 100%, забывая про тело, семью и радость».",
            mythAnchor: "«Мокрые листы акварели на натянутой верёвке под тёплой настольной лампой» — образ сосредоточенного вечернего труда.",
            synthesis: "Миф рисует сцену вечернего труда.",
          },
        ],
        divergences: [],
        albertInsight: "Различение двух подходов.",
        reflectiveQuestion: "Где граница?",
        disclaimer: "Дисклеймер.",
      },
    };

    const parsed = parseMeetingResponse(base);
    expect(parsed.result?.parallels).toHaveLength(0);
    expect(parsed.result?.hasStrongParallels).toBe(false);
  });
});
