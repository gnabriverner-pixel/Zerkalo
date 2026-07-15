import { describe, expect, it } from "vitest";

import {
  buildPersonalMythPrompt,
  containsCrisisLanguage,
  generatePersonalMyth,
  parsePersonalMythRequest,
  parsePersonalMythResult,
  validatePersonalMythResult,
  type PersonalMythAnswers,
  type PersonalMythProvider,
} from "./personalMyth";

const answers: PersonalMythAnswers = {
  q1: "тяжесть и ощущение развилки",
  q2: "закрытая дверь в туманном саду",
  q3: "долгая прогулка у воды",
  q4: "ясности и спокойной смелости",
};

function validPayload() {
  const first = Array.from({ length: 310 }, (_, index) => `слово${index}`).join(" ");
  const second = Array.from({ length: 310 }, (_, index) => `образ${index}`).join(" ");
  return {
    title: "Дверь у воды",
    story: `${first}\n\n${second}`,
    mirror: {
      mainImage: "Закрытая дверь в саду становится точкой выбора.",
      innerTension: "Герой одновременно хочет остаться и сделать шаг.",
      hiddenResource: "Спокойная прогулка возвращает ему собственный темп.",
      newView: "Ясность появляется не до движения, а внутри него.",
    },
    answer_echoes: [
      { answer_key: "q1", source_phrase: "ощущение развилки", story_image: "развилка у старой стены" },
      { answer_key: "q2", source_phrase: "закрытая дверь", story_image: "дверь в туманном саду" },
      { answer_key: "q3", source_phrase: "прогулка у воды", story_image: "дорога вдоль реки" },
      { answer_key: "q4", source_phrase: "спокойной смелости", story_image: "тихий шаг через порог" },
    ],
    one_step: "В течение пятнадцати минут пройти знакомый маршрут без телефона и заметить одну деталь, которую раньше не замечали.",
    journal_question: "Что становится видимым, когда я перестаю требовать от себя немедленного ответа?",
    visual_key: "threshold",
    disclaimer: "Образный формат для саморефлексии. Не диагностика и не инструкция к действию.",
  };
}

describe("Personal Myth contract", () => {
  it("accepts four bounded answers and rejects an incomplete request", () => {
    const request = parsePersonalMythRequest({
      request_id: "request_1234567890",
      consent_version: "personal-myth-v1",
      answers,
    });
    expect(request.answers.q2).toBe(answers.q2);
    expect(() =>
      parsePersonalMythRequest({ request_id: "request_1234567890", answers: { ...answers, q4: "" } }),
    ).toThrow("invalid_answer:q4");
  });

  it("requires complete answer provenance and the literary length contract", () => {
    const result = parsePersonalMythResult(JSON.stringify(validPayload()));
    const quality = validatePersonalMythResult(result, answers);
    expect(quality.passed).toBe(true);
    expect(quality.word_count).toBe(620);
    expect(quality.answer_coverage).toEqual(["q1", "q2", "q3", "q4"]);

    result.answer_echoes[0].source_phrase = "чужая фраза";
    expect(validatePersonalMythResult(result, answers).blockers).toContain("answer_coverage_incomplete");
  });

  it("joins three provider story parts into one public literary text", () => {
    const payload = validPayload() as ReturnType<typeof validPayload> & { story_parts?: string[] };
    payload.story_parts = ["первая сцена", "вторая сцена", "третья сцена"];
    delete (payload as { story?: string }).story;

    const result = parsePersonalMythResult(JSON.stringify(payload));

    expect(result.story).toBe("первая сцена\n\nвторая сцена\n\nтретья сцена");
  });

  it("blocks therapeutic promises and recognizes explicit crisis language", () => {
    const result = parsePersonalMythResult(JSON.stringify(validPayload()));
    result.story = result.story.replace("слово1", "исцеление") + " слово";
    expect(validatePersonalMythResult(result, answers).blockers).toContain("forbidden_public_language");
    expect(containsCrisisLanguage({ ...answers, q1: "Я не хочу жить" })).toBe(true);
    expect(containsCrisisLanguage(answers)).toBe(false);
  });

  it("runs one bounded retry after invalid provider output", async () => {
    const calls: string[] = [];
    const provider: PersonalMythProvider = {
      name: "deepseek",
      model: "test-model",
      isReady: () => true,
      generate: async (prompt) => {
        calls.push(prompt);
        return calls.length === 1 ? "not json" : JSON.stringify(validPayload());
      },
    };
    const request = parsePersonalMythRequest({
      request_id: "request_1234567890",
      consent_version: "personal-myth-v1",
      answers,
    });

    const generated = await generatePersonalMyth(request, provider, 1000);

    expect(generated.repaired).toBe(true);
    expect(calls).toHaveLength(2);
    expect(calls[1]).toContain("не прошла проверку");
    expect(buildPersonalMythPrompt(request)).not.toContain("Альберт Анатольевич");
  });

  it("gives the repair prompt the actual short-story word count", async () => {
    const calls: string[] = [];
    const shortPayload = validPayload();
    shortPayload.story = "короткая сцена ".repeat(120).trim();
    const provider: PersonalMythProvider = {
      name: "deepseek",
      model: "test-model",
      isReady: () => true,
      generate: async (prompt) => {
        calls.push(prompt);
        return JSON.stringify(calls.length === 1 ? shortPayload : validPayload());
      },
    };
    const request = parsePersonalMythRequest({
      request_id: "request_short_story_1",
      answers,
    });

    const generated = await generatePersonalMyth(request, provider, 1000);

    expect(generated.repaired).toBe(true);
    expect(calls[1]).toContain("фактически 240 слов");
    expect(calls[1]).toContain("требуется 350–700");
  });

  it("retries one empty provider response without consuming the editorial repair", async () => {
    let calls = 0;
    const provider: PersonalMythProvider = {
      name: "deepseek",
      model: "test-model",
      isReady: () => true,
      generate: async () => {
        calls += 1;
        if (calls === 1) throw new Error("provider_empty_output");
        return JSON.stringify(validPayload());
      },
    };
    const request = parsePersonalMythRequest({
      request_id: "request_empty_retry_1",
      answers,
    });

    const generated = await generatePersonalMyth(request, provider, 1000);

    expect(calls).toBe(2);
    expect(generated.repaired).toBe(false);
  });
});
