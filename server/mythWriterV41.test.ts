// @vitest-environment node
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { once } from "node:events";
import express from "express";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CommerceStore } from "./commerceStore";
import { FreePreview } from "./freePreview";
import { installConsentRoutes } from "./consent";
import { installStoryCommerce } from "./storyCommerce";
import { AIBudget } from "./aiBudget";
import { CONSENT_VERSION } from "../src/services/consent";
import { STORY_SAMPLE_ANSWERS } from "./storySample";
import tariffs from "./aiTariffs.json";
import { RouterAIClient, FALLBACK_MODEL, PRIMARY_MODEL, WRITER_V41_MODEL, LocalSendRefusal } from "./routerai";
import { registerAIBudget } from "./aiBudget";
import { estimateAttempt } from "./aiTariffService.mjs";
import {
  DeepSeekMythProvider, generatePersonalMyth, parsePersonalMythRequest, type PersonalMythProvider,
} from "./myth";
import {
  WRITER_V41_FAILURE_PREFIX, buildWriterV41UserMessage, parseWriterV41Response, writerV41MaxTokens,
  writerV41Routing, writerV41SystemMessage,
} from "./mythWriterV41";
import { WRITER_BRIEF_V41, WRITER_BRIEF_V41_SHA256 } from "./mythWriterV41Brief";
import { WRITER_BRIEF_V42, WRITER_BRIEF_V42_SHA256 } from "./mythWriterV42Brief";

afterEach(() => vi.unstubAllEnvs());
const OPUS = "anthropic/claude-opus-5.5";

// Synthetic answers: each one is recognisable by its own marker so the mapping is checkable.
const answers = { q1: "СИТУАЦИЯ-один", q2: "ОБРАЗ-два", q3: "ЖИВОСТЬ-три", q4: "КАЧЕСТВО-четыре" };
const request = () => parsePersonalMythRequest({ request_id: "request_1234567890", answers });
const story = "Синтетический первый абзац.\n\nСинтетический второй абзац.\n\nСинтетический третий абзац.";
const okJson = JSON.stringify({ title: "Синтетическое название", story });
const reason = (raw: unknown) => {
  try { parseWriterV41Response(raw); } catch (error) { return (error as Error).message; }
  return "ACCEPTED";
};
const rejected = (code: string) => WRITER_V41_FAILURE_PREFIX + code;

describe("writer v4.1 brief and message template", () => {
  it("the brief is the reviewed text: SHA-256 of the text before .strip()", () => {
    expect(crypto.createHash("sha256").update(WRITER_BRIEF_V41, "utf8").digest("hex")).toBe(WRITER_BRIEF_V41_SHA256);
    expect(WRITER_BRIEF_V41_SHA256).toBe("b68d27b8ab926b2bbc49b819c937fadb75bd8f5b0f915f223cb7966faaab73a5");
  });

  it("v4.2 = v4.1 + exactly the Astra paragraph before the JSON paragraph; v4.1 is unchanged; the path uses v4.2", () => {
    const sha = (t: string) => crypto.createHash("sha256").update(t, "utf8").digest("hex");
    expect(sha(WRITER_BRIEF_V41)).toBe("b68d27b8ab926b2bbc49b819c937fadb75bd8f5b0f915f223cb7966faaab73a5");
    expect(sha(WRITER_BRIEF_V42)).toBe(WRITER_BRIEF_V42_SHA256);
    expect(WRITER_BRIEF_V42_SHA256).toBe("9e2b222501c17eceb7eeb491c92c9c7fe77d0daa48d92c7aa14ae742cbc44967");
    const para = "Признавай переживание героя, но не подтверждай автоматически его обобщения о других людях. Не делай окружающих карикатурно пустыми ради его правоты; поворот может проявиться в его собственном конкретном действии или договорённости, без морали и принудительного примирения.";
    const marker = "Верни один JSON-объект с двумя полями";
    expect(WRITER_BRIEF_V42).toBe(WRITER_BRIEF_V41.replace(marker, para + "\n\n" + marker));
    expect(writerV41SystemMessage()).toBe(WRITER_BRIEF_V42.trim());
  });

  it("builds the exact user message; template items 3 and 4 map to site q4 and q3", () => {
    expect(buildWriterV41UserMessage(answers)).toBe(
      "Ответы человека:\n" +
      "1. Что сейчас тяжелее всего: СИТУАЦИЯ-один\n" +
      "2. Если бы это состояние было стихией или существом — как бы оно выглядело, звучало, пахло: ОБРАЗ-два\n" +
      "3. Чего сейчас не хватает больше всего: КАЧЕСТВО-четыре\n" +
      "4. Момент, когда чувствовал себя по-настоящему живым или нужным: ЖИВОСТЬ-три\n" +
      "\n" +
      "Напиши для этого человека цельную взрослую сказку по системной инструкции. Верни только один JSON-объект с полями «title» и «story».",
    );
  });

  it("output budget is never below 5000 and bounded by the budget policy", () => {
    expect(writerV41MaxTokens({})).toBe(6000);
    expect(writerV41MaxTokens({ PERSONAL_MYTH_V41_MAX_TOKENS: "100" })).toBe(5000);
    expect(writerV41MaxTokens({ PERSONAL_MYTH_V41_MAX_TOKENS: "99999" })).toBe(8000);
  });

  it("routing knobs are off by default except the strict finish check", () => {
    expect(writerV41Routing({})).toEqual({ strict_finish: true });
    expect(writerV41Routing({ PERSONAL_MYTH_V41_VERBOSITY: "low", PERSONAL_MYTH_V41_PROVIDER_ONLY: "anthropic" }))
      .toEqual({ strict_finish: true, verbosity: "low", provider_only: ["anthropic"] });
  });
});

describe("strict {title, story} parser", () => {
  it("accepts a clean JSON object", () => {
    expect(parseWriterV41Response(okJson)).toEqual({ title: "Синтетическое название", story });
    expect(parseWriterV41Response(`\n  ${okJson}\n`)).toEqual({ title: "Синтетическое название", story });
  });

  it("accepts the same object in ONE outer ```json block or plain ``` block", () => {
    expect(parseWriterV41Response("```json\n" + okJson + "\n```")).toMatchObject({ title: "Синтетическое название" });
    expect(parseWriterV41Response("```\n" + okJson + "\n```")).toMatchObject({ title: "Синтетическое название" });
    expect(parseWriterV41Response("```JSON\r\n" + okJson + "\r\n```")).toMatchObject({ title: "Синтетическое название" });
  });

  it("rejects text around the object or the block", () => {
    expect(reason("Вот история:\n```json\n" + okJson + "\n```")).toBe(rejected("text_around_json"));
    expect(reason("```json\n" + okJson + "\n```\nНадеюсь, понравится.")).toBe(rejected("text_around_json"));
    expect(reason("Вот история: " + okJson)).toBe(rejected("text_around_json"));
    expect(reason(okJson + "\nГотово.")).toBe(rejected("text_around_json"));
    expect(reason("```json\n" + okJson + "\n```\n\n```json\n" + okJson + "\n```")).toBe(rejected("text_around_json"));
  });

  it("rejects a help menu instead of a story (not JSON, own code)", () => {
    const menu = "Чем могу помочь?\n1. Написать сказку\n2. Объяснить инструкцию\n3. Задать вопрос\n\nЧто выберете?";
    expect(reason(menu)).toBe(rejected("help_menu"));
    expect(reason("Пожалуйста, пришлите ответы человека, и я напишу сказку.")).toBe(rejected("not_json"));
  });

  it("rejects extra or missing fields, wrong types, empty strings", () => {
    expect(reason(JSON.stringify({ title: "Т", story, mirror: {} }))).toBe(rejected("extra_fields"));
    expect(reason(JSON.stringify({ title: "Т" }))).toBe(rejected("missing_fields"));
    expect(reason(JSON.stringify({ title: "Т", story: ["a"] }))).toBe(rejected("wrong_types"));
    expect(reason(JSON.stringify({ title: "  ", story }))).toBe(rejected("title_empty"));
    expect(reason(JSON.stringify({ title: "Т", story: "" }))).toBe(rejected("story_empty"));
    expect(reason(JSON.stringify([{ title: "Т", story }]))).toBe(rejected("not_object"));
    expect(reason("null")).toBe(rejected("not_object"));
  });

  it("rejects truncated JSON, two objects and empty output", () => {
    expect(reason(okJson.slice(0, 40))).toBe(rejected("invalid_json"));
    expect(reason(okJson + okJson)).toBe(rejected("multiple_objects"));
    expect(reason("")).toBe(rejected("empty"));
    expect(reason("   ")).toBe(rejected("empty"));
  });
});

describe("opt-in generation path", () => {
  const provider = (reply: string, extra: Partial<PersonalMythProvider> = {}) => {
    const generate = vi.fn(async (_prompt: string, _ms: number, _mode?: "v41") => reply);
    return { generate, provider: { name: "routerai", model: "synthetic/model", isReady: () => true, generate, ...extra } as PersonalMythProvider };
  };

  it("legacy flag: old path, no v41 mode, the old prompt is used (the unset default is v2a now)", async () => {
    vi.stubEnv("PERSONAL_MYTH_WRITER", "legacy");
    const { generate, provider: p } = provider("не JSON");
    await expect(generatePersonalMyth(request(), p, 1000)).rejects.toThrow("personal_myth_quality_failed");
    expect(generate.mock.calls.length).toBeGreaterThanOrEqual(1);
    for (const call of generate.mock.calls) expect(call[2]).toBeUndefined();
    expect(generate.mock.calls[0][0]).not.toContain("Ответы человека:\n1. Что сейчас тяжелее всего");
  });

  it("flag on: exactly one call, v41 user message, title+story result in the stored shape", async () => {
    vi.stubEnv("PERSONAL_MYTH_WRITER", "v41");
    const { generate, provider: p } = provider("```json\n" + okJson + "\n```");
    const out = await generatePersonalMyth(request(), p, 1000);
    expect(generate).toHaveBeenCalledTimes(1);
    expect(generate.mock.calls[0][0]).toBe(buildWriterV41UserMessage(answers));
    expect(generate.mock.calls[0][2]).toBe("v41");
    expect(out.writerVersion).toBe("personal-myth-writer-v4.2");
    expect(out.result).toMatchObject({
      title: "Синтетическое название", story, mirror: { mainImage: "", innerTension: "", hiddenResource: "", newView: "" },
      meaning: [], one_step: "", journal_question: "",
    });
    expect(out.result.disclaimer).toBeTruthy();
  });

  it("flag on: a bad answer is rejected after ONE call (no repair, no fallback) with a reason code", async () => {
    vi.stubEnv("PERSONAL_MYTH_WRITER", "v41");
    const fallback = provider(okJson);
    const { generate, provider: p } = provider("Чем могу помочь?\n1. Сказку\n2. Вопрос", { fallback: () => fallback.provider });
    await expect(generatePersonalMyth(request(), p, 1000)).rejects.toThrow(rejected("help_menu"));
    expect(generate).toHaveBeenCalledTimes(1);
    expect(fallback.generate).not.toHaveBeenCalled();
  });

  it("flag on: the provider call uses the brief, no response_format, >= 5000 tokens", async () => {
    vi.stubEnv("PERSONAL_MYTH_WRITER", "v41");
    const call = vi.fn(async () => okJson);
    const client = { name: "routerai", defaultModel: "deepseek/deepseek-v4.1-flash", isReady: () => true, call };
    await new DeepSeekMythProvider({}, client).generate("USER", 1000, "v41");
    const options = (call.mock.calls[0] as any[])[0];
    expect(options.messages).toEqual([{ role: "system", content: writerV41SystemMessage() }, { role: "user", content: "USER" }]);
    expect(options.max_tokens).toBeGreaterThanOrEqual(5000);
    expect(options.response_format).toBeUndefined();
    expect(options.routing).toEqual({ strict_finish: true });
    await new DeepSeekMythProvider({}, client).generate("OLD", 1000);
    expect((call.mock.calls[1] as any[])[0].response_format.type).toBe("json_schema");
  });
});

describe("RouterAI transport for the opt-in path (fake transport, no network)", () => {
  const reply = (finish: string, content = okJson) => ({
    ok: true, status: 200,
    json: async () => ({ provider: "Anthropic", model: FALLBACK_MODEL, choices: [{ finish_reason: finish, message: { content } }], usage: {} }),
  });
  const client = (transport: any) =>
    new RouterAIClient({ ROUTERAI_API_KEY: "synthetic-test-key" } as any, FALLBACK_MODEL, transport, () => undefined);
  const messages = [{ role: "user" as const, content: "x" }];

  it("sends verbosity and provider-only when asked, and accepts finish_reason stop", async () => {
    const transport = vi.fn(async () => reply("stop"));
    const content = await client(transport).call({
      messages, max_tokens: 6000, routing: { verbosity: "low", provider_only: ["anthropic"], strict_finish: true },
    });
    expect(content).toBe(okJson);
    const body = JSON.parse((transport.mock.calls[0] as any[])[1].body);
    expect(body).toMatchObject({ verbosity: "low", provider: { only: ["anthropic"], allow_fallbacks: false }, include_reasoning: false, max_tokens: 6000 });
    expect(body.response_format).toBeUndefined();
  });

  it("rejects any finish_reason other than stop on the strict path; the old path is unchanged", async () => {
    await expect(client(vi.fn(async () => reply("content_filter"))).call({ messages, routing: { strict_finish: true } }))
      .rejects.toThrow("provider_not_finished");
    await expect(client(vi.fn(async () => reply("length"))).call({ messages, routing: { strict_finish: true } }))
      .rejects.toThrow("provider_truncated");
    const transport = vi.fn(async () => reply("content_filter"));
    await expect(client(transport).call({ messages })).resolves.toBe(okJson);
    const body = JSON.parse((transport.mock.calls[0] as any[])[1].body);
    expect(body.verbosity).toBeUndefined();
    expect(body.provider).toEqual({ order: ["claude-on-aws"], allow_fallbacks: false });
  });
});

describe("writer v4.1 model: accepted control-call parameters, tariff and reserve", () => {
  const reply = (finish = "stop") => ({
    ok: true, status: 200,
    json: async () => ({ provider: "Anthropic", model: OPUS, choices: [{ finish_reason: finish, message: { content: okJson } }], usage: {} }),
  });
  const messages = [{ role: "system" as const, content: writerV41SystemMessage() }, { role: "user" as const, content: buildWriterV41UserMessage(answers) }];
  const fixtureNow = Date.parse(tariffs.captured_at) + 3600000;

  it("is allowed; an unknown model is still refused by the client and by the tariff table", () => {
    expect(WRITER_V41_MODEL).toBe(OPUS);
    expect(() => new RouterAIClient({} as any, OPUS)).not.toThrow();
    expect(() => new RouterAIClient({} as any, "anthropic/claude-opus-9")).toThrow("routerai_model_not_allowed");
    expect(() => estimateAttempt(tariffs, "anthropic/claude-opus-9", messages, 5000, fixtureNow)).toThrow("ai_price_bound_unknown");
  });

  it("tariff row is per TOKEN in RUB, equal to the checked catalog values", () => {
    const row = tariffs.rows.find(r => r.model === OPUS)!;
    expect([row.input_rate, row.output_rate]).toEqual([0.00044150496, 0.0022075248]);
    expect(row.endpoints[0].pricing_units).toEqual({ prompt: "token", completion: "token" });
    const e = estimateAttempt(tariffs, OPUS, messages, 6000, fixtureNow);
    expect(e.cost_micro).toBe(Math.ceil((e.input_bytes * 0.00044150496 + 6000 * 0.0022075248) * 1.25 * 1e6));
  });

  it("request body reproduces the control call for the v41 path (and only there)", async () => {
    const transport = vi.fn(async () => reply());
    const c = new RouterAIClient({ ROUTERAI_API_KEY: "synthetic-test-key" } as any, OPUS, transport as any, () => undefined);
    const provider = new DeepSeekMythProvider({}, c);
    expect(provider.model).toBe(OPUS);
    vi.stubEnv("PERSONAL_MYTH_WRITER", "v41");
    await provider.generate(buildWriterV41UserMessage(answers), 1000, "v41");
    const body = JSON.parse((transport.mock.calls[0] as any[])[1].body);
    expect(body).toEqual({
      model: OPUS,
      messages,
      max_tokens: 6000,
      stream: false,
      include_reasoning: false,
      verbosity: "low",
      provider: { only: ["anthropic"], allow_fallbacks: false },
    });
    expect("temperature" in body || "response_format" in body || "reasoning" in body || "thinking" in body).toBe(false);
  });

  it("the old path request body is unchanged for the primary model", async () => {
    const transport = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ provider: "DeepSeek", model: PRIMARY_MODEL, choices: [{ finish_reason: "stop", message: { content: okJson } }] }) }));
    const c = new RouterAIClient({ ROUTERAI_API_KEY: "synthetic-test-key" } as any, PRIMARY_MODEL, transport as any, () => undefined);
    await c.call({ messages, temperature: 0.6, max_tokens: 100 });
    const body = JSON.parse((transport.mock.calls[0] as any[])[1].body);
    expect(body).toMatchObject({ temperature: 0.6, thinking: { type: "disabled" }, provider: { only: ["deepseek"], allow_fallbacks: false } });
    expect(body.stream).toBeUndefined();
    expect(body.verbosity).toBeUndefined();
  });

  describe("budget guard", () => {
    const key = "f".repeat(64);
    const run = async (freeBudgetRub: string) => {
      const env = {
        FREE_PREVIEW_ENABLED: "true", COMMERCE_BUDGET_APPROVED: "true", COMMERCE_DATA_KEY: key,
        COMMERCE_FREE_BUDGET_RUB: freeBudgetRub, COMMERCE_FREE_ATTEMPT_MAX: "8",
      };
      for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
      const clock = vi.spyOn(Date, "now").mockReturnValue(fixtureNow);
      const store = new CommerceStore(":memory:", key);
      registerAIBudget(new AIBudget(() => store, env, fetch, () => fixtureNow));
      const transport = vi.fn(async () => reply());
      const c = new RouterAIClient({ ROUTERAI_API_KEY: "synthetic-test-key" } as any, OPUS, transport as any, () => undefined);
      const outcome = await c.call({ messages, max_tokens: 6000 }).then(() => "sent", e => (e as Error).message);
      const rows = store.db.prepare("SELECT model, state FROM ai_budget_attempts").all();
      registerAIBudget(undefined); clock.mockRestore(); store.close();
      return { outcome, transport, rows };
    };

    it("reserves before sending; with enough budget the call goes out", async () => {
      const r = await run("1000");
      expect(r.outcome).toBe("sent");
      expect(r.transport).toHaveBeenCalledTimes(1);
      expect(r.rows).toEqual([expect.objectContaining({ model: OPUS })]);
    });

    it("refuses before any network I/O when the free budget cannot cover the reserve", async () => {
      const r = await run("5");
      expect(r.outcome).toBe("free_budget_exhausted");
      expect(r.transport).not.toHaveBeenCalled();
      expect(r.rows).toEqual([]);
    });
  });
});

describe("waiting: the opt-in path shares the existing request_id replay", () => {
  const key = "f".repeat(64);
  const env = {
    FREE_PREVIEW_ENABLED: "true", FREE_PREVIEW_SUPPORT_URL: "https://t.me/synthetic_help", COMMERCE_BUDGET_APPROVED: "true",
    COMMERCE_FREE_BUDGET_RUB: "1000", COMMERCE_FREE_ATTEMPT_MAX: "8", COMMERCE_PAYMENT_MODE: "disabled", LOCAL_STORY_SETUP: "true",
  };
  const asProvider = (generate: (p: string, ms: number, m?: "v41") => Promise<string>): PersonalMythProvider =>
    ({ name: "routerai", model: "synthetic/model", isReady: () => true, generate });
  async function commerceApp(modelProvider: PersonalMythProvider, opts: { filename?: string; cookies?: string; timeoutMs?: number } = {}) {
    for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
    vi.stubEnv("PERSONAL_MYTH_WRITER", "v41");
    // Same fixture clock as the other commerce tests (tests/setup.ts): the tariff snapshot must be fresh.
    const clock = vi.spyOn(Date, "now").mockReturnValue(Date.parse(tariffs.captured_at) + 3600000);
    const store = new CommerceStore(opts.filename ?? ":memory:", key), app = express();
    app.use(express.json()); installConsentRoutes(app);
    new AIBudget(() => store, env).db();
    { const preview = new FreePreview(() => store, env); if (preview.status().phase === "not_started") preview.activate(); }
    registerAIBudget(new AIBudget(() => store, env, fetch, () => Date.parse(tariffs.captured_at) + 3600000));
    installStoryCommerce(app, {
      store, ready: () => true,
      myth: async (body: any) => { const g = await generatePersonalMyth(body, modelProvider, opts.timeoutMs ?? 5000); return { status: "ok", story_result: g.result, writer_version: g.writerVersion }; },
      albert: async () => ({ status: "ok", response: "x" }),
    });
    const server = app.listen(0, "127.0.0.1"); await once(server, "listening");
    const origin = `http://127.0.0.1:${(server.address() as any).port}`;
    let cookies = opts.cookies ?? "";
    const call = async (url: string, body?: any, signal?: AbortSignal) => {
      const r = await fetch(origin + url, { method: body === undefined ? "GET" : "POST", signal, headers: { Origin: origin, Cookie: cookies, "Content-Type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      for (const value of r.headers.getSetCookie()) {
        const pair = value.split(";")[0], name = pair.split("=")[0];
        cookies = cookies.split("; ").filter(v => v && !v.startsWith(name + "=")).concat(pair).join("; ");
      }
      return { status: r.status, body: await r.json() as any };
    };
    await call("/api/consent", { accepted: true, adult: true, version: CONSENT_VERSION, scope: "core" });
    if (!opts.cookies) await call("/api/stories/account", { storage_accepted: true, storage_version: "personal-history-storage-v1" });
    return { call, store, cookies: () => cookies, close: () => { registerAIBudget(undefined); clock.mockRestore(); server.close(); server.closeAllConnections(); store.close(); } };
  }

  it("same request_id while running -> 202 and one model call; afterwards a replay, still one call", async () => {
    let finish: ((value: string) => void) | undefined;
    const generate = vi.fn((_p: string, _ms: number, _m?: "v41") => new Promise<string>(resolve => { finish = resolve; }));
    const s = await commerceApp(asProvider(generate));
    try {
      const body = { request_id: "writer_v41_req_001", answers: STORY_SAMPLE_ANSWERS };
      const pending = await s.call("/api/personal-myth", body);
      expect(pending.status).toBe(202);
      expect(pending.body.status).toBe("running");
      await vi.waitFor(() => expect(finish).toBeTypeOf("function"));
      for (let i = 0; i < 3; i++) {
        const again = await s.call("/api/personal-myth", body);
        expect(again.status).toBe(202);
        expect(again.body.story_result).toBeUndefined();
      }
      expect(generate).toHaveBeenCalledTimes(1);
      finish!("```json\n" + okJson + "\n```");
      await vi.waitFor(async () => {
        const replay = await s.call("/api/personal-myth", body);
        expect(replay.status).toBe(200);
        expect(replay.body.replayed).toBe(true);
        expect(replay.body.story_result.title).toBe("Синтетическое название");
        expect(replay.body.story_result.story).toBe(story);
      });
      expect(generate).toHaveBeenCalledTimes(1);
      const saved = (await s.call("/api/stories")).body.orders[0];
      expect(saved.data.myth).toMatchObject({ title: "Синтетическое название", story, one_step: "" });
    } finally { s.close(); }
  });

  it("crisis wording in the input is still caught before any model call", async () => {
    const generate = vi.fn(async () => okJson);
    const s = await commerceApp(asProvider(generate));
    try {
      const crisis = { ...STORY_SAMPLE_ANSWERS, q1: "Я больше не могу жить так дальше" };
      const r = await s.call("/api/personal-myth", { request_id: "writer_v41_crisis_01", answers: crisis });
      expect(r.body.status).toBe("crisis");
      expect(r.body.story_result).toBeUndefined();
      expect(generate).not.toHaveBeenCalled();
    } finally { s.close(); }
  });

  it("a rejected format (help menu) leaves the order retryable and shows no raw model text", async () => {
    const menu = "Чем могу помочь?\n1. Написать сказку\n2. Объяснить задание";
    const generate = vi.fn(async () => menu);
    const s = await commerceApp(asProvider(generate));
    try {
      const r = await s.call("/api/personal-myth", { request_id: "writer_v41_menu_001", answers: STORY_SAMPLE_ANSWERS });
      expect(r.status).toBe(202);
      expect(r.body.status).toBe("running");
      await vi.waitFor(() => expect(generate).toHaveBeenCalledTimes(1));
      const again = await s.call("/api/personal-myth", { request_id: "writer_v41_menu_001", answers: STORY_SAMPLE_ANSWERS });
      expect(again.status).toBe(202);
      expect(again.body.status).toBe("failed");
      expect(JSON.stringify(again.body)).not.toContain("Написать сказку");
      expect(again.body.story_result).toBeUndefined();
    } finally { s.close(); }
  });

  const input = { request_id: "writer_v41_cut_0001", answers: STORY_SAMPLE_ANSWERS };
  for (const code of ["provider_call_timeout", "provider_unavailable"]) {
    it(`${code}: the order becomes uncertain, same request_id only reads state, a new id starts no model call`, async () => {
      const generate = vi.fn(async () => { throw new Error(code); });
      const s = await commerceApp(asProvider(generate));
      try {
        const first = await s.call("/api/personal-myth", input);
        expect(first.status).toBe(202);
        expect(first.body.status).toBe("running");
        await vi.waitFor(() => {
          expect(generate).toHaveBeenCalledTimes(1);
          expect(s.store.db.prepare("SELECT state FROM operations").all()).toEqual([{ state: "uncertain" }]);
        });
        const again = await s.call("/api/personal-myth", input);
        expect(again.status).toBe(202);
        expect(again.body.status).toBe("uncertain");
        const other = await s.call("/api/personal-myth", { ...input, request_id: "writer_v41_cut_0002" });
        expect(other.body.code).toBe("myth_not_available");
        expect(generate).toHaveBeenCalledTimes(1);
        const order = (await s.call("/api/stories")).body.orders[0];
        expect(order.state).toBe("generating");
        expect(s.store.db.prepare("SELECT state FROM operations").all()).toEqual([{ state: "uncertain" }]);
      } finally { s.close(); }
    });
  }

  it("server restart after uncertain: same state, no model call, the AI reservation stays 'uncertain'; diagnostics carry no answers", async () => {
    const events: any[] = [];
    const transport = vi.fn(async () => { const e: any = new TypeError("fetch failed"); e.cause = Object.assign(new Error("socket hang up"), { code: "UND_ERR_SOCKET" }); throw e; });
    const client = new RouterAIClient({ ROUTERAI_API_KEY: "synthetic-test-key" } as any, OPUS, transport as any, e => events.push(e));
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "v41-restart-"));
    const filename = path.join(dir, "c.sqlite");
    const first = await commerceApp(new DeepSeekMythProvider({}, client), { filename });
    let cookies = "";
    try {
      const r = await first.call("/api/personal-myth", input);
      expect(r.status, JSON.stringify(r.body)).toBe(202);
      expect(r.body.status).toBe("running");
      await vi.waitFor(() => {
        expect(transport).toHaveBeenCalledTimes(1);
        expect(events).toHaveLength(1);
      });
      const again = await first.call("/api/personal-myth", input);
      expect(again.status).toBe(202);
      expect(again.body.status).toBe("uncertain");
      expect(events[0]).toMatchObject({ outcome: "provider_unavailable", errorName: "TypeError", causeCode: "UND_ERR_SOCKET", stage: "before_headers" });
      expect(JSON.stringify(events[0])).not.toContain("СИТУАЦИЯ");
      expect(JSON.stringify(events[0])).not.toContain(STORY_SAMPLE_ANSWERS.q1);
      cookies = first.cookies();
    } finally { first.close(); }
    const generate = vi.fn(async () => okJson);
    const second = await commerceApp(asProvider(generate), { filename, cookies });
    try {
      const again = await second.call("/api/personal-myth", input);
      expect(again.status).toBe(202);
      expect(again.body.status).toBe("uncertain");
      const other = await second.call("/api/personal-myth", { ...input, request_id: "writer_v41_cut_0009" });
      expect(other.body.code).toBe("myth_not_available");
      expect(generate).not.toHaveBeenCalled();
      expect(transport).toHaveBeenCalledTimes(1);
      expect(second.store.db.prepare("SELECT model, state FROM ai_budget_attempts").all()).toEqual([{ model: OPUS, state: "uncertain" }]);
    } finally { second.close(); }
  });

  it("a closed tab does not cancel the work: the result is saved when the provider answer arrives; a new request_id then only replays", async () => {
    let finish: ((value: string) => void) | undefined;
    const generate = vi.fn((_p: string, _ms: number, _m?: "v41") => new Promise<string>(resolve => { finish = resolve; }));
    const s = await commerceApp(asProvider(generate));
    try {
      const init = await s.call("/api/personal-myth", input);
      expect(init.status).toBe(202);
      expect(init.body.status).toBe("running");
      await vi.waitFor(() => expect(finish).toBeTypeOf("function"));
      finish!(okJson);
      await vi.waitFor(async () => {
        const order = (await s.call("/api/stories")).body.orders[0];
        expect(order.data.myth?.title).toBe("Синтетическое название");
      });
      const refreshed = await s.call("/api/personal-myth", { ...input, request_id: "writer_v41_cut_0003" });
      expect(refreshed.body.replayed).toBe(true);
      expect(refreshed.body.story_result.title).toBe("Синтетическое название");
      expect(generate).toHaveBeenCalledTimes(1);
    } finally { s.close(); }
  });

  // ---- outcome matrix: every row checks order state, operation state, attempt state/reserve and number of wire sends ----
  const okResponse = (content = okJson, finish = "stop") => ({
    ok: true, status: 200, headers: { get: (h: string) => (h === "x-generation-id" ? "rai-test-0001" : null) },
    json: async () => ({ id: "rai-test-0001", provider: "Anthropic", model: OPUS, choices: [{ finish_reason: finish, message: { content } }], usage: { prompt_tokens: 100, completion_tokens: 50, cost: 0.5 } }),
  });
  type Row = { name: string; env?: Record<string, string>; timeoutMs?: number;
    transport: (url: any, init: any, wire: { sends: number }) => Promise<any>;
    expect: { http: number; status?: string; op: string | null; order: string; attempts: Array<{ state: string; cost_zero?: boolean; tokens?: boolean }>; sends: number; replayStatus: number; replayBodyStatus?: string } };
  const rows: Row[] = [
    { name: "local refusal BEFORE reservation (bad routing in the final body)", env: { PERSONAL_MYTH_V41_PROVIDER_ONLY: "openai" },
      transport: async () => okResponse(),
      expect: { http: 502, op: "failed", order: "generation_failed", attempts: [], sends: 0, replayStatus: 202, replayBodyStatus: "failed" } },
    { name: "local refusal AFTER reservation, nothing handed to the network (LocalSendRefusal)",
      transport: async () => { throw new LocalSendRefusal(); },
      expect: { http: 502, op: "failed", order: "generation_failed", attempts: [{ state: "released", cost_zero: true }], sends: 0, replayStatus: 202, replayBodyStatus: "failed" } },
    { name: "cut before headers (socket lost, request may have left)",
      transport: async (_u, _i, w) => { w.sends++; const e: any = new TypeError("fetch failed"); e.cause = { code: "UND_ERR_SOCKET" }; throw e; },
      expect: { http: 202, status: "uncertain", op: "uncertain", order: "generating", attempts: [{ state: "uncertain" }], sends: 1, replayStatus: 202, replayBodyStatus: "uncertain" } },
    { name: "cut while reading the body",
      transport: async (_u, _i, w) => { w.sends++; return { ok: true, status: 200, headers: { get: () => null }, json: async () => { throw new TypeError("terminated"); } }; },
      expect: { http: 202, status: "uncertain", op: "uncertain", order: "generating", attempts: [{ state: "uncertain" }], sends: 1, replayStatus: 202, replayBodyStatus: "uncertain" } },
    ...[502, 503, 504, 500].map((status): Row => ({ name: `HTTP ${status} from the gateway (work may have started)`,
      transport: async (_u, _i, w) => { w.sends++; return { ok: false, status, headers: { get: () => null }, json: async () => ({}) }; },
      expect: { http: 202, status: "uncertain", op: "uncertain", order: "generating", attempts: [{ state: "uncertain" }], sends: 1, replayStatus: 202, replayBodyStatus: "uncertain" } })),
    ...[400, 401, 422, 429].map((status): Row => ({ name: `HTTP ${status}: confirmed refusal, reservation still held (never released by an HTTP code alone)`,
      transport: async (_u, _i, w) => { w.sends++; return { ok: false, status, headers: { get: () => null }, json: async () => ({ error: { message: "x" } }) }; },
      expect: { http: 502, op: "failed", order: "generation_failed", attempts: [{ state: "uncertain" }], sends: 1, replayStatus: 202, replayBodyStatus: "failed" } })),
    { name: "client timeout (request aborted)", timeoutMs: 60,
      transport: (_u, init, w) => { w.sends++; return new Promise((_res, rej) => init.signal.addEventListener("abort", () => rej(Object.assign(new Error("timeout"), { name: "TimeoutError" })))); },
      expect: { http: 202, status: "uncertain", op: "uncertain", order: "generating", attempts: [{ state: "uncertain" }], sends: 1, replayStatus: 202, replayBodyStatus: "uncertain" } },
    { name: "complete answer, format rejected (help menu): finished attempt with recorded usage",
      transport: async (_u, _i, w) => { w.sends++; return okResponse("Чем могу помочь?\n1. Сказку\n2. Вопрос"); },
      expect: { http: 502, op: "failed", order: "generation_failed", attempts: [{ state: "complete", tokens: true }], sends: 1, replayStatus: 202, replayBodyStatus: "failed" } },
    { name: "complete answer, finish_reason=length: finished attempt with recorded usage",
      transport: async (_u, _i, w) => { w.sends++; return okResponse(okJson, "length"); },
      expect: { http: 502, op: "failed", order: "generation_failed", attempts: [{ state: "complete", tokens: true }], sends: 1, replayStatus: 202, replayBodyStatus: "failed" } },
    { name: "success",
      transport: async (_u, _i, w) => { w.sends++; return okResponse(); },
      expect: { http: 200, status: "ok", op: "complete", order: "ready", attempts: [{ state: "complete", tokens: true }], sends: 1, replayStatus: 200 } },
  ];
  for (const row of rows) {
    it(`outcome: ${row.name}; same request_id and a server restart never send again`, async () => {
      for (const [k, v] of Object.entries(row.env ?? {})) vi.stubEnv(k, v);
      const wire = { sends: 0 };
      const mk = () => new DeepSeekMythProvider({}, new RouterAIClient({ ROUTERAI_API_KEY: "synthetic-test-key" } as any, OPUS, ((u: any, i: any) => row.transport(u, i, wire)) as any, () => undefined));
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), "v41-matrix-"));
      const filename = path.join(dir, "c.sqlite");
      const read = (store: any) => ({
        op: (store.db.prepare("SELECT state FROM operations").all()[0] as any)?.state ?? null,
        order: (store.db.prepare("SELECT state FROM orders").all()[0] as any)?.state,
        attempts: store.db.prepare("SELECT state,cost_micro,input_tokens FROM ai_budget_attempts").all() as any[],
      });
      const check = (store: any) => {
        const r = read(store);
        expect(r.op).toBe(row.expect.op);
        expect(r.order).toBe(row.expect.order);
        expect(r.attempts.map(a => a.state)).toEqual(row.expect.attempts.map(a => a.state));
        row.expect.attempts.forEach((a, n) => {
          if (a.cost_zero) expect(r.attempts[n].cost_micro).toBe(0); else expect(r.attempts[n].cost_micro).toBeGreaterThan(0);
          if (a.tokens) expect(r.attempts[n].input_tokens).toBe(100);
        });
        expect(wire.sends).toBe(row.expect.sends);
      };
      const first = await commerceApp(mk(), { filename, timeoutMs: row.timeoutMs });
      let cookies = "";
      try {
        const r = await first.call("/api/personal-myth", input);
        expect(r.status, JSON.stringify(r.body)).toBe(202);
        expect(r.body.status).toBe("running");
        await vi.waitFor(() => {
          check(first.store);
        });
        const again = await first.call("/api/personal-myth", input);
        expect(again.status).toBe(row.expect.replayStatus);
        if (row.expect.replayBodyStatus) expect(again.body.status).toBe(row.expect.replayBodyStatus);
        check(first.store);
        cookies = first.cookies();
      } finally { first.close(); }
      const second = await commerceApp(mk(), { filename, cookies, timeoutMs: row.timeoutMs });
      try {
        check(second.store);
        const again = await second.call("/api/personal-myth", input);
        expect(again.status).toBe(row.expect.replayStatus);
        check(second.store);
      } finally { second.close(); }
    });
  }

  it("a late answer to the still-open request is accepted exactly once; polling in between sends nothing", async () => {
    const wire = { sends: 0 };
    const transport = (async () => { wire.sends++; await new Promise(r => setTimeout(r, 250)); return okResponse(); }) as any;
    const s = await commerceApp(new DeepSeekMythProvider({}, new RouterAIClient({ ROUTERAI_API_KEY: "synthetic-test-key" } as any, OPUS, transport, () => undefined)), { timeoutMs: 60 });
    try {
      const pending = await s.call("/api/personal-myth", input);
      expect(pending.status).toBe(202);
      expect(pending.body.status).toBe("running");
      await vi.waitFor(() => expect(wire.sends).toBe(1));
      const mid = await s.call("/api/personal-myth", input);
      expect(mid.status).toBe(202);
      expect(mid.body.status).toBe("running");
      await vi.waitFor(async () => {
        const done = await s.call("/api/personal-myth", input);
        expect(done.status).toBe(200);
        expect(done.body.story_result.title).toBe("Синтетическое название");
      });
      const replay = await s.call("/api/personal-myth", input);
      expect(replay.body.replayed).toBe(true);
      expect(wire.sends).toBe(1);
      expect(s.store.db.prepare("SELECT state FROM ai_budget_attempts").all()).toEqual([{ state: "complete" }]);
    } finally { s.close(); }
  });
});

describe("config read used by the screens (no model call)", () => {
  const cfg = async (env: Record<string, string>, options: any) => {
    for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
    const { createApp } = await import("../server");
    const { app } = await createApp({ skipVite: true, ...options });
    const server = app.listen(0, "127.0.0.1"); await once(server, "listening");
    try {
      const r = await fetch(`http://127.0.0.1:${(server.address() as any).port}/api/personal-myth/config`);
      return await r.json() as any;
    } finally { server.close(); (server as any).closeAllConnections?.(); }
  };
  it("reports the writer (v2a default, v41 rollback, legacy), availability and a configured example only", async () => {
    const provider = { name: "x", model: "x", isReady: () => true, generate: async () => "" };
    expect(await cfg({ PERSONAL_MYTH_WRITER: "v41", PERSONAL_MYTH_EXAMPLE_URL: "" }, { mythProvider: provider, isProviderReady: () => false }))
      .toEqual({ writer: "v41", generation_available: false, legal_contact: { email: null, support_url: null }, example_url: null });
    expect(await cfg({ PERSONAL_MYTH_WRITER: "", PERSONAL_MYTH_EXAMPLE_URL: "https://example.test/read" }, { mythProvider: provider, isProviderReady: () => true }))
      .toEqual({ writer: "v2a", generation_available: true, legal_contact: { email: null, support_url: null }, example_url: "https://example.test/read" });
    expect(await cfg({ PERSONAL_MYTH_WRITER: "legacy", PERSONAL_MYTH_EXAMPLE_URL: "" }, { mythProvider: provider, isProviderReady: () => true }))
      .toEqual({ writer: "default", generation_available: true, legal_contact: { email: null, support_url: null }, example_url: null });
    expect((await cfg({ PERSONAL_MYTH_EXAMPLE_URL: "javascript:alert(1)" }, { mythProvider: provider, isProviderReady: () => true })).example_url).toBeNull();
  });
});
