// @vitest-environment node
import crypto from "node:crypto";
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
import { RouterAIClient, FALLBACK_MODEL } from "./routerai";
import {
  DeepSeekMythProvider, generatePersonalMyth, parsePersonalMythRequest, type PersonalMythProvider,
} from "./myth";
import {
  WRITER_V41_FAILURE_PREFIX, buildWriterV41UserMessage, parseWriterV41Response, writerV41MaxTokens,
  writerV41Routing, writerV41SystemMessage,
} from "./mythWriterV41";
import { WRITER_BRIEF_V41, WRITER_BRIEF_V41_SHA256 } from "./mythWriterV41Brief";

afterEach(() => vi.unstubAllEnvs());

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
    expect(writerV41SystemMessage()).toBe(WRITER_BRIEF_V41.trim());
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

  it("flag off: old path, no v41 mode, the old prompt is used", async () => {
    vi.stubEnv("PERSONAL_MYTH_WRITER", "");
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
    expect(out.writerVersion).toBe("personal-myth-writer-v4.1");
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

describe("waiting: the opt-in path shares the existing request_id replay", () => {
  const key = "f".repeat(64);
  const env = {
    FREE_PREVIEW_ENABLED: "true", FREE_PREVIEW_SUPPORT_URL: "https://t.me/synthetic_help", COMMERCE_BUDGET_APPROVED: "true",
    COMMERCE_FREE_BUDGET_RUB: "1000", COMMERCE_FREE_ATTEMPT_MAX: "8", COMMERCE_PAYMENT_MODE: "disabled", LOCAL_STORY_SETUP: "true",
  };

  it("same request_id while running -> 202 and one model call; afterwards a replay, still one call", async () => {
    for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
    vi.stubEnv("PERSONAL_MYTH_WRITER", "v41");
    // Same fixture clock as the other commerce tests (tests/setup.ts): the tariff snapshot must be fresh.
    const clock = vi.spyOn(Date, "now").mockReturnValue(Date.parse(tariffs.captured_at) + 3600000);
    let finish: ((value: string) => void) | undefined;
    const generate = vi.fn((_p: string, _ms: number, _m?: "v41") => new Promise<string>(resolve => { finish = resolve; }));
    const modelProvider: PersonalMythProvider = { name: "routerai", model: "synthetic/model", isReady: () => true, generate };
    const store = new CommerceStore(":memory:", key), app = express();
    app.use(express.json()); installConsentRoutes(app);
    new AIBudget(() => store, env).db(); new FreePreview(() => store, env).activate();
    installStoryCommerce(app, {
      store, ready: () => true,
      myth: async (body: any) => { const g = await generatePersonalMyth(body, modelProvider, 5000); return { status: "ok", story_result: g.result, writer_version: g.writerVersion }; },
      albert: async () => ({ status: "ok", response: "x" }),
    });
    const server = app.listen(0, "127.0.0.1"); await once(server, "listening");
    const origin = `http://127.0.0.1:${(server.address() as any).port}`;
    let cookies = "";
    const call = async (url: string, body?: any) => {
      const r = await fetch(origin + url, { method: body === undefined ? "GET" : "POST", headers: { Origin: origin, Cookie: cookies, "Content-Type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      for (const value of r.headers.getSetCookie()) {
        const pair = value.split(";")[0], name = pair.split("=")[0];
        cookies = cookies.split("; ").filter(v => v && !v.startsWith(name + "=")).concat(pair).join("; ");
      }
      return { status: r.status, body: await r.json() as any };
    };
    try {
      await call("/api/consent", { accepted: true, adult: true, version: CONSENT_VERSION, scope: "core" });
      await call("/api/stories/account", { storage_accepted: true, storage_version: "personal-history-storage-v1" });
      const body = { request_id: "writer_v41_req_001", answers: STORY_SAMPLE_ANSWERS };
      const pending = call("/api/personal-myth", body);
      await vi.waitFor(() => expect(finish).toBeTypeOf("function"));
      for (let i = 0; i < 3; i++) {
        const again = await call("/api/personal-myth", body);
        expect(again.status).toBe(202);
        expect(again.body.story_result).toBeUndefined();
      }
      expect(generate).toHaveBeenCalledTimes(1);
      finish!("```json\n" + okJson + "\n```");
      const done = await pending;
      expect(done.body.story_result.title).toBe("Синтетическое название");
      const replay = await call("/api/personal-myth", body);
      expect(replay.body.replayed).toBe(true);
      expect(replay.body.story_result.story).toBe(story);
      expect(generate).toHaveBeenCalledTimes(1);
      const saved = (await call("/api/stories")).body.orders[0];
      expect(saved.data.myth).toMatchObject({ title: "Синтетическое название", story, one_step: "" });
    } finally { clock.mockRestore(); server.close(); server.closeAllConnections(); store.close(); }
  });
});
