import type { MeetingApiResponse, MeetingDivergence, MeetingOfMirrorsResult, MeetingParallel } from "../types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown, field: string, max = 2400): string {
  if (typeof value !== "string") throw new Error(`meeting_invalid_${field}`);
  const normalized = value.replace(/\s+/gu, " ").trim();
  if (!normalized || normalized.length > max) throw new Error(`meeting_invalid_${field}`);
  return normalized;
}

function parallel(value: unknown, index: number): MeetingParallel {
  if (!isRecord(value)) throw new Error(`meeting_invalid_parallel_${index}`);
  return {
    theme: text(value.theme, `parallel_${index}_theme`, 240),
    codeAnchor: text(value.codeAnchor, `parallel_${index}_code_anchor`),
    mythAnchor: text(value.mythAnchor, `parallel_${index}_myth_anchor`),
    synthesis: text(value.synthesis, `parallel_${index}_synthesis`),
  };
}

function divergence(value: unknown, index: number): MeetingDivergence {
  if (!isRecord(value)) throw new Error(`meeting_invalid_divergence_${index}`);
  return {
    theme: text(value.theme, `divergence_${index}_theme`, 240),
    codeAspect: text(value.codeAspect, `divergence_${index}_code_aspect`),
    mythAspect: text(value.mythAspect, `divergence_${index}_myth_aspect`),
    reflection: text(value.reflection, `divergence_${index}_reflection`),
  };
}

export function parseMeetingResponse(value: unknown): MeetingApiResponse {
  if (!isRecord(value) || value.status !== "ok" || !isRecord(value.result)) {
    throw new Error("meeting_not_ok");
  }
  const raw = value.result;
  if (!Array.isArray(raw.parallels) || raw.parallels.length > 4) throw new Error("meeting_invalid_parallel_count");
  if (!Array.isArray(raw.divergences) || raw.divergences.length > 2) throw new Error("meeting_invalid_divergence_count");
  if (typeof raw.hasStrongParallels !== "boolean") throw new Error("meeting_invalid_strength_flag");

  const parallels = raw.parallels.map(parallel);
  const divergences = raw.divergences.map(divergence);
  if (raw.hasStrongParallels && parallels.length === 0) throw new Error("meeting_strong_without_evidence");

  const result: MeetingOfMirrorsResult = {
    summary: text(raw.summary, "summary"),
    hasStrongParallels: raw.hasStrongParallels,
    confidenceNote: text(raw.confidenceNote, "confidence_note", 500),
    parallels,
    divergences,
    albertInsight: text(raw.albertInsight, "albert_insight"),
    reflectiveQuestion: text(raw.reflectiveQuestion, "reflective_question", 800),
    disclaimer: text(raw.disclaimer, "disclaimer", 1200),
  };
  return { status: "ok", result };
}
