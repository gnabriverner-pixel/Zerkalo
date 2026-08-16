import { describe, expect, it } from "vitest";
import {
  PERSONAL_MYTH_WRITER_VERSION,
  buildPersonalMythPromptV11,
  containsCrisisLanguage,
  generatePersonalMyth,
  parsePersonalMythRequest,
  parsePersonalMythResult,
  validatePersonalMythResult,
  type PersonalMythProvider,
} from "./myth";

const answers = {
  q1: "тяжесть и ощущение развилки",
  q2: "закрытая дверь в туманном саду",
  q3: "долгая прогулка у воды",
  q4: "ясности и спокойной смелости",
};

const request = () => parsePersonalMythRequest({
  request_id: "request_1234567890",
  consent_version: PERSONAL_MYTH_WRITER_VERSION,
  answers,
});

function validPayload() {
  return {
    mode: "story",
    status: "ok",
    story_result: {
      title: "Дверь у воды",
      story: Array.from({ length: 190 }, (_, index) => `слово${index}`).join(" "),
      mirror: {
        mainImage: "Дверь остаётся образом выбора, а не готовым объяснением.",
        innerTension: "История допускает два движения и не назначает скрытую причину.",
        hiddenResource: "Прогулка возвращает герою его собственный темп.",
        newView: "Туман и движение у воды соединяются в право идти без окончательной ясности.",
      },
      meaning: ["Дверь как вопрос", "Темп как выбор", "Неопределённость остаётся"],
      one_step: "Заметить одну деталь на знакомом маршруте и записать её без объяснения.",
      journal_question: "Что остаётся видимым, если я не требую немедленного ответа?",
      disclaimer: "Образный формат для саморефлексии. Не диагностика и не инструкция к действию.",
    },
  };
}

describe("Personal Myth v1.1 release contract", () => {
  it("accepts exactly four bounded answers", () => {
    expect(request().answers.q2).toBe(answers.q2);
    expect(() => parsePersonalMythRequest({ request_id: "short", answers })).toThrow("invalid_request_id");
    expect(() => parsePersonalMythRequest({ request_id: "request_1234567890", answers: { ...answers, q4: "" } })).toThrow("invalid_answer:q4");
  });

  it("keeps Code and identity data out of the writer prompt", () => {
    const prompt = buildPersonalMythPromptV11(request());
    expect(prompt).toContain(answers.q1);
    expect(prompt).toContain(answers.q4);
    expect(prompt).not.toMatch(/дата\s+рождения|нумеролог|число\s+души|матрица\s+кода/iu);
  });

  it("locks the evidence-based anti-template corrections", () => {
    const prompt = buildPersonalMythPromptV11(request());
    expect(prompt).toContain("минимум два разных ответа");
    expect(prompt).toContain("Оставь честный остаток неопределённости");
    expect(prompt).toContain("впервые за долгое время");
    expect(prompt).toContain("Не придумывай биографию");
  });

  it("validates a complete result and forbidden language", () => {
    const result = parsePersonalMythResult(JSON.stringify(validPayload()));
    expect(validatePersonalMythResult(result).passed).toBe(true);
    result.story += " исцеление";
    expect(validatePersonalMythResult(result).blockers).toContain("forbidden_public_language");
  });

  it("blocks the proven serial fingerprint and unsupported certainty mutations", () => {
    const fingerprint = parsePersonalMythResult(JSON.stringify(validPayload()));
    fingerprint.story += " Впервые за долгое время стало тихо.";
    expect(validatePersonalMythResult(fingerprint).blockers).toContain("template_fingerprint");

    const certainty = parsePersonalMythResult(JSON.stringify(validPayload()));
    certainty.mirror.innerTension = "Она боится остановиться и зависит от чужой оценки.";
    expect(validatePersonalMythResult(certainty).blockers).toContain("unsupported_certainty");
  });

  it("recognizes explicit crisis language", () => {
    expect(containsCrisisLanguage({ ...answers, q1: "Я не хочу жить" })).toBe(true);
    expect(containsCrisisLanguage(answers)).toBe(false);
  });

  it("returns a real provider result and never fabricates one", async () => {
    const provider: PersonalMythProvider = {
      name: "fixture",
      model: "fixture-model",
      isReady: () => true,
      generate: async () => JSON.stringify(validPayload()),
    };
    const generated = await generatePersonalMyth(request(), provider, 1000);
    expect(generated.result.title).toBe("Дверь у воды");

    const broken: PersonalMythProvider = {
      ...provider,
      generate: async () => { throw new Error("provider_http_500"); },
    };
    await expect(generatePersonalMyth(request(), broken, 1000)).rejects.toThrow("personal_myth_quality_failed");
  });
});
