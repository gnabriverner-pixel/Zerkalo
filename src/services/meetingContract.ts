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

function stripQuotedText(input: string): string {
  return input
    .replace(/«[^»]*»/gu, " ")
    .replace(/"[^"]*"/gu, " ")
    .replace(/“[^”]*”/gu, " ");
}

const THIRD_PERSON_USER_DISCUSSION = /(?<![а-яё])(?:пользователь[а-яё]*|читатель[а-яё]*|автор[а-яё]*\s+(?:ответов|запроса|истории)|в\s+(?:ответах|запросе|ситуации|словах|выборе)\s+человека|для\s+(?:самого\s+)?человека|у\s+(?:самого\s+)?человека|самому\s+человеку|человек\s+(?:в\s+(?:своих\s+)?ответах|описывает|рассказывает|называет|пишет|ищет|хочет|сталкивается|выбирает|чувствует|говорит|ответил|спрашивает|отмечает|делится))(?![а-яё])/iu;

const BROKEN_SINGLE_WORD_PRONOUN_SUBSTITUTION = /(?<![а-яё])(?:вы\s+(?:описывает|рассказывает|называет|пишет|ищет|хочет|сталкивается|выбирает|чувствует|говорит|ответил|ответила|сделал|сделала|может|принял|приняла)|в\s+(?:ответах|запросе|ситуации)\s+(?:вы|вас|вам)|(?:для|у)\s+самого\s+(?:вы|вас|вам))(?![а-яё])/iu;

export function isThirdPersonUserDiscussionOrBrokenAgreement(value: string): boolean {
  const unquoted = stripQuotedText(value);
  return THIRD_PERSON_USER_DISCUSSION.test(unquoted) || BROKEN_SINGLE_WORD_PRONOUN_SUBSTITUTION.test(unquoted);
}

const PROVISIONAL_SUPPORT_LANGUAGE = /(?:может|мог(?:ла|ло|ли)?\s+бы|можно|возможно|похоже|если|стоит\s+проверить|пока\s+не\s+видно)/iu;
const HIDDEN_SUPPORT_CLAIM = /(?:скрыт[а-яё]*\s+(?:сила|талант|потенциал|ресурс)|в\s+вас\s+(?:уже\s+)?есть|вы\s+(?:обладаете|способны|предназначены)|ваша\s+истинн[а-яё]*\s+(?:сила|сущност)|вам\s+(?:нужно|необходимо)|вы\s+должны)/iu;
const UNGROUNDED_OUTCOME_PROMISE = /(?:ночн[а-яё]*\s+переделк[а-яё]*\s+станов[а-яё]*\s+менее\s+неизбежн|уменьш[а-яё]*\s+(?:ночн[а-яё]*\s+)?переделк|сократ[а-яё]*\s+(?:ночн[а-яё]*\s+)?переделк|избав[а-яё]*\s+от\s+(?:срывов|переделок)|срывы\s+прекратятся|переделки\s+исчезнут|конфликты\s+исчезнут|гарантированн[а-яё]*\s+результат|неизбежно\s+привед[её]т)/iu;

const IMAGE_AS_TESTED_REAL_BEHAVIOR = /(?:удерживать\s+паузу,\s+как\s+вы\s+это\s+делаете,\s+когда\s+молча\s+забираете\s+папку|как\s+вы\s+это\s+делаете,\s+когда\s+(?:молча\s+)?(?:забираете\s+папку|закрываете\s+дверь)|вы\s+забираете\s+папку\s+и\s+закрываете\s+дверь[^.]*это\s+уже\s+испытанн[а-яё]*\s+вами\s+способ|это\s+уже\s+испытанн[а-яё]*\s+вами\s+способ)/iu;

const EXPLICIT_IMAGE_ORIGIN_MARKER = /(?:в\s+(?:выбранном\s+вами\s+)?образе|в\s+образной\s+сцене|в\s+вашей\s+метафоре|в\s+метафорической\s+сцене|в\s+сюжете\s+мифа|в\s+сцене\s+мифа|внутри\s+образа)/iu;

export interface MeetingSourceContext {
  userQuestion?: string;
  storyInputs?: {
    q1?: string;
    q2?: string;
    q3?: string;
    q4?: string;
  };
  storyResult?: {
    title?: string;
    story?: string;
    mirror?: Record<string, string>;
  };
}

export function hasSourceOriginConflation(
  value: string,
  sourceContext?: MeetingSourceContext,
): boolean {
  if (UNGROUNDED_OUTCOME_PROMISE.test(value)) {
    return true;
  }
  if (IMAGE_AS_TESTED_REAL_BEHAVIOR.test(value) && !EXPLICIT_IMAGE_ORIGIN_MARKER.test(value)) {
    return true;
  }
  if (!sourceContext?.storyInputs) {
    return false;
  }

  const realContextText = `${sourceContext.userQuestion || ""} ${sourceContext.storyInputs.q1 || ""}`.toLowerCase();
  const imageContextText = `${sourceContext.storyInputs.q2 || ""} ${sourceContext.storyInputs.q3 || ""} ${sourceContext.storyInputs.q4 || ""}`.toLowerCase();
  const mythFictionText = `${sourceContext.storyResult?.title || ""} ${sourceContext.storyResult?.story || ""}`.toLowerCase();

  // Extract content tokens (>= 5 letters) that appear in image (q2-q4) or Myth fiction, but NOT in realContextText
  const tokenize = (s: string) =>
    (s.match(/[а-яё]{5,}/giu) || []).map((w) => w.toLowerCase().slice(0, 6));
  const realStems = new Set(tokenize(realContextText));
  const imageOnlyStems = new Set(tokenize(imageContextText).filter((stem) => !realStems.has(stem)));
  const userAllStems = new Set([...realStems, ...imageOnlyStems]);
  const mythOnlyStems = new Set(tokenize(mythFictionText).filter((stem) => !userAllStems.has(stem)));

  const lowerVal = value.toLowerCase();
  const valStems = tokenize(lowerVal);
  const referencesImageOnly = valStems.some((stem) => imageOnlyStems.has(stem));
  const referencesMythOnly = valStems.some((stem) => mythOnlyStems.has(stem));

  // 1. If text references image-only stems and claims it is already practiced real-life behavior without image attribution
  const claimsAlreadyPracticedInRealLife = /(?:как\s+вы\s+(?:это\s+)?делаете|уже\s+испытанн[а-яё]*\s+вами\s+способ|вы\s+уже\s+применяете\s+в\s+работе|ваша\s+привычк[а-яё]*\s+в\s+реальности)/iu.test(
    value,
  );
  if (referencesImageOnly && claimsAlreadyPracticedInRealLife && !EXPLICIT_IMAGE_ORIGIN_MARKER.test(value)) {
    return true;
  }

  // 2. If text claims the user themselves said/told a detail that exists ONLY in Myth fiction
  const claimsUserToldMythFiction = /(?:вы\s+(?:сами\s+)?(?:рассказали|назвали|описали|упомянули)|в\s+вашем\s+ответе\s+вы\s+назвали)/iu.test(
    value,
  );
  if (referencesMythOnly && !referencesImageOnly && claimsUserToldMythFiction && !/(?:в\s+мифе|в\s+истории|в\s+сказке)/iu.test(value)) {
    return true;
  }

  return false;
}

export function isUnsupportedSupportClaim(value: string): boolean {
  return (
    !PROVISIONAL_SUPPORT_LANGUAGE.test(value) ||
    HIDDEN_SUPPORT_CLAIM.test(value) ||
    UNGROUNDED_OUTCOME_PROMISE.test(value)
  );
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

/**
 * Detects spurious grounding where decorative/atmospheric/scenic imagery from Myth
 * is promoted into evidence for psychological, behavioral, or Code claims (e.g. burnout, exhaustion, overwork).
 * Decorative scenery, weather, lighting, lamps, room textures or sheets on ropes are never valid evidence.
 */
export function isSpuriousDecorativeGrounding(p: {
  theme?: string;
  codeAnchor?: string;
  mythAnchor?: string;
  synthesis?: string;
}): boolean {
  const myth = (p.mythAnchor || "").toLowerCase();
  const theme = (p.theme || "").toLowerCase();
  const code = (p.codeAnchor || "").toLowerCase();
  const synth = (p.synthesis || "").toLowerCase();
  const allText = `${theme} ${code} ${synth} ${myth}`;

  // 1. Scenery / decorative elements on the Myth side
  const hasScenicDecor = /(?:настольн\w*\s+ламп\w*|ламп[аеыуо]|мокры\w*\s+лист\w*|лист\w*\s+на\s+(?:натянут\w*\s+)?вер[её]вк\w*|натянут\w*\s+вер[её]вк\w*|вер[её]вк[аеыуо]|полумрак\w*|сумерк\w*|погод\w*|дожд\w*|текстур\w*|пейзаж\w*|декораци\w*|натюрморт\w*)/i.test(myth);

  // 2. Promotion to psychological burnout, overwork, exhaustion, fatigue, neglecting physical needs
  const hasPsychologicalOverreach = /(?:истощени|выгорани|трудоголизм|поглощен|забывая\s+про\s+тело|усталост|перевес\s+работ|вечерн\w*\s+труд|сосредоточенн\w*\s+труд|переутомлени|сверхвключенност)/i.test(allText);

  if (hasScenicDecor && hasPsychologicalOverreach) {
    return true;
  }

  // 3. Directly claiming decorative details represent labor burden or evening work
  if (/(?:лампа|вер[её]вка|лист\w*\s+на\s+вер[её]вке).*(?:образ\s+(?:вечернего|сосредоточенного)?\s*труда|работа\s+продолжается\s+вечерами)/i.test(myth + " " + synth)) {
    return true;
  }

  return false;
}

export function isSpuriousDecorativeDivergence(d: {
  theme?: string;
  codeAspect?: string;
  mythAspect?: string;
  reflection?: string;
}): boolean {
  const myth = (d.mythAspect || "").toLowerCase();
  const theme = (d.theme || "").toLowerCase();
  const code = (d.codeAspect || "").toLowerCase();
  const refl = (d.reflection || "").toLowerCase();
  const allText = `${theme} ${code} ${refl} ${myth}`;

  const hasScenicDecor = /(?:настольн\w*\s+ламп\w*|ламп[аеыуо]|мокры\w*\s+лист\w*|лист\w*\s+на\s+(?:натянут\w*\s+)?вер[её]вк\w*|натянут\w*\s+вер[её]вк\w*|вер[её]вк[аеыуо]|полумрак\w*|сумерк\w*|погод\w*|дожд\w*|текстур\w*|пейзаж\w*|декораци\w*|натюрморт\w*)/i.test(myth);

  const hasPsychologicalOverreach = /(?:истощени|выгорани|трудоголизм|поглощен|забывая\s+про\s+тело|усталост|перевес\s+работ|вечерн\w*\s+труд|сосредоточенн\w*\s+труд|переутомлени|сверхвключенност)/i.test(allText);

  return hasScenicDecor && hasPsychologicalOverreach;
}

export function parseMeetingResponse(
  value: unknown,
  sourceContext?: MeetingSourceContext,
): MeetingApiResponse {
  if (!isRecord(value) || value.status !== "ok" || !isRecord(value.result)) {
    throw new Error("meeting_not_ok");
  }
  const raw = value.result;
  const parallelsRaw = Array.isArray(raw.parallels) ? raw.parallels : (Array.isArray(raw.resonances) ? raw.resonances : []);
  const divergencesRaw = Array.isArray(raw.divergences) ? raw.divergences : (Array.isArray(raw.contrasts) ? raw.contrasts : []);
  if (parallelsRaw.length > 4) throw new Error("meeting_invalid_parallel_count");
  if (divergencesRaw.length > 2) throw new Error("meeting_invalid_divergence_count");

  const rawHasStrong = typeof raw.hasStrongParallels === "boolean" 
    ? raw.hasStrongParallels 
    : (typeof raw.has_strong_parallels === "boolean" ? raw.has_strong_parallels : parallelsRaw.length > 0);

  if (rawHasStrong && parallelsRaw.length === 0) {
    throw new Error("meeting_strong_without_evidence");
  }

  const parsedParallels = parallelsRaw.map(parallel);
  const parallels = parsedParallels.filter(p => !isSpuriousDecorativeGrounding(p));
  const divergences = divergencesRaw.map(divergence).filter(d => !isSpuriousDecorativeDivergence(d));

  const hasStrong = parallels.length > 0 ? rawHasStrong : false;

  const confNote = raw.confidenceNote || raw.confidence_note || (parallels.length > 0 ? "Синтез независимых линз" : "Разные плоскости");
  const supportValue = raw.possibleSupport || raw.possible_support || raw.supportHypothesis || raw.support_hypothesis;
  const possibleSupport = text(supportValue, "possible_support", 1600);
  if (isUnsupportedSupportClaim(possibleSupport)) {
    throw new Error("meeting_unsupported_support_claim");
  }
  const insight = raw.albertInsight || raw.albert_insight || raw.insight || raw.summary;
  const question = raw.reflectiveQuestion || raw.reflective_question || raw.question || "О чем для вас этот диалог двух зеркал?";
  const disclaimerText = raw.disclaimer || "Код и Миф — два независимых взгляда. Ни один из них не считается истиной о вас: мы смотрим, какое новое различие появляется, если поставить их рядом.";

  const result: MeetingOfMirrorsResult = {
    summary: text(raw.summary, "summary"),
    hasStrongParallels: hasStrong,
    confidenceNote: text(confNote, "confidence_note", 500),
    possibleSupport,
    parallels,
    divergences,
    albertInsight: text(insight, "albert_insight"),
    reflectiveQuestion: text(question, "reflective_question", 800),
    disclaimer: text(disclaimerText, "disclaimer", 1200),
  };

  const personalTextFields = [
    result.summary,
    result.possibleSupport,
    result.albertInsight,
    result.reflectiveQuestion,
    ...result.parallels.map((p) => p.synthesis),
    ...result.divergences.map((d) => d.reflection),
  ];

  if (personalTextFields.some((field) => isThirdPersonUserDiscussionOrBrokenAgreement(field))) {
    throw new Error("meeting_third_person_about_user");
  }

  if (personalTextFields.some((field) => hasSourceOriginConflation(field, sourceContext))) {
    throw new Error("meeting_source_conflation");
  }

  return { status: "ok", result };
}
