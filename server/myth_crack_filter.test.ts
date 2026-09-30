import { describe, it, expect } from "vitest";
import {
  validatePersonalMythResult,
  parsePersonalMythRequest,
  buildPersonalMythRepairPrompt,
  formatBlockerForRepair,
  findUnpromptedDamageMatches,
  userIntroducedDamage,
  generatePersonalMyth,
  PERSONAL_MYTH_WRITER_VERSION,
  PersonalMythResult,
  PersonalMythProvider,
} from "./myth";

function makeCleanFixture(inserted: string, targetField: "story" | "mirror.innerTension" | "mirror.mainImage" | "meaning" | "one_step" | "journal_question" = "story"): PersonalMythResult {
  const p1 = "Ты входишь в светлую просторную мастерскую ранним утром, когда прохладная утренняя тишина еще держит каждый предмет на своем привычном месте. На широком дубовом верстаке лежит деревянная шкатулка, поверхность которой отполирована временем и долгими прикосновениями рук мастера. Рядом аккуратно разложены рабочие инструменты: стамески разной ширины, деревянный молоток, металлическая линейка с ровными делениями. Ты проводишь ладонью по гладкой древесине, ощущая легкую прохладу и устойчивый вес предмета, который не требует поспешных действий. В воздухе стоит сухой смолистый запах сосновой стружки, напоминающий о неторопливом, внимательном и надежном труде.";
  const p2 = "Ты берешь в руки старый компас и кладешь его рядом со шкатулкой, замечая, как тонкая стрелка медленно успокаивается и указывает точно на север. В этом рабочем пространстве нет внешней спешки и нет постоянного давления чужих ожиданий. Ты сам выбираешь темп, в котором будешь сверять размеры и наносить разметку на подготовленную заготовку. Каждое движение выверено и спокойно. Ты знаешь, что подлинная точность рождается не из суеты, а из редкой способности дать себе время на один внимательный взгляд перед каждым следующим важным шагом в работе.";
  const p3 = "Ты делаешь небольшую паузу, глядя в светлое окно мастерской, и возвращаешься к работе с ясным пониманием того, что главное решение уже принято внутри. На столе перед тобой лежат старые чертежи, и ты спокойно перекладываешь лист плотной бумаги, освобождая свободное место для новой разметки. Ты видишь, как утренний солнечный луч падает на крышку шкатулки и освещает каждую волокнистую линию сухого дерева. Ничто не подгоняет тебя вперед, и ты спокойно продолжаешь начатое дело, шаг за шагом следуя выбранному внутреннему ритму.";
  const p4 = "Перед тем как взять резец, ты еще раз внимательно осматриваешь поверхность заготовки. " + (targetField === "story" ? inserted : "Поверхность предмета остается совершенно гладкой.") + " Ты чувствуешь уверенность в руках и готовность завершить начатую работу с должным вниманием, терпением и профессиональной аккуратностью. Каждый следующий жест возвращает ощущение устойчивости и контроля над процессом.";
  const p5 = "Ты аккуратно берешь деревянный брусок, сверяешь линию среза с отметкой на чертеже и делаешь первое точное движение. Звук ровно снимаемой стружки наполняет комнату спокойствием. Ты знаешь, что впереди еще много работы, но этот первый уверенный шаг задает правильное направление всему дню.";

  const story = [p1, p2, p3, p4, p5].join("\n\n");

  return {
    title: "Латунь на краю стола",
    story,
    mirror: {
      mainImage: targetField === "mirror.mainImage" ? `В вашем ответе появляется образ: ${inserted}` : "В вашем ответе появляется образ деревянной шкатулки на верстаке.",
      innerTension: targetField === "mirror.innerTension" ? `В вашем ответе чувствуется напряжение: ${inserted}` : "В вашем ответе чувствуется напряжение между спешкой и желанием действовать точно.",
      hiddenResource: "Возможность сделать паузу и спокойно сверить размеры перед началом работы.",
      newView: "Взгляд на собственный темп как на естественную опору в сложных решениях."
    },
    meaning: targetField === "meaning" ? ["Точность как выбор", inserted, "Право на свой шаг"] : ["Точность как выбор", "Устойчивость без спешки", "Право на свой шаг"],
    one_step: targetField === "one_step" ? `Положите ладонь на край стола: ${inserted}` : "Перед следующим решением положите ладонь на край стола и сделайте один спокойный выдох.",
    journal_question: targetField === "journal_question" ? `Что для вас значит этот образ: ${inserted}?` : "В какой ситуации сегодня вы можете позволить себе не спешить с ответом?",
    disclaimer: "Образный формат для саморефлексии. Не диагностика и не инструкция к действию."
  };
}

const defaultRequest = parsePersonalMythRequest({
  request_id: "req_clean_bench",
  consent_version: PERSONAL_MYTH_WRITER_VERSION,
  answers: {
    q1: "Сложный проект, боюсь спешки.",
    q2: "Деревянная шкатулка на верстаке.",
    q3: "Утренний чай в тишине.",
    q4: "Спокойствия."
  }
});

describe("Personal Myth V11: Targeted Crack Filter & Reliability Suite", () => {
  describe("1. Full 13-row Defect Matrix", () => {
    const matrixCases = [
      { id: "case_01", text: "на крышке появилась трещина", expected: "BLOCK" },
      { id: "case_02", text: "на краю виден скол", expected: "BLOCK" },
      { id: "case_03", text: "заметен надлом", expected: "BLOCK" },
      { id: "case_04", text: "поверхность без трещин", expected: "ALLOW" },
      { id: "case_05", text: "крышка без единой трещины", expected: "ALLOW" },
      { id: "case_06", text: "без трещин и сколов", expected: "ALLOW" },
      { id: "case_07", text: "без малейшей щербинки", expected: "ALLOW" },
      { id: "case_08", text: "не трещина и не надлом", expected: "ALLOW" },
      { id: "case_09", text: "без трещин, но со сколом", expected: "BLOCK" },
      { id: "case_10", text: "не трещина, а надлом", expected: "BLOCK" },
      { id: "case_11", text: "крышка без трещин. На краю виден скол", expected: "BLOCK" },
      { id: "case_12a", text: "лодка бороздит воду", expected: "ALLOW" },
      { id: "case_12b", text: "бороздя воду", expected: "ALLOW" },
      { id: "case_13", text: "гладкая ровная поверхность дерева", expected: "ALLOW" },
    ];

    for (const tc of matrixCases) {
      it(`evaluates ${tc.id}: "${tc.text}" -> ${tc.expected}`, () => {
        const fixture = makeCleanFixture(tc.text, "story");
        const quality = validatePersonalMythResult(fixture, defaultRequest);
        const hasCrackBlocker = quality.blockers.includes("unprompted_crack_cliche");
        const actualDecision = hasCrackBlocker ? "BLOCK" : "ALLOW";
        expect(actualDecision).toBe(tc.expected);

        if (tc.expected === "ALLOW") {
          expect(quality.passed).toBe(true);
          expect(quality.blockers).not.toContain("unprompted_crack_cliche");
        } else {
          expect(quality.passed).toBe(false);
          expect(quality.blockers).toContain("unprompted_crack_cliche");
          expect(quality.damageMatches).toBeDefined();
          expect(quality.damageMatches!.length).toBeGreaterThan(0);
        }
      });
    }
  });

  describe("2. Casing, ё/е, Punctuation, and Idempotence", () => {
    it("handles uppercase, mixed case and trailing punctuation without false positives or negatives", () => {
      const allowedSamples = [
        "Крышка Без Единой Трещины!",
        "БЕЗ ТРЕЩИН И СКОЛОВ.",
        "Не Трещина И Не Надлом;",
        "без щёрбинки и без сколов",
        "без малейшей щербинки...",
      ];

      for (const sample of allowedSamples) {
        const fixture = makeCleanFixture(sample, "story");
        const quality = validatePersonalMythResult(fixture, defaultRequest);
        expect(quality.blockers).not.toContain("unprompted_crack_cliche");
      }

      const blockedSamples = [
        "НА КРЫШКЕ ПОЯВИЛАСЬ ТРЕЩИНА!",
        "НА КРАЮ ВИДЕН СКОЛ.",
        "ЗАМЕТЕН НАДЛОМ;",
        "поверхность без трещин — но со сколом",
      ];

      for (const sample of blockedSamples) {
        const fixture = makeCleanFixture(sample, "story");
        const quality = validatePersonalMythResult(fixture, defaultRequest);
        expect(quality.blockers).toContain("unprompted_crack_cliche");
      }
    });

    it("executes 200 consecutive checks idempotently without regex state leakage", () => {
      for (let i = 0; i < 200; i++) {
        const allowRes = validatePersonalMythResult(makeCleanFixture("крышка без единой трещины"), defaultRequest);
        const blockRes = validatePersonalMythResult(makeCleanFixture("на краю виден скол"), defaultRequest);
        expect(allowRes.blockers).not.toContain("unprompted_crack_cliche");
        expect(blockRes.blockers).toContain("unprompted_crack_cliche");
      }
    });
  });

  describe("3. Explicit User Damage vs Negated User Mentions", () => {
    it("permits crack story when user explicitly introduces damage in q2", () => {
      const userWithCrackReq = parsePersonalMythRequest({
        request_id: "req_user_crack",
        consent_version: PERSONAL_MYTH_WRITER_VERSION,
        answers: {
          q1: "Сложный переход",
          q2: "Старая чашка с тонкой трещиной на краю",
          q3: "Пауза в тишине",
          q4: "Спокойствия"
        }
      });

      expect(userIntroducedDamage(userWithCrackReq.answers.q2)).toBe(true);

      const fixture = makeCleanFixture("На краю чашки заметна тонкая трещина.");
      const quality = validatePersonalMythResult(fixture, userWithCrackReq);
      expect(quality.blockers).not.toContain("unprompted_crack_cliche");
    });

    it("does NOT grant permission for damage when user denies damage in q2", () => {
      const userNegatedReq = parsePersonalMythRequest({
        request_id: "req_user_negated_crack",
        consent_version: PERSONAL_MYTH_WRITER_VERSION,
        answers: {
          q1: "Сложный переход",
          q2: "Старая деревянная шкатулка без единой трещины",
          q3: "Пауза в тишине",
          q4: "Спокойствия"
        }
      });

      // User did NOT introduce positive damage
      expect(userIntroducedDamage(userNegatedReq.answers.q2)).toBe(false);

      // Model hallucinates positive crack -> MUST BE BLOCKED!
      const unpromptedFixture = makeCleanFixture("На крышке появилась трещина.");
      const quality = validatePersonalMythResult(unpromptedFixture, userNegatedReq);
      expect(quality.blockers).toContain("unprompted_crack_cliche");

      // Model mirrors user's negated statement -> ALLOWED!
      const negatedFixture = makeCleanFixture("Поверхность без единой трещины.");
      const allowQuality = validatePersonalMythResult(negatedFixture, userNegatedReq);
      expect(allowQuality.blockers).not.toContain("unprompted_crack_cliche");
    });
  });

  describe("4. Targeted Repair & Field Isolation", () => {
    it("identifies damage tokens across all result fields before concatenation", () => {
      const storyDamage = makeCleanFixture("на крышке появилась трещина", "story");
      const tensionDamage = makeCleanFixture("заметен надлом", "mirror.innerTension");
      const meaningDamage = makeCleanFixture("старый скол", "meaning");
      const stepDamage = makeCleanFixture("заметить трещину", "one_step");
      const questionDamage = makeCleanFixture("почему появился скол", "journal_question");

      expect(findUnpromptedDamageMatches(storyDamage)).toEqual([{ field: "story", token: "трещина" }]);
      expect(findUnpromptedDamageMatches(tensionDamage)).toEqual([{ field: "mirror.innerTension", token: "надлом" }]);
      expect(findUnpromptedDamageMatches(meaningDamage)).toEqual([{ field: "meaning", token: "скол" }]);
      expect(findUnpromptedDamageMatches(stepDamage)).toEqual([{ field: "one_step", token: "трещину" }]);
      expect(findUnpromptedDamageMatches(questionDamage)).toEqual([{ field: "journal_question", token: "скол" }]);
    });

    it("formats targeted repair instructions with exact fields and tokens", () => {
      const matches = [
        { field: "mirror.innerTension", token: "надлом" },
        { field: "story", token: "трещина" }
      ];

      const repairText = formatBlockerForRepair("unprompted_crack_cliche", matches);
      expect(repairText).toContain("mirror.innerTension: «надлом»");
      expect(repairText).toContain("story: «трещина»");
      expect(repairText).toContain("КАТЕГОРИЧЕСКИ ЗАПРЕЩЁН");

      const prompt = buildPersonalMythRepairPrompt(
        defaultRequest,
        "story with error",
        { mainImage: "", innerTension: "", hiddenResource: "", newView: "" },
        ["unprompted_crack_cliche"],
        undefined,
        matches
      );

      expect(prompt).toContain("mirror.innerTension: «надлом»");
      expect(prompt).toContain("story: «трещина»");
    });
  });

  describe("5. Deterministic Provider Stub Scenarios", () => {
    it("scenario 1: initial attempt passes -> 1 provider call, 0 repair calls", async () => {
      let calls = 0;
      const cleanPayload = makeCleanFixture("Поверхность предмета остается совершенно гладкой.");

      const provider: PersonalMythProvider = {
        name: "test_stub",
        model: "stub-model",
        isReady: () => true,
        generate: async () => {
          calls += 1;
          return JSON.stringify({ mode: "story", status: "ok", story_result: cleanPayload });
        }
      };

      const res = await generatePersonalMyth(defaultRequest, provider, 1000);
      expect(calls).toBe(1);
      expect(res.repaired).toBe(false);
      expect(res.initialPassed).toBe(true);
      expect(res.quality.passed).toBe(true);
    });

    it("scenario 2: initial attempt contains damage -> targeted repair succeeds -> 2 provider calls", async () => {
      let calls = 0;
      let repairPromptReceived = "";

      const damagedPayload = makeCleanFixture("на крышке появилась трещина", "story");
      const repairedPayload = makeCleanFixture("поверхность крышки ровная и гладкая", "story");

      const provider: PersonalMythProvider = {
        name: "test_stub",
        model: "stub-model",
        isReady: () => true,
        generate: async (prompt) => {
          calls += 1;
          if (calls === 1) {
            return JSON.stringify({ mode: "story", status: "ok", story_result: damagedPayload });
          }
          repairPromptReceived = prompt;
          return JSON.stringify({ mode: "story", status: "ok", story_result: repairedPayload });
        }
      };

      const res = await generatePersonalMyth(defaultRequest, provider, 1000);
      expect(calls).toBe(2);
      expect(res.repaired).toBe(true);
      expect(res.initialPassed).toBe(false);
      expect(res.initialBlockers).toContain("unprompted_crack_cliche");
      expect(res.quality.passed).toBe(true);
      expect(repairPromptReceived).toContain("story: «трещина»");
    });

    it("scenario 3: damage in mirror.innerTension is caught and targeted in repair", async () => {
      let calls = 0;
      let repairPromptReceived = "";

      const damagedMirrorPayload = makeCleanFixture("заметен надлом в решении", "mirror.innerTension");
      const repairedMirrorPayload = makeCleanFixture("В вашем ответе чувствуется напряжение между спешкой и точностью", "mirror.innerTension");

      const provider: PersonalMythProvider = {
        name: "test_stub",
        model: "stub-model",
        isReady: () => true,
        generate: async (prompt) => {
          calls += 1;
          if (calls === 1) {
            return JSON.stringify({ mode: "story", status: "ok", story_result: damagedMirrorPayload });
          }
          repairPromptReceived = prompt;
          return JSON.stringify({ mode: "story", status: "ok", story_result: repairedMirrorPayload });
        }
      };

      const res = await generatePersonalMyth(defaultRequest, provider, 1000);
      expect(calls).toBe(2);
      expect(res.repaired).toBe(true);
      expect(repairPromptReceived).toContain("mirror.innerTension: «надлом»");
    });

    it("scenario 4: initial and repair both violate contract -> fails closed with error after 2 calls", async () => {
      let calls = 0;
      const damagedPayload = makeCleanFixture("на крышке появилась трещина", "story");

      const provider: PersonalMythProvider = {
        name: "test_stub",
        model: "stub-model",
        isReady: () => true,
        generate: async () => {
          calls += 1;
          return JSON.stringify({ mode: "story", status: "ok", story_result: damagedPayload });
        }
      };

      await expect(generatePersonalMyth(defaultRequest, provider, 1000)).rejects.toThrow("personal_myth_quality_failed");
      expect(calls).toBe(2);
    });
  });

  describe("6. Readiness 4-State Transition Matrix", () => {
    it("evaluates exact state transitions for liveGeneration.personal_myth", () => {
      const liveGeneration = { personal_myth: false };

      function handleMythError(errorOrCode: string | Error) {
        const rawMessage = typeof errorOrCode === "string" ? errorOrCode : errorOrCode.message;
        const code = rawMessage.split(":", 1)[0];
        const inputError = code.startsWith("invalid_");
        const notReady = code === "personal_myth_provider_not_ready";
        const qualityFailed = code === "personal_myth_quality_failed";
        if (!inputError && !qualityFailed) {
          liveGeneration.personal_myth = false;
        }
      }

      // State 1: Cold start (never succeeded). Content quality failure does NOT mark service ready.
      expect(liveGeneration.personal_myth).toBe(false);
      handleMythError("personal_myth_quality_failed:unprompted_crack_cliche");
      expect(liveGeneration.personal_myth).toBe(false); // REMAINS FALSE

      // State 2: Successful live generation occurs.
      liveGeneration.personal_myth = true;
      expect(liveGeneration.personal_myth).toBe(true);

      // Subsequent content quality failure does NOT erase previous live success.
      handleMythError("personal_myth_quality_failed:unprompted_crack_cliche");
      expect(liveGeneration.personal_myth).toBe(true); // REMAINS TRUE!

      // State 3: Provider transport error / timeout / not ready resets readiness.
      handleMythError("personal_myth_provider_not_ready");
      expect(liveGeneration.personal_myth).toBe(false); // RESETS TO FALSE

      // Re-verify after second success
      liveGeneration.personal_myth = true;
      handleMythError("personal_myth_failed:timeout");
      expect(liveGeneration.personal_myth).toBe(false); // RESETS TO FALSE

      // State 4: Input validation error does not mutate readiness
      liveGeneration.personal_myth = true;
      handleMythError("invalid_answers");
      expect(liveGeneration.personal_myth).toBe(true);
    });
  });
});
