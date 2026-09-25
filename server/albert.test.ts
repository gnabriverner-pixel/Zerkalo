import { describe, expect, it, vi } from "vitest";
import {
  AlbertCanonicalError,
  generateAlbertDialogue,
  buildCanonicalEnvelopeFromWebContext,
  type AlbertDialogueRequest,
} from "./albert";

describe("Albert Web Dialogue Canonical DTO Adapter (digital-code-system/telegram_v2.albert)", () => {
  const sampleRequest: AlbertDialogueRequest = {
    message: "Почему код и миф так по-разному видят мою энергию?",
    history: [
      { sender: "user", text: "Здравствуйте, Альберт." },
      { sender: "albert", text: "Здравствуйте. Я готов обсудить встречу ваших двух зеркал. О чем хотите спросить?" },
    ],
    context: {
      meetingSummary: "Код указывает на структурный стержень, а миф — на поиск тишины.",
      confidenceNote: "Тонкий резонанс двух граней.",
      centralQuestion: "Где вы находите равновесие?",
      resonances: [
        {
          theme: "Потребность в тишине",
          codeAnchor: "Число Души 7",
          mythAnchor: "Образ туманного сада",
          synthesis: "Желание слышать себя глубже.",
        },
      ],
      divergences: [
        {
          theme: "Внешний напор",
          codeAspect: "Путь 1",
          mythAspect: "Замедление",
          reflection: "Контраст динамики и покоя.",
        },
      ],
      codeAnchors: {
        numbers: { soul: 7, path: 1, direction: 8, expression: 9, result: 5 },
        keyInsight: "Соединение глубины и действия.",
      },
      mythAnchors: {
        title: "Сад у воды",
        mainImage: "Туманный сад",
        innerTension: "Развилка",
        hiddenResource: "Спокойный шаг",
        newView: "Право на неспешность",
      },
    },
  };

  it("buildCanonicalEnvelopeFromWebContext builds valid SharedContextEnvelopeV1 matching DCS schema", () => {
    const envelope = buildCanonicalEnvelopeFromWebContext(sampleRequest.context, sampleRequest.history);

    expect(envelope.schema_version).toBe("telegram_v2.context.v1");
    expect(envelope.user_ref).toBeDefined();
    expect(envelope.consent.core_state).toBe(true);
    expect(envelope.retention.retention_class).toBe("standard");
    expect(envelope.derived_code.components.length).toBe(5);
    expect(envelope.experience_state.meeting_summary).toBe(sampleRequest.context!.meetingSummary);
    expect(envelope.active_thread.current_question).toBe(sampleRequest.context!.centralQuestion);

    // Verify parallels and divergences mapped into evidence
    const claimSummaries = envelope.evidence.map((e: any) => e.claim_summary);
    expect(claimSummaries.some((c: string) => c.includes("Потребность в тишине"))).toBe(true);
    expect(claimSummaries.some((c: string) => c.includes("Внешний напор"))).toBe(true);

    const parallelEv = envelope.evidence.find((e: any) => e.claim_summary.includes("Потребность в тишине"));
    expect(parallelEv.status).toBe("unreviewed");
    expect(parallelEv.source).toBe("resonance");

    const divergenceEv = envelope.evidence.find((e: any) => e.claim_summary.includes("Внешний напор"));
    expect(divergenceEv.status).toBe("unreviewed");
    expect(divergenceEv.source).toBe("divergence");
  });

  it("passes recent dialogue to the bridge and preserves an absent follow-up", async () => {
    // Transport contract test, not a live provider claim.
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      status: "ok", text: "Готовое приглашение.", provider: "deepseek", model: "test",
      next_open_loop: null, grounding_state: "grounded",
    }), { status: 200 }));
    let resp;
    try {
      resp = await generateAlbertDialogue(sampleRequest,undefined,'deepseek-v4-pro',45_000,{version:'zerkalo-2026-09-v1',recordedAt:1700000000000});
      const body = JSON.parse(fetchMock.mock.calls[0][1]!.body as string);
      expect(body.envelope.consent.recorded_at).toBe(new Date(1700000000000).toISOString());
      expect(body.envelope.consent.policy_version).toBe('zerkalo-2026-09-v1');
      expect(body.envelope.consent.cross_surface).toBe(false);
      expect(body.envelope.memory_summary.recent_turns).toEqual([
        { role: "user", text: sampleRequest.history![0].text },
        { role: "assistant", text: sampleRequest.history![1].text },
      ]);
    } finally {
      fetchMock.mockRestore();
    }

    expect(resp.status).toBe("ok");
    expect(resp.authority).toBe("digital-code-system/telegram_v2.albert.orchestrator");
    expect(resp.message).toBeDefined();
    expect(resp.message.length).toBeGreaterThan(10);
    expect(resp.next_open_loop).toBeNull();
    expect(resp.grounding_state).toBeDefined();
  }, 45_000);

  it("bounds history without losing recent corrections or promoting assistant text to evidence", () => {
    const history: AlbertDialogueRequest["history"] = Array.from({ length: 12 }, (_, i) => ({
      sender: i % 2 ? "albert" : "user", text: `${i}: ` + "x".repeat(2200),
    }));
    history.push({ sender: "user", text: "Нет, описание не про меня." });
    const envelope = buildCanonicalEnvelopeFromWebContext(undefined, history);
    expect(envelope.memory_summary.recent_turns).toHaveLength(8);
    expect(envelope.memory_summary.recent_turns.every((t: any) => t.text.length <= 2000)).toBe(true);
    expect(envelope.memory_summary.recent_turns.at(-1).text).toBe("Нет, описание не про меня.");
    expect(envelope.evidence).toEqual([]);
  });

  it("fails closed on invalid or oversized user messages", async () => {
    await expect(generateAlbertDialogue({ message: "" })).rejects.toThrow(/invalid_message/);
    await expect(generateAlbertDialogue({ message: "   " })).rejects.toThrow(/invalid_message/);
    await expect(generateAlbertDialogue({ message: "a".repeat(2001) })).rejects.toThrow(/invalid_message/);
  });

  it("keeps only status, safe error code, and request ID from a failed DCS response", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      error: "provider_unavailable", message: "private downstream detail",
    }), { status: 503 }));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      let caught: unknown;
      try {
        await generateAlbertDialogue(sampleRequest);
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeInstanceOf(AlbertCanonicalError);
      expect(caught).toMatchObject({
        downstreamStatus: 503, downstreamCode: "provider_unavailable",
      } satisfies Partial<AlbertCanonicalError>);
      const serializedErr = JSON.stringify(caught);
      expect(serializedErr).not.toContain("private downstream detail");
      expect(serializedErr).not.toContain("127.0.0.1");
      const emitted = JSON.stringify(log.mock.calls);
      expect(emitted).toContain("provider_unavailable");
      expect(emitted).not.toContain("private downstream detail");
      expect(emitted).not.toContain("127.0.0.1");
    } finally {
      fetchMock.mockRestore();
      log.mockRestore();
    }
  });

  it("fails closed when DCS bridge is down (never produces local independent prompt)", async () => {
    const originalUrl = process.env.DCS_BRIDGE_URL;
    try {
      process.env.DCS_BRIDGE_URL = "http://127.0.0.1:49999";
      await expect(generateAlbertDialogue(sampleRequest, undefined, "deepseek-v4-pro", 500)).rejects.toThrow();
    } finally {
      process.env.DCS_BRIDGE_URL = originalUrl;
    }
  });

  it("rejects safety_state=deferred from DCS orchestrator as AlbertCanonicalError instead of a live reply", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      status: "ok",
      safety_state: "deferred",
      text: "Ответ отложен.",
      model: null,
      provider_events: [{ provider: "routerai", outcome: "error" }],
    }), { status: 200 }));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await expect(generateAlbertDialogue(sampleRequest)).rejects.toMatchObject({
        downstreamStatus: 200,
        downstreamCode: "safety_state_deferred",
        canonical_status: 200,
        canonical_error: "safety_state_deferred",
        provider_outcome: "error",
      } satisfies Partial<AlbertCanonicalError>);
    } finally {
      fetchMock.mockRestore();
      log.mockRestore();
    }
  });
});
