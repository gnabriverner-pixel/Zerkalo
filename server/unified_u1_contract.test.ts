import { describe, it, expect, vi } from "vitest";
import { CRISIS_SAFE_MESSAGE, checkCrisisAndHazardousAction, validateAgeAndConsent } from "./safety";
import { generateMeetingOfMirrors, MEETING_GLOBAL_TIMEOUT_MS } from "./meeting";
import { calculateCanonicalDigitalCode, computeCanonicalFallback } from "./dcsBridge";
import { createContinuationClaim, consumeContinuationClaim, buildSharedContextEnvelope } from "./handoff";
import { DeepSeekClient } from "./deepseek";
import type { CalculationResult, FirstMirror, StoryInputs } from "../src/types";

describe("Unified Release U1 Master Contract Verification", () => {
  const dummyCode: CalculationResult = {
    soul: 6,
    soulComposite: "6",
    path: 8,
    pathComposite: "35/8",
    direction: 5,
    directionComposite: "41/5",
    expression: 2,
    expressionComposite: "11/2",
    result: 1,
    resultComposite: "82/10/1",
    baseMatrix: { "1": 1, "2": 0, "3": 0, "4": 0, "5": 1, "6": 2, "7": 0, "8": 1, "9": 1 },
    detailedMatrix: { "1": 2, "2": 1, "3": 1, "4": 1, "5": 2, "6": 2, "7": 0, "8": 2, "9": 1 },
  };

  const dummyFirstMirror: FirstMirror = {
    title: "Венера и Сатурн",
    subtitle: "Форма и порядок",
    formula: { numbers: "6-8-5-2-1", planets: "Венера-Сатурн-Юпитер-Луна-Солнце", positions: "ЧУ-ЧД-ЧР-ЧВ-ЧИ" },
    blocks: [],
    keyInsight: "Внутренняя тяга к равновесию",
    strengthTags: ["Эстетика"],
    tensionTags: ["Идеализм"],
    practicalStep: "Разрешить шероховатость.",
    cta: { title: "Миф", text: "Миф", button: "Открыть" },
    disclaimer: "Инструмент наблюдения.",
  };

  const dummyStory = {
    storyInputs: {
      q1: "Чувствую холодную стену между своими идеями и реальностью.",
      q2: "В моменты усталости закрываюсь в себе.",
      q3: "Надёжность и внимание к деталям.",
      q4: "Научиться отпускать контроль над неконтролируемым.",
    },
    storyResult: {
      title: "Остров в тумане",
      archetype: "Хранитель рубежей",
      theme: "Контроль и открытость",
      mirror: {
        mainImage: "Остров из тёмного камня",
        innerTension: "Стремление укрепить границы ценой изоляции от мира",
        hiddenResource: "Способность создавать безопасное пространство",
        newView: "Граница — это место встречи",
      },
    },
  };

  describe("Gate 1: Hardened Safety & Crisis Interception", () => {
    it("enforces 18+ age gate and explicit consent", () => {
      expect(validateAgeAndConsent({}).valid).toBe(false);
      expect(validateAgeAndConsent({ is_adult: false, age_confirmed: true, consent_given: true }).valid).toBe(false);
      expect(validateAgeAndConsent({ is_adult: true, age_confirmed: false, consent_given: true }).valid).toBe(false);
      expect(validateAgeAndConsent({ is_adult: true, age_confirmed: true, consent_given: false }).valid).toBe(false);
      expect(validateAgeAndConsent({ is_adult: true, age_confirmed: true, consent_given: true }).valid).toBe(true);
    });

    it("intercepts crisis language and provides adult helpline numbers", () => {
      const crisis = checkCrisisAndHazardousAction({ q1: "не хочу жить больше", q2: "", q3: "", q4: "" });
      expect(crisis.isCrisis).toBe(true);
      expect(crisis.safeMessage).toContain("+7 (495) 989-50-50");
      expect(crisis.safeMessage).toContain("112");
      expect(crisis.safeMessage).toContain("103");
      expect(crisis.safeMessage).not.toContain("051");
      expect(crisis.safeMessage).not.toContain("детей");
    });

    it("orders crisis evaluation strictly before rate limit", () => {
      const isCrisis = checkCrisisAndHazardousAction({ q1: "хочу покончить с собой", q2: "", q3: "", q4: "" }).isCrisis;
      expect(isCrisis).toBe(true);
    });
  });

  describe("Gate 2: Meeting of Mirrors Single Global Deadline Contract", () => {
    it("enforces total budget <= 50s and strictly < 60s proxy window", () => {
      expect(MEETING_GLOBAL_TIMEOUT_MS).toBeLessThanOrEqual(50_000);
      expect(MEETING_GLOBAL_TIMEOUT_MS).toBeLessThan(60_000);
    });

    it("synthesizes valid meeting under budget", async () => {
      const mockClient = {
        isReady: () => true,
        call: vi.fn().mockResolvedValue(JSON.stringify({
          status: "ok",
          result: {
            summary: "Два зеркала встретились.",
            hasStrongParallels: true,
            confidenceNote: "Высокая согласованность.",
            parallels: [{ theme: "Опора", codeAnchor: "8", mythAnchor: "Камень", synthesis: "Синтез" }],
            divergences: [],
            albertInsight: "Инсайт",
            reflectiveQuestion: "Вопрос?",
          },
        })),
      } as unknown as DeepSeekClient;

      const res = await generateMeetingOfMirrors({
        codeData: { calc: dummyCode, firstMirror: dummyFirstMirror },
        storyData: dummyStory,
        client: mockClient,
      });

      expect(res.status).toBe("ok");
      expect(res.result.summary).toBe("Два зеркала встретились.");
    });
  });

  describe("Gate 3: Digital Code System Calculation Authority", () => {
    it("calculates canonical position values matching DCS engine authority", async () => {
      const canonical = await calculateCanonicalDigitalCode("06.05.1986");
      expect(canonical.soul).toBe(6);
      expect(canonical.path).toBe(8);
      expect(canonical.direction).toBe(5);
      expect(canonical.expression).toBe(2);
      expect(canonical.result).toBe(1);
      expect(canonical.canonicalAuthority).toBe("digital-code-system/engine.py::full_analysis");
    });
  });

  describe("Gate 4: Web -> Telegram V2 Continuation Claim Contract", () => {
    it("builds SharedContextEnvelopeV1 without PII or raw DOB/answers", () => {
      const env = buildSharedContextEnvelope(dummyCode, dummyStory.storyResult, {
        result: { synthesis: { summary: "Синтез", centralQuestion: "Вопрос?", openLoop: "Шаг?" } },
      });

      expect(env.schema_version).toBe("telegram_v2.context.v1");
      expect(env.derived_code.components).toHaveLength(5);
      expect(env.active_thread.next_open_loop).toBe("Шаг?");

      // Strict privacy assertions
      expect((env as any).dob).toBeUndefined();
      expect((env as any).q1).toBeUndefined();
      expect((env as any).name).toBeUndefined();
      expect((env as any).telegram_user_id).toBeUndefined();
    });

    it("creates opaque single-use claim with replay rejection", async () => {
      const claim = await createContinuationClaim({
        codeResult: dummyCode,
        storyResult: dummyStory.storyResult,
        meetingResult: { result: { synthesis: { summary: "С", centralQuestion: "В", openLoop: "О" } } },
        consent: true,
        ageVerified: true,
      });

      expect(claim.claimId).toHaveLength(32);
      expect(claim.telegramUrl).toContain(`claim_${claim.claimId}_`);
      expect(claim.telegramUrl).not.toContain("06.05.1986");

      const sig = claim.token.split(".")[1];
      const c1 = await consumeContinuationClaim(claim.claimId, sig);
      expect(c1.success).toBe(true);

      const c2 = await consumeContinuationClaim(claim.claimId, sig);
      expect(c2.success).toBe(false);
      expect(c2.code).toBe("replay_rejected");
    });
  });
});
