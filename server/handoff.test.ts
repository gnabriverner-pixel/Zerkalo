import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs/promises";
import path from "path";
import {
  createContinuationClaim,
  consumeContinuationClaim,
  signClaim,
  verifyClaimSignature,
  buildSharedContextEnvelope,
  CLAIM_TTL_MS,
} from "./handoff";
import type { CalculationResult } from "../src/types";

describe("Web -> Telegram V2 Continuation Claim Contract", () => {
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

  const dummyStory = {
    storyInputs: { q1: "q1", q2: "q2", q3: "q3", q4: "q4" },
    mirror: { mainImage: "Кристалл в скале", innerTension: "Хрупкость и твердость" },
  };

  const dummyMeeting = {
    result: {
      synthesis: {
        summary: "Синтез структуры и формы",
        centralQuestion: "Где грань между защитой и замкнутостью?",
        openLoop: "Какой первый шаг вы сделаете сегодня?",
      },
    },
  };

  it("buildSharedContextEnvelope guarantees NO PII and NO raw DOB/answers", () => {
    const env = buildSharedContextEnvelope(dummyCode, dummyStory, dummyMeeting);

    expect(env.schema_version).toBe("telegram_v2.context.v1");
    expect(env.derived_code.components.length).toBe(5);
    expect(env.experience_state.myth_summary).toContain("Кристалл в скале");
    expect(env.active_thread.current_question).toContain("Где грань");
    expect(env.active_thread.next_open_loop).toContain("Какой первый шаг");

    // Negative assertions: Identity-minimization law
    expect((env as any).dob).toBeUndefined();
    expect((env as any).name).toBeUndefined();
    expect((env as any).email).toBeUndefined();
    expect((env as any).phone).toBeUndefined();
    expect((env as any).telegram_user_id).toBeUndefined();
    expect((env as any).chat_id).toBeUndefined();
    expect((env as any).q1).toBeUndefined();
    expect((env as any).q2).toBeUndefined();
    expect((env as any).q3).toBeUndefined();
    expect((env as any).q4).toBeUndefined();
  });

  it("creates valid single-use signed claim", async () => {
    const claim = await createContinuationClaim({
      codeResult: dummyCode,
      storyResult: dummyStory,
      meetingResult: dummyMeeting,
      consent: true,
      ageVerified: true,
    });

    expect(claim.claimId).toHaveLength(32);
    expect(claim.token).toContain(claim.claimId);
    expect(claim.telegramUrl).toContain(`claim_${claim.claimId}_`);
    // URL contains no PII, no DOB
    expect(claim.telegramUrl).not.toContain("06.05.1986");
    expect(claim.telegramUrl).not.toContain("dob");
    expect(claim.telegramUrl).not.toContain("email");

    // First consumption succeeds
    const sig = claim.token.split(".")[1];
    const consumed1 = await consumeContinuationClaim(claim.claimId, sig);
    expect(consumed1.success).toBe(true);
    expect(consumed1.envelope).toBeDefined();

    // Replay consumption fails
    const consumed2 = await consumeContinuationClaim(claim.claimId, sig);
    expect(consumed2.success).toBe(false);
    expect(consumed2.code).toBe("replay_rejected");
  });

  it("rejects tampered signature", async () => {
    const claim = await createContinuationClaim({
      codeResult: dummyCode,
      storyResult: dummyStory,
      meetingResult: dummyMeeting,
      consent: true,
      ageVerified: true,
    });

    const tamperedSig = "a" + claim.token.split(".")[1].slice(1);
    const result = await consumeContinuationClaim(claim.claimId, tamperedSig);
    expect(result.success).toBe(false);
    expect(result.code).toBe("tamper_rejected");
  });

  it("fails if consent or age verification is absent", async () => {
    await expect(
      createContinuationClaim({
        codeResult: dummyCode,
        storyResult: dummyStory,
        meetingResult: dummyMeeting,
        consent: false,
        ageVerified: true,
      })
    ).rejects.toThrow(/consent_required/);

    await expect(
      createContinuationClaim({
        codeResult: dummyCode,
        storyResult: dummyStory,
        meetingResult: dummyMeeting,
        consent: true,
        ageVerified: false,
      })
    ).rejects.toThrow(/age_requirement_not_met/);
  });

  it("preserves exact production MeetingOfMirrorsResult sentinel fingerprints in SharedContextEnvelope", () => {
    const sentinelSummary = "SENTINEL_SUMMARY_RESONANCE_ALPHA_987654";
    const sentinelQuestion = "SENTINEL_LIVING_QUESTION_OMEGA_123456?";
    const sentinelParallelTheme = "SENTINEL_PARALLEL_THEME_777";
    const sentinelDivergenceTheme = "SENTINEL_DIVERGENCE_THEME_888";
    const sentinelAlbertInsight = "SENTINEL_ALBERT_INSIGHT_555";

    const productionMeeting = {
      summary: sentinelSummary,
      hasStrongParallels: true,
      confidenceNote: "Высокая согласованность",
      parallels: [
        {
          theme: sentinelParallelTheme,
          codeAnchor: "Число Действия 8",
          mythAnchor: "Остров в тумане",
          synthesis: "Сатурнианская опора подтверждается островным рубежом",
        },
      ],
      divergences: [
        {
          theme: sentinelDivergenceTheme,
          codeAspect: "Число Сознания 6",
          mythAspect: "Каменная стена",
          reflection: "Защита не должна превращаться в глухой затвор",
        },
      ],
      albertInsight: sentinelAlbertInsight,
      reflectiveQuestion: sentinelQuestion,
      disclaimer: "Инструмент самонаблюдения",
    };

    const envelope = buildSharedContextEnvelope(dummyCode, dummyStory, productionMeeting);

    // 1. Exact meeting summary preserved
    expect(envelope.experience_state.meeting_summary).toBe(sentinelSummary);

    // 2. Exact living question preserved in active_thread
    expect(envelope.active_thread.current_question).toBe(sentinelQuestion);
    expect(envelope.active_thread.next_open_loop).toBe(sentinelQuestion);
    expect(envelope.active_thread.topic_summary).toBe(sentinelAlbertInsight);

    // 3. Evidence contains both parallels (confirmed) and divergences (partial/contrast)
    const claimSummaries = envelope.evidence.map((e: any) => e.claim_summary);
    expect(claimSummaries.some((c: string) => c.includes(sentinelSummary.slice(0, 50)))).toBe(true);
    expect(claimSummaries.some((c: string) => c.includes(sentinelParallelTheme))).toBe(true);
    expect(claimSummaries.some((c: string) => c.includes(sentinelDivergenceTheme))).toBe(true);

    const parallelEv = envelope.evidence.find((e: any) => e.claim_summary.includes(sentinelParallelTheme));
    expect(parallelEv.status).toBe("confirmed");

    const divergenceEv = envelope.evidence.find((e: any) => e.claim_summary.includes(sentinelDivergenceTheme));
    expect(divergenceEv.status).toBe("partial");
  });

  it("fails closed when meeting context is invalid or missing required fields (no silent generic defaults)", () => {
    // Missing meeting entirely
    expect(() => buildSharedContextEnvelope(dummyCode, dummyStory, null)).toThrow(/invalid_meeting_dto/);
    expect(() => buildSharedContextEnvelope(dummyCode, dummyStory, undefined)).toThrow(/invalid_meeting_dto/);
    expect(() => buildSharedContextEnvelope(dummyCode, dummyStory, {})).toThrow(/invalid_meeting_dto:missing_required_summary/);

    // Missing summary
    expect(() => buildSharedContextEnvelope(dummyCode, dummyStory, {
      reflectiveQuestion: "Куда ведет этот путь?",
    })).toThrow(/invalid_meeting_dto:missing_required_summary/);

    // Missing reflective question
    expect(() => buildSharedContextEnvelope(dummyCode, dummyStory, {
      summary: "Обнаружен явный резонанс формы и содержания.",
    })).toThrow(/invalid_meeting_dto:missing_required_reflective_question/);
  });
});
