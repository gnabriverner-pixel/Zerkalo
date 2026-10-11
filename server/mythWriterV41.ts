import type { StoryInputs } from "../src/types";
import { WRITER_BRIEF_V42 } from "./mythWriterV42Brief";
export { WRITER_V41_MODEL } from "./routerai";

/**
 * Personal Myth writer v4.1 ("title + story" only). Off by default: the site keeps the old path unless
 * PERSONAL_MYTH_WRITER=v41 is set. No editor, no automatic regeneration, no fallback model on this path.
 */
export const PERSONAL_MYTH_WRITER_V41_VERSION = "personal-myth-writer-v4.2";
/** SHA-256 of the system message as SENT (brief v4.2 after .strip()); before .strip() it is WRITER_BRIEF_V42_SHA256. */
export const WRITER_V42_SENT_SHA256 = "20b4ee34dc634a8a86d55b3e344c84f87d494a96f3b37d5249523384e3a1a09a";
export const WRITER_V41_FAILURE_PREFIX = "personal_myth_quality_failed:writer_v41_";

export function isWriterV41Enabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return String(env.PERSONAL_MYTH_WRITER ?? "").trim() === "v41";
}

/** The system message of the opt-in path is brief v4.2 (v4.1 + one paragraph), sent as `.strip()`ped text. */
export const writerV41SystemMessage = (): string => WRITER_BRIEF_V42.trim();

/**
 * Site questions: q1 situation, q2 image of the state, q3 point of aliveness, q4 sought quality.
 * Template items 3 and 4 are swapped on purpose: item 3 "what is missing" is the site's q4,
 * item 4 "a moment of feeling alive" is the site's q3.
 */
const TEMPLATE_ITEMS: ReadonlyArray<readonly [label: string, siteKey: keyof StoryInputs]> = [
  ["Что сейчас тяжелее всего", "q1"],
  ["Если бы это состояние было стихией или существом — как бы оно выглядело, звучало, пахло", "q2"],
  ["Чего сейчас не хватает больше всего", "q4"],
  ["Момент, когда чувствовал себя по-настоящему живым или нужным", "q3"],
];

export function buildWriterV41UserMessage(answers: StoryInputs): string {
  const lines = TEMPLATE_ITEMS.map(([label, key], index) => `${index + 1}. ${label}: ${answers[key]}`);
  return `Ответы человека:\n${lines.join("\n")}\n\nНапиши для этого человека цельную взрослую сказку по системной инструкции. Верни только один JSON-объект с полями «title» и «story».`;
}

/** Output budget for the writer: not below 5000, never above the budget policy ceiling (8000). */
export function writerV41MaxTokens(env: NodeJS.ProcessEnv = process.env): number {
  const configured = Number(env.PERSONAL_MYTH_V41_MAX_TOKENS);
  const value = Number.isFinite(configured) && configured > 0 ? Math.trunc(configured) : 6000;
  return Math.min(8000, Math.max(5000, value));
}

export interface WriterV41Routing {
  verbosity?: "low" | "medium" | "high";
  provider_only?: string[];
  strict_finish: true;
}

/** Optional transport knobs; all unset by default except the strict finish_reason check. */
export function writerV41Routing(env: NodeJS.ProcessEnv = process.env): WriterV41Routing {
  const routing: WriterV41Routing = { strict_finish: true };
  const verbosity = String(env.PERSONAL_MYTH_V41_VERBOSITY ?? "").trim();
  if (verbosity === "low" || verbosity === "medium" || verbosity === "high") routing.verbosity = verbosity;
  const only = String(env.PERSONAL_MYTH_V41_PROVIDER_ONLY ?? "")
    .split(",").map(part => part.trim()).filter(part => /^[a-z0-9][a-z0-9_-]{0,40}$/u.test(part));
  if (only.length) routing.provider_only = only;
  return routing;
}

export interface WriterV41Output { title: string; story: string; }

const fail = (reason: string): never => { throw new Error(WRITER_V41_FAILURE_PREFIX + reason); };

/** Number of top-level JSON-looking objects in `text` (braces outside of strings). */
function topLevelObjectCount(text: string): number {
  let depth = 0, count = 0, inString = false, escaped = false;
  for (const ch of text) {
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
    } else if (ch === '"') inString = true;
    else if (ch === "{") depth++;
    else if (ch === "}" && depth > 0 && --depth === 0) count++;
  }
  return count;
}

function classifyUnparsable(body: string): never {
  const first = body.indexOf("{"), last = body.lastIndexOf("}");
  if (first === -1) {
    // A help menu / clarifying question instead of a story: no JSON at all.
    const menuLike = /(?:^|\n)\s*(?:\d+[.)]|[-*•])\s+\S/u.test(body) || /\?\s*$/u.test(body);
    return fail(menuLike ? "help_menu" : "not_json");
  }
  if (last > first) {
    let sliceParses = true;
    try { JSON.parse(body.slice(first, last + 1)); } catch { sliceParses = false; }
    if (sliceParses) return fail("text_around_json");
  }
  return fail(topLevelObjectCount(body) > 1 ? "multiple_objects" : "invalid_json");
}

/**
 * Strict contract: exactly one JSON object with string fields `title` and `story` (non-empty),
 * either bare or inside ONE outer ```json … ``` (or ``` … ```) block with nothing around it.
 * Anything else is rejected with a reason code; nothing is repaired or recomposed.
 * (Deliberately not extractJsonString() from myth.ts: it slices first "{" … last "}" and would accept text around.)
 */
export function parseWriterV41Response(raw: unknown): WriterV41Output {
  if (typeof raw !== "string" || !raw.trim()) return fail("empty");
  let body = raw.trim();
  if (body.startsWith("```")) {
    const fenced = /^```(?:json)?[ \t]*\r?\n?([\s\S]*?)\r?\n?```$/iu.exec(body);
    if (!fenced || fenced[1].includes("```")) return fail("text_around_json");
    body = fenced[1].trim();
  }
  let parsed: unknown;
  try { parsed = JSON.parse(body); } catch { return classifyUnparsable(body); }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return fail("not_object");
  const record = parsed as Record<string, unknown>;
  const keys = Object.keys(record);
  if (keys.some(key => key !== "title" && key !== "story")) return fail("extra_fields");
  if (!("title" in record) || !("story" in record)) return fail("missing_fields");
  if (typeof record.title !== "string" || typeof record.story !== "string") return fail("wrong_types");
  if (!record.title.trim()) return fail("title_empty");
  if (!record.story.trim()) return fail("story_empty");
  return { title: record.title, story: record.story };
}
