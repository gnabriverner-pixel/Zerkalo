import { createHash } from "node:crypto";
import type { StoryInputs } from "../src/types";
import {
  WRITER_V2A_JSON_INSTRUCTION, WRITER_V2A_MODE_LINE, WRITER_V2A_SYSTEM_SHA256, MYTH_WRITER_CONTRACT_V2, MYTH_WRITER_CONTRACT_V2_SHA256,
} from "./mythWriterV2ABrief";
import { classifyUnparsable } from "./mythWriterV41";
import { MYTH_V2A_QUESTIONS } from "../src/services/mythQuestionsV2A";
export { WRITER_V41_MODEL as WRITER_V2A_MODEL } from "./routerai";

/**
 * Personal Myth writer v2a = "mode A" of the writer contract v2: independent of the Code (no date, numbers, planets or
 * Code terms ever reach this writer). Default writer of this branch; PERSONAL_MYTH_WRITER=v41 is the rollback to v4.1
 * and PERSONAL_MYTH_WRITER=legacy keeps the old v1.5 path.
 */
export const PERSONAL_MYTH_WRITER_V2A_VERSION = "personal-myth-v2a";
export const WRITER_V2A_FAILURE_PREFIX = "personal_myth_quality_failed:writer_v2a_";
/** Fixed UI line shown under the myth (a constant of the page, never generated). */
export const WRITER_V2A_FIXED_LINE = "Если вы не узнали себя — это тоже ответ. Сказка — образ, не биография.";

export type PersonalMythWriterKind = "v2a" | "v41" | "legacy";

/** unset / empty / "v2a" (and any unknown value) -> v2a; "v41" -> rollback to v4.1; "legacy" -> old v1.5 path. */
export function resolvePersonalMythWriter(env: NodeJS.ProcessEnv = process.env): PersonalMythWriterKind {
  const value = String(env.PERSONAL_MYTH_WRITER ?? "").trim().toLowerCase();
  if (value === "v41") return "v41";
  if (value === "legacy") return "legacy";
  return "v2a";
}
export const isWriterV2AEnabled = (env: NodeJS.ProcessEnv = process.env): boolean => resolvePersonalMythWriter(env) === "v2a";

/** Output ceiling for the writer call (owner decision R3). Must not exceed server/aiBudgetPolicy.json max_output_tokens. */
export const WRITER_V2A_MAX_TOKENS = 12000;
export const writerV2AMaxTokens = (): number => WRITER_V2A_MAX_TOKENS;

/** The system message: contract verbatim + blank line + mode-A line + blank line + JSON instruction. */
export const writerV2ASystemMessage = (): string =>
  `${MYTH_WRITER_CONTRACT_V2}\n\n${WRITER_V2A_MODE_LINE}\n\n${WRITER_V2A_JSON_INSTRUCTION}`;

const sha256 = (text: string): string => createHash("sha256").update(text, "utf8").digest("hex");
/** True only when both pinned hashes match; checked before any reservation or send. */
export function writerV2ASystemMessageIntact(): boolean {
  return sha256(MYTH_WRITER_CONTRACT_V2) === MYTH_WRITER_CONTRACT_V2_SHA256 && sha256(writerV2ASystemMessage()) === WRITER_V2A_SYSTEM_SHA256;
}

/** Contract section 1 wording of the three questions (shared with the questionnaire UI; q1 -> q1, moment -> q3, wanted -> q4, q2 empty). */
export const WRITER_V2A_QUESTIONS = MYTH_V2A_QUESTIONS;

/** Only the three answers (and nothing else) reach the writer. */
export function buildWriterV2AUserMessage(answers: StoryInputs): string {
  const lines = WRITER_V2A_QUESTIONS.map((q, index) => `${index + 1}. ${q.label}: ${answers[q.key]}`);
  return `Ответы человека:\n${lines.join("\n")}\n\nНапиши для этого человека сказку по контракту (режим А). Верни только один JSON-объект с полями «title», «story», «made_of», «meaning», «question», «practice».`;
}

export interface WriterV2AOutput {
  title: string;
  story: string;
  made_of: Array<{ element: string; source: string }>;
  meaning: string;
  question: string;
  practice: string;
}

export class WriterV2AInvalid extends Error {
  constructor(readonly reason: string, readonly detail: string[] = []) { super(WRITER_V2A_FAILURE_PREFIX + reason); this.name = "WriterV2AInvalid"; }
}
const fail = (reason: string, detail: string[] = []): never => { throw new WriterV2AInvalid(reason, detail); };

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const text = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);

/** Strict JSON + schema check (one object, bare or in one outer ```json block). Unknown extra fields are ignored and dropped. */
export function parseWriterV2AResponse(raw: unknown): WriterV2AOutput {
  if (typeof raw !== "string" || !raw.trim()) return fail("empty");
  let body = raw.trim();
  if (body.startsWith("```")) {
    const fenced = /^```(?:json)?[ \t]*\r?\n?([\s\S]*?)\r?\n?```$/iu.exec(body);
    if (!fenced || fenced[1].includes("```")) return fail("text_around_json");
    body = fenced[1].trim();
  }
  let parsed: unknown;
  try { parsed = JSON.parse(body); } catch {
    return classifyUnparsable(body, reason => fail(reason));
  }
  if (!isRecord(parsed)) return fail("not_object");
  const title = text(parsed.title), story = text(parsed.story), meaning = text(parsed.meaning),
    question = text(parsed.question), practice = text(parsed.practice);
  if (!title || !story || !meaning || !question || !practice) return fail("missing_or_empty_fields");
  if (!Array.isArray(parsed.made_of)) return fail("made_of_not_array");
  if (parsed.made_of.length < 5 || parsed.made_of.length > 8) return fail("made_of_rows_out_of_5_8");
  const made_of = parsed.made_of.map(row => {
    if (!isRecord(row)) return fail("made_of_row_shape");
    const element = text(row.element), source = text(row.source);
    if (!element || !source) return fail("made_of_row_empty");
    return { element: element.trim(), source: source.trim() };
  });
  return { title: title.trim(), story, made_of, meaning: meaning.trim(), question: question.trim(), practice: practice.trim() };
}

/** Latin words of 2+ letters in the generated texts. Words the person wrote themselves (e.g. "iPhone") are allowed. */
export function findLatinWords(output: WriterV2AOutput, answers: StoryInputs): string[] {
  const allowed = new Set((Object.values(answers).join(" ").match(/[A-Za-z]{2,}/gu) ?? []).map(w => w.toLowerCase()));
  const fields = [output.title, output.story, output.meaning, output.question, output.practice,
    ...output.made_of.flatMap(row => [row.element, row.source])];
  const found = new Set<string>();
  for (const field of fields) for (const word of field.match(/[A-Za-z]{2,}/gu) ?? []) if (!allowed.has(word.toLowerCase())) found.add(word);
  return [...found];
}

/** Parse + schema + Latin check; throws WriterV2AInvalid. Deliberately NO style/length/register/device regexes. */
export function validateWriterV2AResponse(raw: unknown, answers: StoryInputs): WriterV2AOutput {
  const output = parseWriterV2AResponse(raw);
  const latin = findLatinWords(output, answers);
  if (latin.length) return fail("latin_words", latin.slice(0, 5));
  return output;
}

/** Appended to the user message on the single retry; names the problem, adds no new content. */
export function writerV2ARetryNote(error: WriterV2AInvalid): string {
  const detail = error.reason === "latin_words" && error.detail.length
    ? ` В прошлой попытке встретились слова латиницей: ${error.detail.join(", ")}. Замени их русскими.`
    : "";
  return `\n\nПрошлый ответ не прошёл проверку формата (${error.reason}).${detail} Верни один корректный JSON-объект по инструкции, весь текст по-русски.`;
}

export interface WriterV2ARouting { strict_finish: true; }
export const writerV2ARouting = (): WriterV2ARouting => ({ strict_finish: true });

/** Primary call failure that justifies the DeepSeek fallback: HTTP error (incl. 402), timeout, finish=length, unfinished/empty answer, gateway error. */
export function writerV2AFallbackEligible(error: unknown): boolean {
  const code = error instanceof Error ? error.message : "";
  return /^provider_(?:http_\d{3}|call_timeout|unavailable|truncated|not_finished|empty_output|invalid_json|gateway_error|upstream_mismatch|model_mismatch)$/u.test(code);
}
