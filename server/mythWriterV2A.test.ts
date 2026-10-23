// @vitest-environment node
import crypto from "node:crypto";
import fs from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CommerceStore } from "./commerceStore";
import { AIBudget, registerAIBudget } from "./aiBudget";
import { RouterAIClient, PRIMARY_MODEL, WRITER_V41_MODEL } from "./routerai";
import { maxAttempt, estimateAttempt } from "./aiTariffService.mjs";
import tariffs from "./aiTariffs.json";
import policy from "./aiBudgetPolicy.json";
import {
  DeepSeekMythProvider, containsCrisisLanguage, generatePersonalMyth, parsePersonalMythRequest, type PersonalMythProvider,
} from "./myth";
import {
  MYTH_WRITER_CONTRACT_V2, MYTH_WRITER_CONTRACT_V2_SHA256, WRITER_V2A_JSON_INSTRUCTION, WRITER_V2A_MODE_LINE, WRITER_V2A_SYSTEM_SHA256,
} from "./mythWriterV2ABrief";
import {
  PERSONAL_MYTH_WRITER_V2A_VERSION, WRITER_V2A_FAILURE_PREFIX, WRITER_V2A_MAX_TOKENS, buildWriterV2AUserMessage, findLatinWords,
  parseWriterV2AResponse, resolvePersonalMythWriter, validateWriterV2AResponse, writerV2AFallbackEligible, writerV2ASystemMessage,
  writerV2ASystemMessageIntact,
} from "./mythWriterV2A";
import { MYTH_V2A_QUESTIONS } from "../src/services/mythQuestionsV2A";
import { buildMeetingOfMirrorsPrompt } from "../src/services/mythPrompts";
import { STORY_SAMPLE_ANSWERS } from "./storySample";
import { PERSONAL_MYTH_WRITER_VERSION } from "./myth";

afterEach(() => vi.unstubAllEnvs());
const sha = (text: string) => crypto.createHash("sha256").update(text, "utf8").digest("hex");
const OPUS = WRITER_V41_MODEL;

// Synthetic answers carry recognisable markers. q2 is empty: the v2a questionnaire has three questions.
const answers = { q1: "СИТУАЦИЯ-один", q2: "", q3: "ЖИВОЙ-момент-три", q4: "ХОЧЕТСЯ-четыре" };
const request = () => parsePersonalMythRequest({ request_id: "request_1234567890", answers });
const rows = (n = 6) => Array.from({ length: n }, (_, i) => ({ element: `образ ${i + 1}`, source: `слова человека ${i + 1}` }));
const output = (over: Record<string, unknown> = {}) => ({
  title: "Синтетическое название", story: "Первый абзац сказки.\n\nВторой абзац сказки.", made_of: rows(),
  meaning: "Возможно, это про выбор. Посмотрите, похоже ли.", question: "Что вы сделаете первым?",
  practice: "Семь дней по одному шагу. Как поймёте, что получилось: руки перестанут дрожать.", ...over,
});
const okJson = JSON.stringify(output());

describe("prompt assembly", () => {
  it("contract constant is verbatim the docs file and both SHA-256 pins match", () => {
    const doc = fs.readFileSync(new URL("../docs/method/MYTH_WRITER_CONTRACT_V2.md", import.meta.url), "utf8");
    expect(MYTH_WRITER_CONTRACT_V2).toBe(doc.trimEnd());
    expect(sha(MYTH_WRITER_CONTRACT_V2)).toBe(MYTH_WRITER_CONTRACT_V2_SHA256);
    expect(sha(writerV2ASystemMessage())).toBe(WRITER_V2A_SYSTEM_SHA256);
    expect(writerV2ASystemMessageIntact()).toBe(true);
    expect(MYTH_WRITER_CONTRACT_V2.startsWith("# Контракт писателя «Личного мифа» · v2.0")).toBe(true);
    expect(MYTH_WRITER_CONTRACT_V2.trimEnd().endsWith("реальных имён, жаргона?")).toBe(true);
  });

  it("system message = contract + blank line + the exact mode-A line + JSON instruction", () => {
    const system = writerV2ASystemMessage();
    expect(WRITER_V2A_MODE_LINE).toBe("Режим А: чисел, планет, личного года и терминов Кода нет; пункты контракта о них пропусти.");
    expect(system).toBe(`${MYTH_WRITER_CONTRACT_V2}\n\n${WRITER_V2A_MODE_LINE}\n\n${WRITER_V2A_JSON_INSTRUCTION}`);
    expect(system.split(WRITER_V2A_MODE_LINE).length).toBe(2);
    for (const field of ["title", "story", "made_of", "meaning", "question", "practice"]) expect(WRITER_V2A_JSON_INSTRUCTION).toContain(field);
    // The fixed UI line is not asked from the model.
    expect(WRITER_V2A_JSON_INSTRUCTION).toContain("её добавит сайт");
  });

  it("user message: three answers in contract wording (q1, q3, q4), no q2, no Code data", () => {
    const polluted = { ...answers, birth_date: "1987-04-13", calc: { soul: 7, path: 9 }, personal_year: 4 } as any;
    const message = buildWriterV2AUserMessage(polluted);
    expect(message).toContain("1. Что сейчас происходит (ситуация, о которой хочется понять): СИТУАЦИЯ-один");
    expect(message).toContain("2. Где вы недавно были на своём месте (момент, когда было живо): ЖИВОЙ-момент-три");
    expect(message).toContain("3. Чего хочется больше: ХОЧЕТСЯ-четыре");
    expect(message).not.toMatch(/1987|04-13|birth|calc|soul|path|personal_year|Душа|Путь|планет/iu);
    expect(message.match(/\d+\./g)).toEqual(["1.", "2.", "3."]);
    expect(MYTH_V2A_QUESTIONS.map(q => q.key)).toEqual(["q1", "q3", "q4"]);
  });
});

describe("parser and validator", () => {
  const reason = (raw: unknown, a = answers) => { try { validateWriterV2AResponse(raw, a); } catch (e) { return (e as Error).message; } return "ACCEPTED"; };

  it("accepts a valid object, bare or in one fenced block; drops unknown fields", () => {
    expect(parseWriterV2AResponse(okJson).made_of).toHaveLength(6);
    expect(parseWriterV2AResponse("```json\n" + okJson + "\n```").title).toBe("Синтетическое название");
    const extra = parseWriterV2AResponse(JSON.stringify({ ...output(), disclaimer: "x", extra: 1 }));
    expect(Object.keys(extra).sort()).toEqual(["made_of", "meaning", "practice", "question", "story", "title"]);
  });

  it("rejects broken JSON, text around JSON, wrong shapes and made_of outside 5-8 rows", () => {
    const p = WRITER_V2A_FAILURE_PREFIX;
    expect(reason("")).toBe(p + "empty");
    expect(reason("{not json")).toBe(p + "invalid_json");
    expect(reason("Вот сказка:\n" + okJson)).toBe(p + "text_around_json");
    expect(reason("[]")).toBe(p + "not_object");
    expect(reason(JSON.stringify(output({ story: "  " })))).toBe(p + "missing_or_empty_fields");
    expect(reason(JSON.stringify(output({ practice: undefined })))).toBe(p + "missing_or_empty_fields");
    expect(reason(JSON.stringify(output({ made_of: rows(4) })))).toBe(p + "made_of_rows_out_of_5_8");
    expect(reason(JSON.stringify(output({ made_of: rows(9) })))).toBe(p + "made_of_rows_out_of_5_8");
    expect(reason(JSON.stringify(output({ made_of: "таблица" })))).toBe(p + "made_of_not_array");
    expect(reason(JSON.stringify(output({ made_of: [...rows(5).slice(1), { element: "x", source: "" }] })))).toBe(p + "made_of_row_empty");
  });

  it("rejects a Latin word of 2+ letters in any generated field, but not a single letter or the person's own word", () => {
    expect(reason(JSON.stringify(output({ story: "Тонкая glaze на чашке.\n\nВторой." })))).toBe(WRITER_V2A_FAILURE_PREFIX + "latin_words");
    for (const field of ["meaning", "question", "practice"]) expect(reason(JSON.stringify(output({ [field]: `слово ok здесь` })))).toBe(WRITER_V2A_FAILURE_PREFIX + "latin_words");
    expect(reason(JSON.stringify(output({ made_of: [...rows(5).slice(1), { element: "Excel", source: "из ответа" }] })))).toBe(WRITER_V2A_FAILURE_PREFIX + "latin_words");
    expect(reason(JSON.stringify(output({ story: "Лампа типа A.\n\nВторой." })))).toBe("ACCEPTED");
    expect(reason(JSON.stringify(output({ made_of: [...rows(5).slice(1), { element: "Excel", source: "из ответа" }] })), { ...answers, q1: "работаю в Excel" })).toBe("ACCEPTED");
    expect(findLatinWords(parseWriterV2AResponse(okJson), answers)).toEqual([]);
  });

  it("no length, paragraph, person or register rules apply (old v1.x regex bans are not used on this path)", () => {
    const longThirdPerson = Array.from({ length: 12 }, () => "Он шёл. Ты видишь проводника. Герой изменился.").join("\n\n");
    expect(reason(JSON.stringify(output({ story: longThirdPerson })))).toBe("ACCEPTED");
    expect(reason(JSON.stringify(output({ story: "Одна короткая строка." })))).toBe("ACCEPTED");
  });
});

describe("routing and fallback (mock provider, no network)", () => {
  const provider = (script: Array<string | Error>, fb?: PersonalMythProvider): PersonalMythProvider & { calls: Array<{ prompt: string; mode?: string }> } => {
    const calls: Array<{ prompt: string; mode?: string }> = [];
    return {
      name: "routerai", model: OPUS, isReady: () => true, calls,
      generate: async (prompt, _ms, mode) => {
        calls.push({ prompt, mode });
        const next = script.shift();
        if (next === undefined) throw new Error("script_exhausted");
        if (next instanceof Error) throw next;
        return next;
      },
      writerFallback: () => fb,
    };
  };
  const fallbackProvider = (script: Array<string | Error>) => {
    const p = provider(script);
    return Object.assign(p, { model: PRIMARY_MODEL });
  };
  const run = (p: PersonalMythProvider) => generatePersonalMyth(request(), p, 1000);

  it("default (env unset), empty and 'v2a' all select v2a; v41 and legacy are explicit", () => {
    expect(resolvePersonalMythWriter({})).toBe("v2a");
    expect(resolvePersonalMythWriter({ PERSONAL_MYTH_WRITER: "" })).toBe("v2a");
    expect(resolvePersonalMythWriter({ PERSONAL_MYTH_WRITER: "v2a" })).toBe("v2a");
    expect(resolvePersonalMythWriter({ PERSONAL_MYTH_WRITER: "v41" })).toBe("v41");
    expect(resolvePersonalMythWriter({ PERSONAL_MYTH_WRITER: "legacy" })).toBe("legacy");
  });

  it("v2a by default: one call in 'v2a' mode with the three-answer message; stored shape and version", async () => {
    const p = provider([okJson]);
    const r = await run(p);
    expect(p.calls).toHaveLength(1);
    expect(p.calls[0].mode).toBe("v2a");
    expect(p.calls[0].prompt).toBe(buildWriterV2AUserMessage(request().answers));
    expect(r.writerVersion).toBe(PERSONAL_MYTH_WRITER_V2A_VERSION);
    expect(r.writerVersion).not.toBe(PERSONAL_MYTH_WRITER_VERSION);
    expect(r.result.made_of).toHaveLength(6);
    expect(r.result.meaning).toEqual(["Возможно, это про выбор. Посмотрите, похоже ли."]);
    expect(r.result.journal_question).toBe("Что вы сделаете первым?");
    expect(r.result.one_step).toContain("Как поймёте");
    expect(r.result.generated_by).toEqual({ provider: "routerai", model: OPUS, fallback_used: false });
    expect(r.provider).toBe("routerai");
    expect(r.model).toBe(OPUS);
  });

  it("PERSONAL_MYTH_WRITER=v41 is the rollback: v41 mode and the v4.1 title+story contract", async () => {
    vi.stubEnv("PERSONAL_MYTH_WRITER", "v41");
    const p = provider([JSON.stringify({ title: "Т", story: "С.\n\nС2." })]);
    const r = await generatePersonalMyth(parsePersonalMythRequest({ request_id: "request_1234567890", answers: { ...answers, q2: "образ" } }), p, 1000);
    expect(p.calls[0].mode).toBe("v41");
    expect(r.writerVersion).toBe("personal-myth-writer-v4.2");
    expect(r.result.made_of).toBeUndefined();
  });

  it("PERSONAL_MYTH_WRITER=legacy keeps the old v1.5 path (no writer mode)", async () => {
    vi.stubEnv("PERSONAL_MYTH_WRITER", "legacy");
    const p = provider(["not json", "not json"]);
    await expect(generatePersonalMyth(parsePersonalMythRequest({ request_id: "request_1234567890", answers: { ...answers, q2: "образ" } }), p, 1000)).rejects.toThrow();
    expect(p.calls[0].mode).toBeUndefined();
  });

  it("broken JSON -> exactly one retry (with a format note), then success", async () => {
    const p = provider(["{broken", okJson]);
    const r = await run(p);
    expect(p.calls).toHaveLength(2);
    expect(p.calls[1].prompt.startsWith(p.calls[0].prompt)).toBe(true);
    expect(p.calls[1].prompt).toContain("не прошёл проверку формата");
    expect(r.result.made_of).toHaveLength(6);
  });

  it("a Latin word ('glaze') -> one retry that names the word; second answer clean -> success", async () => {
    const leaked = JSON.stringify(output({ story: "Тонкая glaze на чашке.\n\nВторой абзац." }));
    const p = provider([leaked, okJson]);
    await run(p);
    expect(p.calls).toHaveLength(2);
    expect(p.calls[1].prompt).toContain("glaze");
  });

  it("two invalid answers in a row -> personal_myth_quality_failed after exactly two calls, no fallback", async () => {
    const fb = fallbackProvider([okJson]);
    const p = provider(["{broken", "{broken again"], fb);
    await expect(run(p)).rejects.toThrow("personal_myth_quality_failed:writer_v2a_invalid_json");
    expect(p.calls).toHaveLength(2);
    expect(fb.calls).toHaveLength(0);
  });

  it.each(["provider_http_402", "provider_http_503", "provider_call_timeout", "provider_truncated", "provider_not_finished", "provider_gateway_error"])(
    "primary failure %s -> DeepSeek fallback with the SAME prompt, provider/model recorded", async (code) => {
      const fb = fallbackProvider([okJson]);
      const p = provider([new Error(code)], fb);
      const r = await run(p);
      expect(fb.calls).toHaveLength(1);
      expect(fb.calls[0]).toEqual({ prompt: p.calls[0].prompt, mode: "v2a" });
      expect(r.model).toBe(PRIMARY_MODEL);
      expect(r.result.generated_by).toEqual({ provider: "routerai", model: PRIMARY_MODEL, fallback_used: true });
    });

  it("budget and local refusals do not trigger the fallback; both models failing surfaces the last error", async () => {
    expect(writerV2AFallbackEligible(new Error("free_budget_exhausted"))).toBe(false);
    expect(writerV2AFallbackEligible(new Error("provider_local_refusal"))).toBe(false);
    expect(writerV2AFallbackEligible(new Error("personal_myth_quality_failed:writer_v2a_latin_words"))).toBe(false);
    const fb = fallbackProvider([new Error("provider_http_500")]);
    await expect(run(provider([new Error("provider_http_402")], fb))).rejects.toThrow("provider_http_500");
    const fb2 = fallbackProvider([okJson]);
    await expect(run(provider([new Error("free_budget_exhausted")], fb2))).rejects.toThrow("free_budget_exhausted");
    expect(fb2.calls).toHaveLength(0);
  });

  it("the fallback also gets its own single retry on an invalid answer", async () => {
    const fb = fallbackProvider(["{broken", okJson]);
    const r = await run(provider([new Error("provider_http_402")], fb));
    expect(fb.calls).toHaveLength(2);
    expect(r.model).toBe(PRIMARY_MODEL);
  });

  it("end to end through RouterAIClient (fake transport): Opus request, 402, then DeepSeek with the same messages", async () => {
    const bodies: any[] = [];
    const transport = vi.fn(async (_url: any, init: any) => {
      const body = JSON.parse(init.body);
      bodies.push(body);
      if (body.model === OPUS) return { ok: false, status: 402, headers: { get: () => null }, json: async () => ({}) };
      return { ok: true, status: 200, headers: { get: () => null }, json: async () => ({ provider: "DeepSeek", model: PRIMARY_MODEL, choices: [{ finish_reason: "stop", message: { content: okJson } }], usage: {} }) };
    });
    const client = new RouterAIClient({ ROUTERAI_API_KEY: "synthetic-test-key" } as any, OPUS, transport as any, () => undefined);
    const r = await run(new DeepSeekMythProvider({}, client));
    expect(bodies).toHaveLength(2);
    expect(bodies[0]).toMatchObject({ model: OPUS, max_tokens: WRITER_V2A_MAX_TOKENS, stream: false, verbosity: "low", provider: { only: ["anthropic"], allow_fallbacks: false } });
    expect(bodies[0].messages[0]).toEqual({ role: "system", content: writerV2ASystemMessage() });
    expect(bodies[1]).toMatchObject({ model: PRIMARY_MODEL, max_tokens: WRITER_V2A_MAX_TOKENS, provider: { only: ["deepseek"], allow_fallbacks: false } });
    expect(bodies[1].messages).toEqual(bodies[0].messages);
    expect(r.result.generated_by?.fallback_used).toBe(true);
    expect(JSON.stringify(bodies)).not.toContain("synthetic-test-key");
  });

  it("Opus finish_reason=length (provider_truncated) falls back too", async () => {
    const transport = vi.fn(async (_url: any, init: any) => {
      const body = JSON.parse(init.body);
      const opus = body.model === OPUS;
      return { ok: true, status: 200, headers: { get: () => null }, json: async () => ({
        provider: opus ? "Anthropic" : "DeepSeek", model: body.model, choices: [{ finish_reason: opus ? "length" : "stop", message: { content: opus ? "{" : okJson } }], usage: {} }) };
    });
    const client = new RouterAIClient({ ROUTERAI_API_KEY: "synthetic-test-key" } as any, OPUS, transport as any, () => undefined);
    const r = await run(new DeepSeekMythProvider({}, client));
    expect(transport).toHaveBeenCalledTimes(2);
    expect(r.model).toBe(PRIMARY_MODEL);
  });
});

describe("crisis protocol, questionnaire storage and budget", () => {
  it("the crisis guard is the same function and sees all stored keys (q2 empty included)", () => {
    expect(containsCrisisLanguage({ q1: "Я больше не могу жить", q2: "", q3: "ничего", q4: "покоя" })).toBe(true);
    expect(containsCrisisLanguage(answers)).toBe(false);
    expect(containsCrisisLanguage({ ...answers, q4: "хочу покончить с собой" })).toBe(true);
  });

  it("request parsing: v2a accepts an empty q2 (stored as ''), still requires q1/q3/q4; legacy/v41 still require four", () => {
    expect(request().answers).toEqual(answers);
    expect(request().consent_version).toBe(PERSONAL_MYTH_WRITER_V2A_VERSION);
    expect(() => parsePersonalMythRequest({ request_id: "request_1234567890", answers: { ...answers, q3: "" } })).toThrow("invalid_answer:q3");
    expect(parsePersonalMythRequest({ request_id: "request_1234567890", answers: { ...answers, q2: "старый образ" } }).answers.q2).toBe("старый образ");
    vi.stubEnv("PERSONAL_MYTH_WRITER", "v41");
    expect(() => parsePersonalMythRequest({ request_id: "request_1234567890", answers })).toThrow("invalid_answer:q2");
    vi.stubEnv("PERSONAL_MYTH_WRITER", "legacy");
    expect(() => parsePersonalMythRequest({ request_id: "request_1234567890", answers })).toThrow("invalid_answer:q2");
  });

  it("budget policy ceiling is 12000 and the per-attempt reserve is priced at the Opus tariff", () => {
    expect(policy.max_output_tokens).toBe(12000);
    const opus = tariffs.rows.find(r => r.model === OPUS)!;
    const expected = Math.ceil((policy.max_input_bytes * opus.input_rate + 12000 * opus.output_rate) * 1.25 * 1e6);
    expect(maxAttempt(tariffs)).toBe(expected);
    vi.stubEnv("PERSONAL_MYTH_WRITER", "legacy");
    expect(maxAttempt(tariffs)).toBeLessThan(expected);
    vi.stubEnv("PERSONAL_MYTH_WRITER", "v41");
    expect(maxAttempt(tariffs)).toBe(expected);
    const e = estimateAttempt(tariffs, OPUS, [{ role: "system", content: writerV2ASystemMessage() }, { role: "user", content: "x" }], 12000, Date.parse(tariffs.captured_at) + 3600000);
    expect(e.output_tokens).toBe(12000);
  });

  describe("guard on the real client", () => {
    const key = "f".repeat(64);
    const fixtureNow = Date.parse(tariffs.captured_at) + 3600000;
    const run = async (freeBudgetRub: string) => {
      const env = { FREE_PREVIEW_ENABLED: "true", COMMERCE_BUDGET_APPROVED: "true", COMMERCE_DATA_KEY: key, COMMERCE_FREE_BUDGET_RUB: freeBudgetRub, COMMERCE_FREE_ATTEMPT_MAX: "8" };
      for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
      const clock = vi.spyOn(Date, "now").mockReturnValue(fixtureNow);
      const store = new CommerceStore(":memory:", key);
      registerAIBudget(new AIBudget(() => store, env, fetch, () => fixtureNow));
      const transport = vi.fn(async () => ({ ok: true, status: 200, headers: { get: () => null }, json: async () => ({ provider: "Anthropic", model: OPUS, choices: [{ finish_reason: "stop", message: { content: okJson } }], usage: {} }) }));
      const c = new RouterAIClient({ ROUTERAI_API_KEY: "synthetic-test-key" } as any, OPUS, transport as any, () => undefined);
      const outcome = await new DeepSeekMythProvider({}, c).generate(buildWriterV2AUserMessage(answers), 1000, "v2a").then(() => "sent", e => (e as Error).message);
      const reserved = store.db.prepare("SELECT model, cost_micro FROM ai_budget_attempts").all() as any[];
      registerAIBudget(undefined); clock.mockRestore(); store.close();
      return { outcome, transport, reserved };
    };
    it("with a 100 RUB window one 12000-token reservation goes out and is priced for 12000 output tokens", async () => {
      const r = await run("100");
      expect(r.outcome).toBe("sent");
      expect(r.transport).toHaveBeenCalledTimes(1);
      const row = tariffs.rows.find(x => x.model === OPUS)!;
      const bytes = Buffer.byteLength(JSON.stringify([{ role: "system", content: writerV2ASystemMessage() }, { role: "user", content: buildWriterV2AUserMessage(answers) }]), "utf8");
      expect(r.reserved).toHaveLength(1);
      expect(r.reserved[0].cost_micro).toBeGreaterThan(Math.ceil(12000 * row.output_rate * 1.25 * 1e6));
      expect(r.reserved[0].cost_micro).toBeLessThanOrEqual(Math.ceil((bytes * row.input_rate + 12000 * row.output_rate) * 1.25 * 1e6) + 1e6);
    });
    it("refuses before any network I/O when the free budget cannot cover one reservation", async () => {
      const r = await run("5");
      expect(r.outcome).toBe("free_budget_exhausted");
      expect(r.transport).not.toHaveBeenCalled();
    });
  });
});

describe("Meeting of Mirrors accepts the new myth format", () => {
  const calc: any = { soul: 5, path: 3, expression: 7, direction: 2, result: 9 };
  const base = (storyInputs: any, storyResult: any) => buildMeetingOfMirrorsPrompt({ calc }, { storyInputs, storyResult });

  it("v2a: three answers, made_of + meaning + practice as the Myth lens, no empty q2 line and no empty mirror lines", () => {
    const p = base(answers, { title: "Название", story: "Текст", mirror: {}, meaning: ["Гипотеза смысла."], one_step: "Практика семи дней.", made_of: rows(5) });
    expect(p).toContain("из 3 ответов");
    expect(p).not.toContain("Предмет или образ состояния: \"\"");
    expect(p).toContain('  2. Точка живости (где на своём месте): "ЖИВОЙ-момент-три"');
    expect(p).toContain('  3. Чего хочется больше в ситуации: "ХОЧЕТСЯ-четыре"');
    expect(p).toContain("Из чего сделана сказка");
    expect(p).toContain("образ 1 ← слова человека 1");
    expect(p).toContain("Гипотеза Мифа о смысле сейчас: \"Гипотеза смысла.\"");
    expect(p).not.toContain("Центральный образ Мифа");
  });

  it("old four-answer myth: the Myth lens text is unchanged", () => {
    const p = base({ q1: "а1", q2: "а2", q3: "а3", q4: "а4" }, { title: "Т", story: "С", mirror: { mainImage: "M", innerTension: "I", hiddenResource: "H", newView: "N" }, one_step: "Шаг" });
    expect(p).toContain("из 4 ответов");
    expect(p).toContain('  2. Предмет или образ состояния: "а2"');
    expect(p).toContain('  3. Точка живости (где на своём месте): "а3"');
    expect(p).toContain('  4. Чего хочется больше в ситуации: "а4"');
    expect(p).toContain('- Центральный образ Мифа: "M"');
    expect(p).toContain('- Шаг Мифа: "Шаг"');
  });
});

it("sample answers fixture still has four keys (old stored shape is untouched)", () => {
  expect(Object.keys(STORY_SAMPLE_ANSWERS).sort()).toEqual(["q1", "q2", "q3", "q4"]);
});
