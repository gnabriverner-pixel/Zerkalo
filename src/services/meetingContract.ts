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

const EXPLICIT_IMAGE_ORIGIN_MARKER =
  /(?:в\s+(?:выбранном\s+вами\s+)?образе|в\s+образной\s+сцене|в\s+вашей\s+метафоре|в\s+метафорической\s+сцене|в\s+сюжете\s+мифа|в\s+сцене\s+мифа|внутри\s+образа)/iu;

const EXPLICIT_NEUTRAL_HYPOTHESIS_MARKER =
  /(?:в\s+вашем\s+ответе[^.!?]{0,120}(?:можно\s+проверить|как\s+гипотез|стоит\s+проверить)|можно\s+проверить,\s+пригодится\s+ли)/iu;

const UNKNOWN_RESOURCE_ANSWER =
  /(?:^|[\s,])(?:не\s+знаю|ничего(?:\s+конкретного|\s+такого)?\s+не\s+(?:вспоминается|приходит)|не\s+могу\s+вспомнить|трудно\s+сказать|нет\s+такой\s+точки)(?:[.!\s,]|$)/iu;

const EXPLICIT_REAL_EXPERIENCE_IN_Q3 =
  /(?<![а-яё])(?:на\s+работе|в\s+рабочей\s+практике|в\s+жизни|в\s+реальности|по\s+утрам|по\s+вечерам|дома|с\s+командой|с\s+инженер[а-яё]*|с\s+клиент[а-яё]*|с\s+коллег[а-яё]*|с\s+заказчик[а-яё]*|на\s+созвон[а-яё]*|на\s+встреч[а-яё]*|когда\s+(?:я\s+)?(?:разбираю\s+смет|пишу\s+код|веду\s+ревью|обсуждаю\s+задач|готовлю\s+ужин|чиню|тренируюсь|гуляю\s+в\s+парке|работаю\s+в\s+мастерской|провод[а-яё]*\s+разбор))(?![а-яё])/iu;

const SCENIC_METAPHOR_CUE_IN_Q3 =
  /(?<![а-яё])(?:курьер[а-яё]*|папк[а-яё]*|плотн[а-яё]*\s+штор[а-яё]*|маяк[а-яё]*|остров[а-яё]*|шторм[а-яё]*|башн[а-яё]*|зам[ока][а-яё]*|корабл[а-яё]*|парус[а-яё]*|пещер[а-яё]*|манти[а-яё]*|сундук[а-яё]*|факел[а-яё]*)(?![а-яё])/iu;

export type Q3ContentClassification = "unknown_resource" | "real_experience" | "imaginative_scene" | "ambiguous";

export function classifyQ3Content(q3Raw?: string, q2Raw?: string): Q3ContentClassification {
  const q3 = (q3Raw || "").trim();
  if (!q3 || UNKNOWN_RESOURCE_ANSWER.test(q3)) {
    return "unknown_resource";
  }
  const tokenize = (s: string) =>
    (s.match(/[а-яё]{5,}/giu) || []).map((w) => w.toLowerCase().slice(0, 6));
  const q2Stems = new Set(tokenize(q2Raw || ""));
  const q3Stems = tokenize(q3);
  const sharesQ2MetaphorStem = q3Stems.some((st) => q2Stems.has(st));

  if (SCENIC_METAPHOR_CUE_IN_Q3.test(q3) || sharesQ2MetaphorStem) {
    return "imaginative_scene";
  }
  if (EXPLICIT_REAL_EXPERIENCE_IN_Q3.test(q3)) {
    return "real_experience";
  }
  return "ambiguous";
}

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

  const tokenize = (s: string) =>
    (s.match(/[а-яё]{5,}/giu) || []).map((w) => w.toLowerCase().slice(0, 6));

  const q1AndQuestion = [sourceContext.userQuestion, sourceContext.storyInputs.q1]
    .filter(Boolean)
    .join(".\n");
  const q2Text = sourceContext.storyInputs.q2 || "";
  const q3Text = sourceContext.storyInputs.q3 || "";
  const q4Text = sourceContext.storyInputs.q4 || "";
  const q3Kind = classifyQ3Content(q3Text, q2Text);

  // Separate colleague/third-party clauses inside q1AndQuestion from user's own actions
  const colleagueClauses: string[] = [];
  const userRealText = q1AndQuestion.replace(
    /(?:коллег[а-яё]*|начальник[а-яё]*|руководител[а-яё]*|партн[её]р[а-яё]*|клиент[а-яё]*|заказчик[а-яё]*|сосед[а-яё]*)[^.!?\n;]{0,120}/giu,
    (match) => {
      // Split if user's own clause follows after ", а я " or "; я "
      const splitIdx = match.search(/,\s*(?:а|но)\s+я(?![а-яё])/iu);
      if (splitIdx >= 0) {
        colleagueClauses.push(match.slice(0, splitIdx));
        return match.slice(splitIdx);
      }
      colleagueClauses.push(match);
      return " ";
    },
  );

  // Real experience context includes user's own q1/userQuestion PLUS q3 ONLY when q3 is an explicit real experience
  const realExperienceText =
    q3Kind === "real_experience" ? `${userRealText} ${q3Text}` : userRealText;
  const realStems = new Set(tokenize(realExperienceText));

  // Image stems come from q2, plus q3 when q3 is an imaginative scene
  const imageSourceText =
    q3Kind === "imaginative_scene" ? `${q2Text} ${q3Text}` : q2Text;
  const imageOnlyStems = new Set(
    tokenize(imageSourceText).filter((stem) => !realStems.has(stem)),
  );

  // Ambiguous q3 stems (neither explicitly real nor purely scenic metaphor)
  const ambiguousQ3Stems = new Set(
    q3Kind === "ambiguous"
      ? tokenize(q3Text).filter((stem) => !realStems.has(stem) && !imageOnlyStems.has(stem))
      : [],
  );

  // Desired direction stems from q4 (excluding stems already in real experience)
  const q4WishOnlyStems = new Set(
    tokenize(q4Text).filter(
      (stem) => !realStems.has(stem) && !imageOnlyStems.has(stem) && !ambiguousQ3Stems.has(stem),
    ),
  );

  // Colleague-only stems from colleague clauses in q1/userQuestion
  const colleagueOnlyStems = new Set(
    tokenize(colleagueClauses.join(" ")).filter((stem) => !realStems.has(stem)),
  );

  const allUserProvidedStems = new Set([
    ...realStems,
    ...imageOnlyStems,
    ...ambiguousQ3Stems,
    ...q4WishOnlyStems,
    ...colleagueOnlyStems,
  ]);

  const mythFictionText = `${sourceContext.storyResult?.title || ""} ${sourceContext.storyResult?.story || ""} ${Object.values(sourceContext.storyResult?.mirror || {}).join(" ")}`;
  const mythOnlyStems = new Set(
    tokenize(mythFictionText).filter((stem) => !allUserProvidedStems.has(stem)),
  );

  const valStems = tokenize(value.toLowerCase());
  const referencesImageOnly = valStems.some((stem) => imageOnlyStems.has(stem));
  const referencesAmbiguousQ3 = valStems.some((stem) => ambiguousQ3Stems.has(stem));
  const referencesQ4WishOnly = valStems.some((stem) => q4WishOnlyStems.has(stem));
  const referencesColleagueOnly = valStems.some((stem) => colleagueOnlyStems.has(stem));
  const referencesMythOnly = valStems.some((stem) => mythOnlyStems.has(stem));

  const claimsAlreadyPracticedInRealLife =
    /(?:как\s+вы\s+(?:это\s+|уже\s+)?делаете|уже\s+испытанн[а-яё]*\s+вами\s+(?:способ|при[её]м|опыт|опор)|вы\s+уже\s+(?:умеете|применяете|делаете|освоили|владеете)|ваш[а-яё]*\s+(?:освоенн[а-яё]*\s+навык|привычк[а-яё]*\s+в\s+реальности)|в\s+вас\s+уже\s+есть\s+(?:способность|навык|опора))/iu.test(
      value,
    );

  // 1. Unknown resource in q3: must not claim the user already named a tested real-life support/skill
  if (q3Kind === "unknown_resource" && claimsAlreadyPracticedInRealLife) {
    return true;
  }

  // 2. Image in q2 or imaginative scene in q3: must not claim it is already practiced in real life without image attribution
  if (
    referencesImageOnly &&
    claimsAlreadyPracticedInRealLife &&
    !EXPLICIT_IMAGE_ORIGIN_MARKER.test(value)
  ) {
    return true;
  }

  // 3. Ambiguous q3: must not assert proven biographical habit unless framed neutrally as "в вашем ответе... можно проверить"
  if (
    referencesAmbiguousQ3 &&
    claimsAlreadyPracticedInRealLife &&
    !EXPLICIT_NEUTRAL_HYPOTHESIS_MARKER.test(value) &&
    !EXPLICIT_IMAGE_ORIGIN_MARKER.test(value)
  ) {
    return true;
  }

  // 4. Desired direction in q4: never turn wished-for direction into an already mastered ability
  if (referencesQ4WishOnly && claimsAlreadyPracticedInRealLife) {
    return true;
  }

  // 5. Events with colleagues: never attribute colleague's actions directly to the user ("вы кричите и бросаете проект")
  const mentionsColleagueActor =
    /(?:коллег[а-яё]*|начальник[а-яё]*|руководител[а-яё]*|партн[её]р[а-яё]*|клиент[а-яё]*|заказчик[а-яё]*|другой\s+человек)/iu.test(
      value,
    );
  if (referencesColleagueOnly && !mentionsColleagueActor && /(?<![а-яё])вы\s+[а-яё]+/iu.test(value)) {
    return true;
  }

  // 6. Myth-only detail: never attribute literary details from storyResult to the user's own answers
  const claimsUserToldMythFiction =
    /(?:вы\s+(?:сами\s+)?(?:рассказали|назвали|описали|упомянули)|в\s+вашем\s+ответе\s+вы\s+(?:назвали|описали|упомянули))/iu.test(
      value,
    );
  if (
    referencesMythOnly &&
    !referencesImageOnly &&
    !referencesAmbiguousQ3 &&
    claimsUserToldMythFiction &&
    !/(?:в\s+(?:тексте\s+|сюжете\s+|истории\s+)?мифа|в\s+истории|в\s+сказке)/iu.test(value)
  ) {
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
