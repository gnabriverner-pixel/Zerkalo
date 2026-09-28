import {
  AlbertInterpretationStance,
  ApiResponse,
  CodeV2Payload,
  FirstMirror,
  LaunchInterestRecordV1,
  PersonalChapterSampleV1,
} from '../types';

export const PAID_CHAPTER_SAMPLE_STORAGE_KEY = 'zerkalo.paid.chapterSample.v1';
export const PAID_LAUNCH_INTEREST_STORAGE_KEY = 'zerkalo.paid.launchInterest.v1';

export const PERSONAL_CHAPTER_PRODUCT_CODE = 'personal_chapter_single' as const;
export const PERSONAL_CHAPTER_PRODUCT_TITLE = 'Личная глава' as const;
export const PERSONAL_CHAPTER_PRICE_RUB = 4900 as const;

export const PERSONAL_CHAPTER_NINE_ITEMS: readonly string[] = [
  'Личная глава на сайте в журнально-книжной подаче: вопрос, вычисленный Код, ключевые сцены и образы Мифа, сопоставление, различения и выбранный шаг.',
  'PDF-издание для сохранения и печати.',
  '5 коротких добровольных голосовых практик в принятом голосе: перед разговором или решением; когда много задач и трудно выбрать одну опору; когда застрял между проверкой и действием; возвращение к своему выводу через несколько дней; спокойное закрытие этапа и запись изменений.',
  'Поле для собственных заметок и правок человека.',
  'Три запланированных возвращения по одному вопросу: через 1 день, 30 дней и 90 дней.',
  'Продолжение диалога с Альбертом вокруг этой главы в пределах правил пакета.',
  'Доступ и хранение веб-версии — 12 месяцев с момента покупки, с правом удалить данные раньше.',
  'До 2 обновлений редакции одной и той же главы при уточнении вопроса или заметок.',
  'Скачанные материалы остаются у человека независимо от срока веб-доступа.',
] as const;

export const PERSONAL_CHAPTER_VOICE_TOPICS: readonly string[] = [
  'Перед разговором или решением',
  'Когда много задач и трудно выбрать одну опору',
  'Когда застрял между проверкой и действием',
  'Возвращение к своему выводу через несколько дней',
  'Спокойное закрытие этапа и запись изменений',
] as const;

export const PERSONAL_CHAPTER_HONEST_LIMITATIONS: readonly string[] = [
  'Не включает безлимитный чат.',
  'Не является подпиской и не списывает деньги повторно.',
  'Не включает выпуск новой главы под любую следующую жизненную ситуацию (допускаются до 2 обновлений редакции этой же главы).',
  'Не обещает «вечного облака»: срок веб-доступа и хранения на сайте — 12 месяцев, при этом скачанный PDF и материалы остаются у вас навсегда.',
] as const;

export const PERSONAL_CHAPTER_VOICE_PREVIEW = {
  practiceNumber: 'Практика 3 из 5',
  title: 'Когда застрял между проверкой и действием',
  durationLabel: '1 мин 20 сек',
  toneLabel: 'Спокойный взрослый голос · Без гипноза, эзотерики и фоновых внушений',
  transcript: [
    'Остановитесь на полминуты. Не нужно специально настраиваться или менять дыхание.',
    'Посмотрите на задачу, которую вы сегодня снова отложили на «ещё подумать». Разделите два вопроса: вам действительно не хватает одного конкретного факта — или факт уже известен, но неприятно называть решение вслух?',
    'Если не хватает одного проверяемого факта — назовите, у кого и когда вы его уточните. Если факты уже на столе — выберите самый малый обратимый шаг, который можно сделать до вечера без идеальной подготовки.',
    'Запишите одну короткую фразу в поле своей главы: что именно вы проверите в реальности до завтрашнего дня.',
  ],
} as const;

export interface BuildPersonalChapterSampleInput {
  sourceStateVersion: string;
  userQuestion: string;
  stance: AlbertInterpretationStance;
  systemHypothesis: string;
  userOwnPhrase: string;
  chosenStepOrQuestion?: string;
  codeV2Payload?: CodeV2Payload | null;
  firstMirror?: FirstMirror | null;
  storyResult?: NonNullable<ApiResponse['story_result']> | null;
  existingSample?: PersonalChapterSampleV1 | null;
}

const DEFAULT_CURRENT_QUESTION = 'Вопрос для текущего этапа наблюдения';
const DEFAULT_EDITABLE_USER_PHRASE =
  'Здесь можно записать главный вывод своими словами — так, как вы сами видите свой вопрос сейчас.';
const REJECTED_FALLBACK_USER_PHRASE =
  'Формулировка системы мне не подошла. Здесь я фиксирую свой собственный взгляд на ситуацию своими словами.';
const DEFAULT_CHOSEN_STEP =
  'В ближайшие дни заметить один момент, где привычная реакция включается автоматически, и записать, какой выбор был доступен на самом деле.';
const DEFAULT_SUBSEQUENT_NOTE_PROMPT =
  'Место для последующей записи (через несколько дней после наблюдения в реальной ситуации)';

const MARIANNA_FORBIDDEN_PATTERNS = [
  /марианн/i,
  /marianna/i,
  /1987-09-24/,
  /24\.09\.1987/,
];

const TECHNICAL_FIELD_NAME_PATTERNS = [
  /\bcodeV2Payload\b/gi,
  /\bfirstMirror\b/gi,
  /\bstoryResult\b/gi,
  /\bstrongest_hypothesis\b/gi,
  /\bheadline_mechanism\b/gi,
  /\bcompound_route\b/gi,
  /\bcanonical_result\b/gi,
  /\bsourceStateVersion\b/gi,
];

export function normalizeStatementText(text: string): string {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function stripForbiddenMariannaContent(text: string): string {
  let cleaned = String(text || '');
  for (const pattern of MARIANNA_FORBIDDEN_PATTERNS) {
    if (pattern.test(cleaned)) {
      return '';
    }
  }
  for (const techPattern of TECHNICAL_FIELD_NAME_PATTERNS) {
    cleaned = cleaned.replace(techPattern, '');
  }
  return normalizeStatementText(cleaned);
}

export function containsRejectedStatement(
  candidateText: string,
  rejectedStatements: readonly string[]
): boolean {
  const normalizedCandidate = normalizeStatementText(candidateText).toLowerCase();
  if (!normalizedCandidate) return false;

  for (const rawRejected of rejectedStatements) {
    const normalizedRejected = normalizeStatementText(rawRejected).toLowerCase();
    if (!normalizedRejected) continue;
    if (normalizedCandidate === normalizedRejected) {
      return true;
    }
    if (normalizedRejected.length >= 5 && normalizedCandidate.includes(normalizedRejected)) {
      return true;
    }
    if (normalizedCandidate.length >= 12 && normalizedRejected.includes(normalizedCandidate)) {
      return true;
    }
  }
  return false;
}

export function deduplicateStatements(items: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of items) {
    const cleaned = stripForbiddenMariannaContent(raw);
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(cleaned);
    }
  }
  return result;
}

function generateSampleId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `pcs_${crypto.randomUUID()}`;
  }
  return `pcs_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function buildUsefulDistinctions(
  input: BuildPersonalChapterSampleInput,
  rejectedStatements: string[],
  resolvedUserPhrase: string
): string[] {
  const candidates: string[] = [];
  const rawUserPhrase = stripForbiddenMariannaContent(input.userOwnPhrase);

  // Rule A4: Human edit or rejection takes absolute priority
  if ((input.stance === 'edited' || rawUserPhrase.length > 0) && rawUserPhrase && !containsRejectedStatement(rawUserPhrase, rejectedStatements)) {
    candidates.push(
      `Опора на собственную формулировку: «${rawUserPhrase}» — важнее любой готовой схемы удерживать то различение, которое вы сами видите в реальной ситуации.`
    );
  } else if (input.stance === 'rejected') {
    candidates.push(
      'Отказ от неподходящей гипотезы уже проясняет границу: опора строится не на внешней трактовке, а на том, где именно в вашем вопросе сейчас возникает реальная заминка.'
    );
  }

  // System hypothesis is only eligible if stance !== 'rejected' and not in rejectedStatements
  const cleanHypothesis = stripForbiddenMariannaContent(input.systemHypothesis);
  if (
    input.stance !== 'rejected' &&
    cleanHypothesis &&
    !containsRejectedStatement(cleanHypothesis, rejectedStatements)
  ) {
    candidates.push(cleanHypothesis);
  }

  // Extract from CodeV2Payload if available
  if (input.codeV2Payload) {
    const motif = stripForbiddenMariannaContent(
      input.codeV2Payload.synthesis?.strongest_motif || input.codeV2Payload.central_motif || ''
    );
    if (motif && !containsRejectedStatement(motif, rejectedStatements)) {
      candidates.push(motif);
    }
    const firstInteraction = input.codeV2Payload.interactions?.[0];
    if (firstInteraction?.meaning) {
      const meaning = stripForbiddenMariannaContent(firstInteraction.meaning);
      if (meaning && !containsRejectedStatement(meaning, rejectedStatements)) {
        candidates.push(meaning);
      }
    }
  }

  // Extract from FirstMirror if available
  if (input.firstMirror?.keyInsight) {
    const insight = stripForbiddenMariannaContent(input.firstMirror.keyInsight);
    if (insight && !containsRejectedStatement(insight, rejectedStatements)) {
      candidates.push(insight);
    }
  }

  // Extract from StoryResult if available
  if (input.storyResult?.mirror?.innerTension) {
    const tension = stripForbiddenMariannaContent(input.storyResult.mirror.innerTension);
    if (tension && !containsRejectedStatement(tension, rejectedStatements)) {
      candidates.push(`Различение из образной сцены: ${tension}`);
    }
  }

  // Existing sample distinctions that are still valid and not rejected
  if (input.existingSample?.usefulDistinctions) {
    for (const prev of input.existingSample.usefulDistinctions) {
      const cleanedPrev = stripForbiddenMariannaContent(prev);
      if (cleanedPrev && !containsRejectedStatement(cleanedPrev, rejectedStatements)) {
        candidates.push(cleanedPrev);
      }
    }
  }

  // Calm human fallbacks (guaranteed never to match rejected machine hypotheses)
  const fallbackDistinctions = [
    'Различать шаг, который можно спокойно проверить в ближайшем разговоре или деле, и попытку заранее просчитать все последствия.',
    'Различать внутреннее согласие на конкретное действие и движение по инерции прежних обязательств.',
  ];

  for (const fb of fallbackDistinctions) {
    if (!containsRejectedStatement(fb, rejectedStatements)) {
      candidates.push(fb);
    }
  }

  // Deduplicate and filter strictly against rejectedStatements
  const filtered = deduplicateStatements(candidates).filter(
    (item) => !containsRejectedStatement(item, rejectedStatements)
  );

  // Always return 1–2 concrete distinctions
  if (filtered.length === 0) {
    return [
      `Собственный ориентир наблюдения: ${
        !containsRejectedStatement(resolvedUserPhrase, rejectedStatements)
          ? resolvedUserPhrase
          : 'выбрать один проверяемый шаг в текущей ситуации.'
      }`,
    ];
  }

  return filtered.slice(0, 2);
}

function buildMythImageSection(
  storyResult?: NonNullable<ApiResponse['story_result']> | null,
  existingSample?: PersonalChapterSampleV1 | null,
  rejectedStatements: readonly string[] = []
): NonNullable<PersonalChapterSampleV1['mythImage']> {
  if (storyResult && storyResult.title && storyResult.mirror?.mainImage) {
    const cleanTitle = stripForbiddenMariannaContent(storyResult.title) || 'Сцена из Личного мифа';
    const mainImg = stripForbiddenMariannaContent(storyResult.mirror.mainImage);
    const newView = stripForbiddenMariannaContent(storyResult.mirror.newView || '');
    const combinedText =
      newView && !containsRejectedStatement(newView, rejectedStatements)
        ? `${mainImg} — Взгляд со стороны: ${newView}`
        : mainImg;

    if (combinedText && !containsRejectedStatement(combinedText, rejectedStatements)) {
      return {
        explicitLabel: 'Образ из Личного мифа (художественная сцена, не факт биографии)',
        title: cleanTitle,
        imageText: combinedText,
      };
    }
  }

  if (
    existingSample?.mythImage &&
    existingSample.mythImage.title !== 'Личный миф ещё не создан' &&
    !containsRejectedStatement(existingSample.mythImage.imageText, rejectedStatements)
  ) {
    return {
      explicitLabel: 'Образ из Личного мифа (художественная сцена, не факт биографии)',
      title: stripForbiddenMariannaContent(existingSample.mythImage.title) || 'Сцена из Личного мифа',
      imageText: stripForbiddenMariannaContent(existingSample.mythImage.imageText),
    };
  }

  return {
    explicitLabel: 'Образ из Личного мифа (художественная сцена)',
    title: 'Личный миф ещё не создан',
    imageText:
      'Вы перешли к разбору сразу после Цифрового Кода. Образ из мифа добавится, если вы захотите пройти вторую линзу.',
  };
}

export function buildPersonalChapterSample(
  input: BuildPersonalChapterSampleInput
): PersonalChapterSampleV1 {
  const nowIso = new Date().toISOString();
  const existing = input.existingSample || null;

  // 1. Collect rejected statements (never losing previously rejected statements)
  const rawRejectedList: string[] = [
    ...(existing?.rejectedStatements || []),
  ];
  const cleanSystemHypothesis = stripForbiddenMariannaContent(input.systemHypothesis);
  if (input.stance === 'rejected' && cleanSystemHypothesis) {
    rawRejectedList.push(cleanSystemHypothesis);
  }
  const rejectedStatements = deduplicateStatements(rawRejectedList);

  // 2. Current question (Part 1)
  const rawQuestion =
    stripForbiddenMariannaContent(input.userQuestion) ||
    stripForbiddenMariannaContent(existing?.currentQuestion || '');
  const currentQuestion =
    rawQuestion && !containsRejectedStatement(rawQuestion, rejectedStatements)
      ? rawQuestion
      : DEFAULT_CURRENT_QUESTION;

  // 3. User's own phrase (Part 2) — never machine hypothesis if rejected, never containing rejected statements
  const candidateOwnPhrase =
    stripForbiddenMariannaContent(input.userOwnPhrase) ||
    stripForbiddenMariannaContent(existing?.userOwnPhrase || '');

  let userOwnPhrase: string;
  if (candidateOwnPhrase && !containsRejectedStatement(candidateOwnPhrase, rejectedStatements)) {
    userOwnPhrase = candidateOwnPhrase;
  } else if (input.stance === 'rejected') {
    userOwnPhrase = REJECTED_FALLBACK_USER_PHRASE;
  } else {
    userOwnPhrase = DEFAULT_EDITABLE_USER_PHRASE;
  }

  // 4. Useful distinctions (Part 3, 1–2 items, cleaned of rejectedStatements)
  const usefulDistinctions = buildUsefulDistinctions(
    input,
    rejectedStatements,
    userOwnPhrase
  );

  // 5. Explicitly labeled Myth Image (Part 4)
  const mythImage = buildMythImageSection(
    input.storyResult,
    existing,
    rejectedStatements
  );

  // 6. Chosen step or question for observation (Part 5)
  const candidateSteps = [
    stripForbiddenMariannaContent(input.chosenStepOrQuestion || ''),
    stripForbiddenMariannaContent(existing?.chosenStepOrQuestion || ''),
    stripForbiddenMariannaContent(input.storyResult?.one_step || ''),
    stripForbiddenMariannaContent(input.storyResult?.journal_question || ''),
    stripForbiddenMariannaContent(input.firstMirror?.practicalStep || ''),
    DEFAULT_CHOSEN_STEP,
  ];
  const chosenStepOrQuestion =
    candidateSteps.find(
      (step) => step.length > 0 && !containsRejectedStatement(step, rejectedStatements)
    ) || DEFAULT_CHOSEN_STEP;

  // 7. Subsequent note space (Part 6)
  const existingNote = stripForbiddenMariannaContent(
    existing?.subsequentNoteSpace?.userNote || ''
  );
  const safeUserNote =
    existingNote && !containsRejectedStatement(existingNote, rejectedStatements)
      ? existingNote
      : '';

  return {
    schemaVersion: 'personal_chapter_sample.v1',
    sampleId: existing?.sampleId || generateSampleId(),
    sampleStatusLabel: 'Персональный образец будущей главы',
    isPaidProductComplete: false,
    sourceStateVersion: String(input.sourceStateVersion || existing?.sourceStateVersion || 'v1').trim(),
    createdAt: existing?.createdAt || nowIso,
    updatedAt: nowIso,
    stance: input.stance,
    currentQuestion,
    userOwnPhrase,
    usefulDistinctions,
    mythImage,
    chosenStepOrQuestion,
    subsequentNoteSpace: {
      prompt: DEFAULT_SUBSEQUENT_NOTE_PROMPT,
      userNote: safeUserNote,
    },
    rejectedStatements,
  };
}

export interface UpdatePersonalChapterSamplePatch {
  stance?: AlbertInterpretationStance;
  currentQuestion?: string;
  userOwnPhrase?: string;
  usefulDistinctions?: string[];
  chosenStepOrQuestion?: string;
  userNote?: string;
  newlyRejectedStatement?: string;
  sourceStateVersion?: string;
}

export function updatePersonalChapterSample(
  sample: PersonalChapterSampleV1,
  patch: UpdatePersonalChapterSamplePatch
): PersonalChapterSampleV1 {
  const nextStance = patch.stance ?? sample.stance;
  const rawRejected = [...(sample.rejectedStatements || [])];
  if (patch.newlyRejectedStatement && patch.newlyRejectedStatement.trim()) {
    rawRejected.push(patch.newlyRejectedStatement.trim());
  }
  const rejectedStatements = deduplicateStatements(rawRejected);

  const rawQuestion =
    patch.currentQuestion !== undefined
      ? stripForbiddenMariannaContent(patch.currentQuestion)
      : sample.currentQuestion;
  const currentQuestion =
    rawQuestion && !containsRejectedStatement(rawQuestion, rejectedStatements)
      ? rawQuestion
      : DEFAULT_CURRENT_QUESTION;

  let rawOwnPhrase =
    patch.userOwnPhrase !== undefined
      ? stripForbiddenMariannaContent(patch.userOwnPhrase)
      : sample.userOwnPhrase;
  if (!rawOwnPhrase || containsRejectedStatement(rawOwnPhrase, rejectedStatements)) {
    rawOwnPhrase =
      nextStance === 'rejected'
        ? REJECTED_FALLBACK_USER_PHRASE
        : DEFAULT_EDITABLE_USER_PHRASE;
  }

  let nextDistinctions = (patch.usefulDistinctions ?? sample.usefulDistinctions)
    .map((d) => stripForbiddenMariannaContent(d))
    .filter((d) => d.length > 0 && !containsRejectedStatement(d, rejectedStatements));

  if (
    patch.userOwnPhrase !== undefined &&
    rawOwnPhrase !== DEFAULT_EDITABLE_USER_PHRASE &&
    rawOwnPhrase !== REJECTED_FALLBACK_USER_PHRASE &&
    (nextStance === 'edited' || nextStance === 'rejected')
  ) {
    const humanDistinction = `Опора на собственную формулировку: «${rawOwnPhrase}» — важнее внешней схемы удерживать то различение, которое проверяется в вашей реальной ситуации.`;
    if (!containsRejectedStatement(humanDistinction, rejectedStatements)) {
      nextDistinctions = [humanDistinction, ...nextDistinctions];
    }
  }

  nextDistinctions = deduplicateStatements(nextDistinctions).slice(0, 2);
  if (nextDistinctions.length === 0) {
    nextDistinctions = [
      'Различать шаг, который можно спокойно проверить в ближайшем разговоре или деле, и попытку заранее просчитать все последствия.',
    ];
  }

  const rawStep =
    patch.chosenStepOrQuestion !== undefined
      ? stripForbiddenMariannaContent(patch.chosenStepOrQuestion)
      : sample.chosenStepOrQuestion;
  const chosenStepOrQuestion =
    rawStep && !containsRejectedStatement(rawStep, rejectedStatements)
      ? rawStep
      : DEFAULT_CHOSEN_STEP;

  const rawNote =
    patch.userNote !== undefined
      ? stripForbiddenMariannaContent(patch.userNote)
      : sample.subsequentNoteSpace.userNote;
  const userNote =
    rawNote && !containsRejectedStatement(rawNote, rejectedStatements) ? rawNote : '';

  return {
    ...sample,
    stance: nextStance,
    sourceStateVersion: patch.sourceStateVersion ?? sample.sourceStateVersion,
    updatedAt: new Date().toISOString(),
    currentQuestion,
    userOwnPhrase: rawOwnPhrase,
    usefulDistinctions: nextDistinctions,
    chosenStepOrQuestion,
    subsequentNoteSpace: {
      prompt: sample.subsequentNoteSpace?.prompt || DEFAULT_SUBSEQUENT_NOTE_PROMPT,
      userNote,
    },
    rejectedStatements,
  };
}

export function isValidPersonalChapterSampleV1(
  data: unknown
): data is PersonalChapterSampleV1 {
  if (!data || typeof data !== 'object') return false;
  const c = data as Record<string, unknown>;
  if (c.schemaVersion !== 'personal_chapter_sample.v1') return false;
  if (c.sampleStatusLabel !== 'Персональный образец будущей главы') return false;
  if (c.isPaidProductComplete !== false) return false;
  if (typeof c.sampleId !== 'string' || !c.sampleId.trim()) return false;
  if (typeof c.sourceStateVersion !== 'string' || !c.sourceStateVersion.trim()) return false;
  if (typeof c.currentQuestion !== 'string' || !c.currentQuestion.trim()) return false;
  if (typeof c.userOwnPhrase !== 'string' || !c.userOwnPhrase.trim()) return false;
  if (!Array.isArray(c.usefulDistinctions) || c.usefulDistinctions.length === 0) return false;
  if (!c.mythImage || typeof c.mythImage !== 'object') return false;
  const mythImg = c.mythImage as Record<string, unknown>;
  if (
    typeof mythImg.explicitLabel !== 'string' ||
    typeof mythImg.title !== 'string' ||
    typeof mythImg.imageText !== 'string'
  ) {
    return false;
  }
  if (typeof c.chosenStepOrQuestion !== 'string' || !c.chosenStepOrQuestion.trim()) return false;
  if (!c.subsequentNoteSpace || typeof c.subsequentNoteSpace !== 'object') return false;
  const noteSpace = c.subsequentNoteSpace as Record<string, unknown>;
  if (typeof noteSpace.prompt !== 'string' || typeof noteSpace.userNote !== 'string') return false;
  if (!Array.isArray(c.rejectedStatements)) return false;

  const rejected = c.rejectedStatements.filter((r): r is string => typeof r === 'string');
  if (containsRejectedStatement(c.userOwnPhrase, rejected)) return false;
  if (containsRejectedStatement(c.chosenStepOrQuestion, rejected)) return false;
  for (const dist of c.usefulDistinctions) {
    if (typeof dist !== 'string' || containsRejectedStatement(dist, rejected)) {
      return false;
    }
  }

  return true;
}

export function savePersonalChapterSample(sample: PersonalChapterSampleV1): boolean {
  if (typeof window === 'undefined' || !window.localStorage) return false;
  try {
    if (!isValidPersonalChapterSampleV1(sample)) return false;
    window.localStorage.setItem(PAID_CHAPTER_SAMPLE_STORAGE_KEY, JSON.stringify(sample));
    return true;
  } catch (err) {
    console.warn('[PersonalChapterSample] Failed to save chapter sample:', err);
    return false;
  }
}

export function loadPersonalChapterSample(): PersonalChapterSampleV1 | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(PAID_CHAPTER_SAMPLE_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isValidPersonalChapterSampleV1(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function deletePersonalChapterSample(): boolean {
  if (typeof window === 'undefined' || !window.localStorage) return false;
  try {
    window.localStorage.removeItem(PAID_CHAPTER_SAMPLE_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

export function isValidLaunchInterestRecordV1(
  data: unknown
): data is LaunchInterestRecordV1 {
  if (!data || typeof data !== 'object') return false;
  const c = data as Record<string, unknown>;
  return (
    c.schemaVersion === 'launch_interest.v1' &&
    typeof c.interestId === 'string' &&
    c.interestId.trim().length > 0 &&
    c.productCode === 'personal_chapter_single' &&
    c.productTitle === 'Личная глава' &&
    c.displayedPriceRub === 4900 &&
    c.actionKind === 'launch_interest_only' &&
    c.isPaymentOrPreorder === false &&
    typeof c.sampleId === 'string' &&
    c.sampleId.trim().length > 0 &&
    (c.preferredChannel === 'email' ||
      c.preferredChannel === 'telegram' ||
      c.preferredChannel === 'on_site_note') &&
    typeof c.createdAt === 'string'
  );
}

export function saveLaunchInterestRecord(record: LaunchInterestRecordV1): boolean {
  if (typeof window === 'undefined' || !window.localStorage) return false;
  try {
    if (!isValidLaunchInterestRecordV1(record)) return false;
    window.localStorage.setItem(PAID_LAUNCH_INTEREST_STORAGE_KEY, JSON.stringify(record));
    return true;
  } catch (err) {
    console.warn('[PersonalChapterSample] Failed to save launch interest record:', err);
    return false;
  }
}

export function loadLaunchInterestRecord(): LaunchInterestRecordV1 | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(PAID_LAUNCH_INTEREST_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isValidLaunchInterestRecordV1(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function deleteLaunchInterestRecord(): boolean {
  if (typeof window === 'undefined' || !window.localStorage) return false;
  try {
    window.localStorage.removeItem(PAID_LAUNCH_INTEREST_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

function escapeHtml(raw: string): string {
  return String(raw || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface RenderedSampleSection {
  number: number;
  id: string;
  heading: string;
  sublabel?: string;
  lines: string[];
}

export function extractPersonalChapterSampleSections(
  sample: PersonalChapterSampleV1
): RenderedSampleSection[] {
  const rejected = sample.rejectedStatements || [];
  const safeDistinctions = sample.usefulDistinctions.filter(
    (d) => !containsRejectedStatement(d, rejected)
  );
  const safeOwnPhrase = !containsRejectedStatement(sample.userOwnPhrase, rejected)
    ? sample.userOwnPhrase
    : REJECTED_FALLBACK_USER_PHRASE;
  const safeStep = !containsRejectedStatement(sample.chosenStepOrQuestion, rejected)
    ? sample.chosenStepOrQuestion
    : DEFAULT_CHOSEN_STEP;

  const myth = sample.mythImage || {
    explicitLabel: 'Образ из Личного мифа (художественная сцена)',
    title: 'Личный миф ещё не создан',
    imageText:
      'Вы перешли к разбору сразу после Цифрового Кода. Образ из мифа добавится, если вы захотите пройти вторую линзу.',
  };

  return [
    {
      number: 1,
      id: 'current-question',
      heading: '1. Текущий вопрос',
      lines: [sample.currentQuestion],
    },
    {
      number: 2,
      id: 'user-own-phrase',
      heading: '2. Собственная фраза человека',
      sublabel:
        sample.stance === 'rejected'
          ? 'Сформулировано после отказа от неподходящей гипотезы системы'
          : sample.stance === 'edited'
          ? 'Уточнено своими словами (приоритет над автоматической гипотезой)'
          : 'Личная фиксация вывода',
      lines: [safeOwnPhrase],
    },
    {
      number: 3,
      id: 'useful-distinctions',
      heading: '3. Полезные различения (1–2)',
      lines:
        safeDistinctions.length > 0
          ? safeDistinctions
          : [
              'Различать шаг, который можно спокойно проверить в ближайшем разговоре или деле, и попытку заранее просчитать все последствия.',
            ],
    },
    {
      number: 4,
      id: 'myth-image',
      heading: '4. Образ из Личного мифа',
      sublabel: myth.explicitLabel,
      lines: [`${myth.title}: ${myth.imageText}`],
    },
    {
      number: 5,
      id: 'chosen-step',
      heading: '5. Выбранный шаг или вопрос для наблюдения',
      lines: [safeStep],
    },
    {
      number: 6,
      id: 'subsequent-note-space',
      heading: '6. Место для последующей записи',
      sublabel: sample.subsequentNoteSpace.prompt,
      lines: [
        sample.subsequentNoteSpace.userNote.trim()
          ? sample.subsequentNoteSpace.userNote.trim()
          : 'Поле оставлено свободным для записи после проверки выбранного шага в жизни.',
      ],
    },
  ];
}

export function serializePersonalChapterSampleText(
  sample: PersonalChapterSampleV1
): string {
  const sections = extractPersonalChapterSampleSections(sample);
  const header = [
    `СТАТУС ДОКУМЕНТА: ${sample.sampleStatusLabel} (не финальный платный пакет)`,
    `Код образца: ${sample.sampleId}`,
    `Версия состояния источника: ${sample.sourceStateVersion}`,
    `Отношение к гипотезе: ${
      sample.stance === 'confirmed'
        ? 'Похоже'
        : sample.stance === 'edited'
        ? 'Уточнено своими словами'
        : sample.stance === 'rejected'
        ? 'Не подходит (отвергнутые формулировки исключены)'
        : 'На проверке'
    }`,
    '---',
  ];

  const body = sections.map((sec) => {
    const sub = sec.sublabel ? `\n[${sec.sublabel}]` : '';
    const content = sec.lines.map((l) => `• ${l}`).join('\n');
    return `${sec.heading}${sub}\n${content}`;
  });

  return [...header, ...body].join('\n\n');
}

export function renderPersonalChapterSampleHtml(
  sample: PersonalChapterSampleV1
): string {
  const sections = extractPersonalChapterSampleSections(sample);

  const sectionsHtml = sections
    .map((sec) => {
      const subHtml = sec.sublabel
        ? `<div class="section-sublabel">${escapeHtml(sec.sublabel)}</div>`
        : '';
      const linesHtml = sec.lines
        .map((line) => `<p class="section-paragraph">${escapeHtml(line)}</p>`)
        .join('\n');
      return `
      <section class="chapter-section" data-section-id="${escapeHtml(sec.id)}">
        <h2 class="section-heading">${escapeHtml(sec.heading)}</h2>
        ${subHtml}
        <div class="section-body">
          ${linesHtml}
        </div>
      </section>`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(sample.sampleStatusLabel)} — Зеркало Себя</title>
  <style>
    @page {
      size: A4;
      margin: 22mm 20mm;
    }
    body {
      margin: 0;
      padding: 32px 24px;
      background-color: #FCFAF6;
      color: #1C1917;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.65;
    }
    .sheet {
      max-width: 720px;
      margin: 0 auto;
      background: #FFFFFF;
      border: 1px solid #E8DFC8;
      padding: 40px 44px;
      box-sizing: border-box;
    }
    .status-badge {
      display: inline-block;
      font-size: 11px;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: #8C6D32;
      background: #F9F4E8;
      border: 1px solid #E2D3B3;
      padding: 6px 12px;
      margin-bottom: 16px;
    }
    .doc-title {
      font-family: 'Playfair Display', Georgia, 'Times New Roman', serif;
      font-size: 28px;
      font-weight: 500;
      margin: 0 0 8px 0;
      color: #181615;
    }
    .doc-meta {
      font-size: 12px;
      color: #6B665E;
      border-bottom: 1px solid #EAE3D2;
      padding-bottom: 20px;
      margin-bottom: 28px;
    }
    .chapter-section {
      margin-bottom: 24px;
      padding-bottom: 20px;
      border-bottom: 1px solid #F1ECE1;
    }
    .chapter-section:last-of-type {
      border-bottom: none;
      margin-bottom: 0;
      padding-bottom: 0;
    }
    .section-heading {
      font-family: 'Playfair Display', Georgia, 'Times New Roman', serif;
      font-size: 18px;
      font-weight: 600;
      color: #292524;
      margin: 0 0 6px 0;
    }
    .section-sublabel {
      font-size: 12px;
      color: #8C6D32;
      margin-bottom: 8px;
      font-style: italic;
    }
    .section-paragraph {
      margin: 0 0 8px 0;
      font-size: 15px;
      color: #262320;
    }
    .doc-footer {
      margin-top: 32px;
      padding-top: 16px;
      border-top: 1px solid #E8DFC8;
      font-size: 12px;
      color: #78716C;
    }
  </style>
</head>
<body>
  <article class="sheet" data-sample-id="${escapeHtml(sample.sampleId)}" data-source-state-version="${escapeHtml(sample.sourceStateVersion)}">
    <div class="status-badge">Персональный образец будущей главы — не финальный платный пакет</div>
    <h1 class="doc-title">${escapeHtml(sample.sampleStatusLabel)}</h1>
    <div class="doc-meta">
      Источник данных: единая модель PersonalChapterSampleV1 • Версия состояния: ${escapeHtml(sample.sourceStateVersion)}
    </div>
    ${sectionsHtml}
    <footer class="doc-footer">
      Документ собран автоматически из вашего текущего разбора в «Зеркале Себя». Любые отвергнутые вами формулировки исключены из текста и выгрузки.
    </footer>
  </article>
</body>
</html>`;
}
