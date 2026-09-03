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
});
