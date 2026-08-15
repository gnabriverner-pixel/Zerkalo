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
} from "./myth";

const answers: PersonalMythAnswers = {
  q1: "тяжесть и ощущение развилки",
  q2: "закрытая дверь в туманном саду",
  q3: "долгая прогулка у воды",
  q4: "ясности и спокойной смелости",
};

function validPayload() {
  const first = Array.from({ length: 300 }, (_, index) => `слово${index}`).join(" ");
  const second = Array.from({ length: 300 }, (_, index) => `образ${index}`).join(" ");
  return {
    title: "Дверь у воды",
    story: `${first}\n\n${second}`,
    mirror: {
      mainImage: "Закрытая дверь в саду становится точкой выбора.",
      innerTension: "Герой одновременно хочет остаться и сделать шаг.",
      hiddenResource: "Спокойная прогулка возвращает ему собственный темп.",
      newView: "Ясность появляется не до движения, а внутри него.",
    },
    meaning: [
      "Дверь — точка выбора, а не преграда.",
      "Скрытая точка выбора — тишина перед шагом.",
      "Движение от замирания к ясности.",
    ],
    one_step: "В течение пятнадцати минут пройти знакомый маршрут без телефона и заметить одну деталь, которую раньше не замечали.",
    journal_question: "Что становится видимым, когда я перестаю требовать от себя немедленного ответа?",
    disclaimer: "Образный формат для саморефлексии. Не диагностика и не инструкция к действию.",
  };
}

describe("Lab Myth contract", () => {
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
    expect(() =>
      parsePersonalMythRequest({ request_id: "short", answers }),
    ).toThrow("invalid_request_id");
  });

  it("validates a good result and blocks forbidden language and broken contracts", () => {
    const result = parsePersonalMythResult(JSON.stringify(validPayload()));
    const quality = validatePersonalMythResult(result);
    expect(quality.passed).toBe(true);
    expect(quality.word_count).toBe(600);

    result.story = result.story.replace("слово1", "исцеление") + " слово";
    expect(validatePersonalMythResult(result).blockers).toContain("forbidden_public_language");
  });

  it("rejects story outside hard sanity bounds without template rigidity", () => {
    const payload = validPayload();
    payload.story = "короткая сцена ".repeat(60).trim();
    const quality = validatePersonalMythResult(parsePersonalMythResult(JSON.stringify(payload)));
    expect(quality.passed).toBe(false);
    expect(quality.blockers.join("|")).toContain("story_word_count");
  });

  it("parses both wrapped (story_result) and flat payload shapes", () => {
    const flat = parsePersonalMythResult(JSON.stringify(validPayload()));
    const wrapped = parsePersonalMythResult(JSON.stringify({ mode: "story", status: "ok", story_result: validPayload() }));
    expect(flat.title).toBe(wrapped.title);
    expect(wrapped.meaning.length).toBe(3);
  });

  it("recognizes explicit crisis language and ignores ordinary answers", () => {
    expect(containsCrisisLanguage({ ...answers, q1: "Я не хочу жить" })).toBe(true);
    expect(containsCrisisLanguage(answers)).toBe(false);
  });

  it("keeps the writer prompt independent: only four answers, no code profile", () => {
    const request = parsePersonalMythRequest({
      request_id: "request_1234567890",
      answers,
    });
    const prompt = buildPersonalMythPrompt(request);
    expect(prompt).toContain(answers.q1);
    expect(prompt).toContain(answers.q4);
    expect(prompt).not.toMatch(/код|числ|нумеролог|дата\s+рождени|душа|путь|матриц/iu);
    expect(prompt).not.toMatch(/\b\d{2}\.\d{2}\.\d{4}\b/u);
  });

  it("runs one bounded retry after invalid provider output (no fake success)", async () => {
    const calls: string[] = [];
    const provider: PersonalMythProvider = {
      name: "deepseek",
      model: "test-model",
      isReady: () => true,
      generate: async (prompt) => {
        calls.push(prompt);
        return calls.length === 1 ? "not json" : JSON.stringify({ mode: "story", status: "ok", story_result: validPayload() });
      },
    };
    const request = parsePersonalMythRequest({
      request_id: "request_1234567890",
      answers,
    });

    const generated = await generatePersonalMyth(request, provider, 1000);

    expect(generated.repaired).toBe(true);
    expect(calls).toHaveLength(2);
    expect(calls[1]).toContain("не прошла проверку");
  });

  it("fails honestly when the provider is broken and never fabricates a story", async () => {
    const provider: PersonalMythProvider = {
      name: "deepseek",
      model: "test-model",
      isReady: () => true,
      generate: async () => {
        throw new Error("provider_http_500");
      },
    };
    const request = parsePersonalMythRequest({
      request_id: "request_1234567890",
      answers,
    });

    await expect(generatePersonalMyth(request, provider, 1000)).rejects.toThrow();
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
        return JSON.stringify({ mode: "story", status: "ok", story_result: validPayload() });
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
