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
  const theme = value.theme || value.title;
  const codeAnchor = value.codeAnchor || value.code_anchor || value.codePerspective || value.code;
  const mythAnchor = value.mythAnchor || value.myth_anchor || value.mythPerspective || value.myth;
  const synthesis = value.synthesis || value.reflection || value.note;
  return {
    theme: text(theme, `parallel_${index}_theme`, 240),
    codeAnchor: text(codeAnchor, `parallel_${index}_code_anchor`),
    mythAnchor: text(mythAnchor, `parallel_${index}_myth_anchor`),
    synthesis: text(synthesis, `parallel_${index}_synthesis`),
  };
}

function divergence(value: unknown, index: number): MeetingDivergence {
  if (!isRecord(value)) throw new Error(`meeting_invalid_divergence_${index}`);
  const theme = value.theme || value.title;
  const codeAspect = value.codeAspect || value.code_aspect || value.codePerspective || value.code_view || value.code;
  const mythAspect = value.mythAspect || value.myth_aspect || value.mythPerspective || value.myth_view || value.myth;
  const refl = value.reflection || value.synthesis || value.note;
  return {
    theme: text(theme, `divergence_${index}_theme`, 240),
    codeAspect: text(codeAspect, `divergence_${index}_code_aspect`),
    mythAspect: text(mythAspect, `divergence_${index}_myth_aspect`),
    reflection: text(refl, `divergence_${index}_reflection`),
  };
}

export function parseMeetingResponse(value: unknown): MeetingApiResponse {
  if (!isRecord(value) || value.status !== "ok" || !isRecord(value.result)) {
    throw new Error("meeting_not_ok");
  }
  const raw = value.result;
  const parallelsRaw = Array.isArray(raw.parallels) ? raw.parallels : (Array.isArray(raw.resonances) ? raw.resonances : []);
  const divergencesRaw = Array.isArray(raw.divergences) ? raw.divergences : (Array.isArray(raw.contrasts) ? raw.contrasts : []);
  if (parallelsRaw.length > 4) throw new Error("meeting_invalid_parallel_count");
  if (divergencesRaw.length > 2) throw new Error("meeting_invalid_divergence_count");

  const hasStrong = typeof raw.hasStrongParallels === "boolean" 
    ? raw.hasStrongParallels 
    : (typeof raw.has_strong_parallels === "boolean" ? raw.has_strong_parallels : parallelsRaw.length > 0);

  const parallels = parallelsRaw.map(parallel);
  const divergences = divergencesRaw.map(divergence);
  if (hasStrong && parallels.length === 0) throw new Error("meeting_strong_without_evidence");

  const confNote = raw.confidenceNote || raw.confidence_note || "Синтез независимых линз";
  const insight = raw.albertInsight || raw.albert_insight || raw.insight || raw.summary;
  const question = raw.reflectiveQuestion || raw.reflective_question || raw.question || "О чем для вас этот диалог двух зеркал?";
  const disclaimerText = raw.disclaimer || "Эти две версии появились независимо. Одна — из вашей даты, другая — из образов, выбранных вами. Совпадения между ними ничего не доказывают, но дают повод присмотреться к себе внимательнее.";

  const result: MeetingOfMirrorsResult = {
    summary: text(raw.summary, "summary"),
    hasStrongParallels: hasStrong,
    confidenceNote: text(confNote, "confidence_note", 500),
    parallels,
    divergences,
    albertInsight: text(insight, "albert_insight"),
    reflectiveQuestion: text(question, "reflective_question", 800),
    disclaimer: text(disclaimerText, "disclaimer", 1200),
  };
  return { status: "ok", result };
}
