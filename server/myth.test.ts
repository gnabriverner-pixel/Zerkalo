import { describe, expect, it, vi } from "vitest";
import {
  PERSONAL_MYTH_WRITER_VERSION,
  buildPersonalMythPromptV11,
  containsCrisisLanguage,
  generatePersonalMyth,
  parsePersonalMythRequest,
  parsePersonalMythResult,
  validatePersonalMythResult,
  cleanProse,
  DeepSeekMythProvider,
  type PersonalMythProvider,
} from "./myth";
import { DeepSeekClient } from "./deepseek";

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

function validStoryText(): string {
  const p1 = "Ты стоишь перед тяжелой кованой дверью на дальней границе старого сада, где сырой утренний туман медленно стирает очертания вековых деревьев. Твой осторожный шаг замирает на мокром гравии, и в прохладном воздухе повисает глубокая, осязаемая тишина долгого ожидания. Вокруг нет привычных указателей или готовых подсказок, только шершавый темный камень высокой арки и легкое прохладное дыхание ветра, приходящего со стороны невидимой в дымке реки. В этот момент ты отчетливо чувствуешь, как развилка двух путей не требует от тебя немедленного лихорадочного выбора, а предлагает просто задержаться на пороге и услышать собственный внутренний ритм.";
  const p2 = "Опустив руку в глубокий карман шерстяного плаща, ты пальцами находишь гладкий речной голыш, сохранивший чистоту и прохладу проточной воды после недавней неспешной прогулки вдоль извилистого берега. Это простое физическое напоминание мгновенно возвращает твое внимание к устойчивости тела, к ровному и спокойному дыханию и терпкому запаху влажной осенней листвы. Ты больше не пытаешься во что бы то ни стало разгадать, какая тайна скрыта за глухими деревянными створками, потому что само твое недавнее движение к реке уже дало тебе прочную точку внутренней опоры и уверенности.";
  const p3 = "Длинная пауза между прежним напряженным намерением и новым действием перестает казаться напрасной потерей времени или слабостью. Ты делаешь медленный, полный вдох, позволяя серебристому туману мягко опуститься на твои плечи, и вдруг замечаешь едва заметную узкую тропинку, свободно огибающую массивную каменную стену с левой стороны. Истинная смелость здесь вовсе не требует громких внешних заявлений или попыток сломать тяжелый засов — она открывается тебе как простое внутреннее разрешение идти вперед в собственном естественном темпе, даже когда далекий горизонт плотно укрыт белой мглой.";
  const p4 = "Когда ты уверенно поворачиваешь в сторону шумящей воды, сад за твоей спиной постепенно превращается в спокойную часть пройденного пути. Ты не требуешь от этой лесной тропы окончательных гарантий или предсказуемого исхода, но каждый твой следующий шаг оставляет ясный и глубокий след на влажной земле. Река впереди продолжает свое вечное течение, открывая твоему взгляду чистый и свободный простор без лишних ожиданий.";
  return `${p1}\n\n${p2}\n\n${p3}\n\n${p4}`;
}

function validPayload() {
  return {
    mode: "story",
    status: "ok",
    story_result: {
      title: "Дверь у воды",
      story: validStoryText(),
      mirror: {
        mainImage: "Дверь остаётся для тебя образом выбора, а не готовым объяснением.",
        innerTension: "История отражает твое внутреннее напряжение между желанием сделать шаг и правом остаться в тишине.",
        hiddenResource: "Прогулка у воды возвращает тебе твой собственный живой темп.",
        newView: "Туман и движение у реки соединяются в твое право идти без требования немедленной ясности.",
      },
      meaning: ["Дверь как вопрос", "Темп как выбор", "Неопределённость остаётся"],
      one_step: "Заметить одну деталь на знакомом маршруте и записать её без объяснения.",
      journal_question: "Что остаётся видимым для тебя, если ты не требуешь немедленного ответа?",
      disclaimer: "Образный формат для саморефлексии. Не диагностика и не инструкция к действию.",
    },
  };
}

describe("Personal Myth v1.1 release contract", () => {
  it("cleanProse preserves paragraph breaks and normalizes whitespace", () => {
    const raw = "   Параграф один со    лишними пробелами.   \n\n\n\n  Параграф два.  \n\n  Параграф три.  ";
    const cleaned = cleanProse(raw);
    const paragraphs = cleaned.split("\n\n");
    expect(paragraphs.length).toBe(3);
    expect(paragraphs[0]).toBe("Параграф один со лишними пробелами.");
    expect(paragraphs[1]).toBe("Параграф два.");
    expect(paragraphs[2]).toBe("Параграф три.");
  });

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

  it("locks the evidence-based anti-template corrections and voice contract in prompt", () => {
    const prompt = buildPersonalMythPromptV11(request());
    expect(prompt).toContain("ТОЛЬКО ВТОРОЕ ЛИЦО ЕДИНСТВЕННОГО ЧИСЛА");
    expect(prompt).toContain("БЕЗ ПРИДУМАННОЙ БИОГРАФИИ");
    expect(prompt).toContain("строго 300–800 слов");
    expect(prompt).toContain("3–6 законченных абзацев");
    expect(prompt).toContain("ИНТЕГРАЦИЯ Q4");
  });

  it("validates a complete result conforming to 300-800 words and 3-6 paragraphs", () => {
    const result = parsePersonalMythResult(JSON.stringify(validPayload()));
    const quality = validatePersonalMythResult(result);
    expect(quality.passed).toBe(true);
    expect(quality.word_count).toBeGreaterThanOrEqual(300);
    expect(quality.word_count).toBeLessThanOrEqual(800);
    expect(quality.paragraph_count).toBe(4);
  });

  it("rejects formal 'вы/ваш' register in story and mirror", () => {
    const payload = validPayload();
    payload.story_result.story += "\n\nВы можете сделать выбор прямо сейчас.";
    const result = parsePersonalMythResult(JSON.stringify(payload));
    const quality = validatePersonalMythResult(result);
    expect(quality.blockers).toContain("register_formal_you_forbidden");
  });

  it("rejects invented biography indicators", () => {
    const payload = validPayload();
    payload.story_result.story += "\n\nВ детстве ты часто гулял по этой аллее.";
    const result = parsePersonalMythResult(JSON.stringify(payload));
    const quality = validatePersonalMythResult(result);
    expect(quality.blockers).toContain("invented_biography_risk");
  });

  it("does not false-positive on benign words like 'увлечение' or negative disclaimers", () => {
    const payload = validPayload();
    payload.story_result.story += "\n\nТвое давнее увлечение живописью помогает различать тонкие оттенки тумана. Этот текст не является предсказанием будущих событий.";
    const result = parsePersonalMythResult(JSON.stringify(payload));
    const quality = validatePersonalMythResult(result);
    expect(quality.blockers).not.toContain("forbidden_public_language");
    expect(quality.blockers).not.toContain("affirmative_prediction_forbidden");
  });

  it("blocks forbidden language like 'карма' and 'магический'", () => {
    const payload = validPayload();
    payload.story_result.story += "\n\nТвоя прошлая карма определяет этот путь.";
    const result = parsePersonalMythResult(JSON.stringify(payload));
    const quality = validatePersonalMythResult(result);
    expect(quality.blockers).toContain("forbidden_public_language");
  });

  it("blocks serial fingerprints and unsupported certainty", () => {
    const fingerprint = parsePersonalMythResult(JSON.stringify(validPayload()));
    fingerprint.story += "\n\nВпервые за долгое время ты чувствуешь покой.";
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
    expect(generated.repaired).toBe(false);

    const broken: PersonalMythProvider = {
      ...provider,
      generate: async () => { throw new Error("provider_http_500"); },
    };
    await expect(generatePersonalMyth(request(), broken, 1000)).rejects.toThrow("provider_http_500");
  });

  describe("DeepSeek Myth Transport & Editorial Boundaries", () => {
    it("fails terminal 401 on exactly 1 HTTP attempt total", async () => {
      let httpCalls = 0;
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockImplementation(async () => {
        httpCalls += 1;
        return {
          ok: false,
          status: 401,
          text: async () => "Unauthorized: Invalid API key",
        } as Response;
      });

      try {
        const client = new DeepSeekClient({ DEEPSEEK_API_KEY: "sk-12345678901234567890" });
        const provider = new DeepSeekMythProvider(process.env, client);

        await expect(generatePersonalMyth(request(), provider, 1000)).rejects.toThrow("provider_http_401");
        expect(httpCalls).toBe(1);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("retries persistent transient 503 exactly once (2 HTTP attempts total)", async () => {
      let httpCalls = 0;
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockImplementation(async () => {
        httpCalls += 1;
        return {
          ok: false,
          status: 503,
          text: async () => "Service Unavailable",
        } as Response;
      });

      try {
        const client = new DeepSeekClient({ DEEPSEEK_API_KEY: "sk-12345678901234567890" });
        const provider = new DeepSeekMythProvider(process.env, client);

        await expect(generatePersonalMyth(request(), provider, 1000)).rejects.toThrow("provider_http_503");
        expect(httpCalls).toBe(2);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("triggers editorial rewrite for quality failure with exactly 1 repair attempt", async () => {
      let attempts = 0;
      const badPayload = validPayload();
      badPayload.story_result.story += "\n\nТвоя прошлая карма определяет этот путь."; // forbidden word

      const provider: PersonalMythProvider = {
        name: "deepseek",
        model: "deepseek-v4-pro",
        isReady: () => true,
        generate: async () => {
          attempts += 1;
          if (attempts === 1) {
            return JSON.stringify(badPayload);
          }
          return JSON.stringify(validPayload());
        },
      };

      const res = await generatePersonalMyth(request(), provider, 1000);
      expect(res.repaired).toBe(true);
      expect(attempts).toBe(2);
      expect(res.quality.passed).toBe(true);
    });

    it("fails closed when both initial and repair attempts violate quality contract", async () => {
      let attempts = 0;
      const badPayload = validPayload();
      badPayload.story_result.story += "\n\nТвоя прошлая карма определяет этот путь.";

      const provider: PersonalMythProvider = {
        name: "deepseek",
        model: "deepseek-v4-pro",
        isReady: () => true,
        generate: async () => {
          attempts += 1;
          return JSON.stringify(badPayload);
        },
      };

      await expect(generatePersonalMyth(request(), provider, 1000)).rejects.toThrow("personal_myth_quality_failed");
      expect(attempts).toBe(2);
    });
  });
});

