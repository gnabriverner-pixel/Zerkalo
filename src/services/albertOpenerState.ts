import {
  CalculationResult,
  StoryInputs,
  ApiResponse,
  AlbertOpenerRecordV1,
  UserConclusionStateV1,
  CodeV2Payload,
  MeetingParallel,
  MeetingDivergence,
} from '../types';
import { TRUTH_CLEARED_EVENT } from './albertTruthState';

export const ALBERT_CONVERSATION_STORAGE_KEY = 'zerkalo.albert.conversation.v1';
export const LEGACY_MEETING_PRIMARY_FLAG_KEY = 'zerkalo.flag.legacyMeetingPrimary';

export interface Message {
  id: string;
  sender: 'user' | 'albert';
  text: string;
  timestamp: Date | string;
  isOpener?: boolean;
  sourceStateVersion?: string;
}

export interface PersistedAlbertConversationV1 {
  version: 1;
  sourceStateVersion: string;
  messages: Message[];
  openerRecord?: AlbertOpenerRecordV1 | null;
  userConclusion?: UserConclusionStateV1 | null;
  crisisIntercepted?: boolean;
  updatedAt: string;
}

export interface SourceStateVersionInputs {
  codeDate?: string;
  codeResult?: CalculationResult | null;
  soulNumber?: number;
  codeReactions?: Record<string, 'confirmed' | 'rejected'> | null;
  codeV2Payload?: Partial<CodeV2Payload> | null;
  mainPattern?: string;
  storyInputs?: StoryInputs | null;
  storyResult?: NonNullable<ApiResponse['story_result']> | null;
  mythAnchors?: {
    title?: string;
    mainImage?: string;
    innerTension?: string;
    hiddenResource?: string;
    newView?: string;
    oneStep?: string;
    journalQuestion?: string;
  } | null;
  userQuestion?: string;
  userNote?: string;
  meetingSummary?: string;
  confidenceNote?: string;
  reflectiveQuestion?: string;
  albertInsight?: string;
  parallels?: MeetingParallel[] | null;
  divergences?: MeetingDivergence[] | null;
}

const inFlightOpenerRequests = new Set<string>();

/**
 * По умолчанию возвращает true (короткое сопоставление через Альберта включено).
 * Позволяет переключить на прежний маршрут через localStorage
 * ('zerkalo.flag.legacyMeetingPrimary' === '1') или query-параметр ?legacyMeeting=1.
 */
export function isShortJuxtapositionEnabled(): boolean {
  if (typeof window === 'undefined') {
    return true;
  }
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('legacyMeeting') === '1') {
      return false;
    }
    if (window.localStorage.getItem(LEGACY_MEETING_PRIMARY_FLAG_KEY) === '1') {
      return false;
    }
  } catch {
    // Storage or URL access unavailable — keep default candidate behavior enabled.
  }
  return true;
}

function fnv1a32Hex(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function normStr(val: unknown): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val.trim();
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  try {
    return JSON.stringify(val);
  } catch {
    return '';
  }
}

/**
 * Детерминированно вычисляет версию входного состояния (FNV-1a 32-bit hex)
 * по всем смысловым входам, передаваемым Альберту: дате, числам и гипотезам Кода,
 * реакции человека на Код (codeReactions), ответам, образам и шагу Личного мифа
 * (включая one_step и journal_question), вопросу, заметке и контексту Встречи.
 */
export function computeSourceStateVersion(inputs: SourceStateVersionInputs = {}): string {
  const codeDateNorm = normStr(inputs.codeDate);

  const effectiveCalc =
    inputs.codeResult ||
    inputs.codeV2Payload?.calculation?.canonical_result ||
    (inputs.codeV2Payload?.calculation?.five_numbers as any) ||
    null;

  const codeResultNorm = effectiveCalc
    ? [
        effectiveCalc.soul,
        effectiveCalc.expression,
        effectiveCalc.path,
        effectiveCalc.direction,
        effectiveCalc.result,
      ].join('-')
    : typeof inputs.soulNumber === 'number'
    ? String(inputs.soulNumber)
    : '';

  const reactions =
    inputs.codeReactions && typeof inputs.codeReactions === 'object'
      ? inputs.codeReactions
      : {};
  const codeReactionsNorm = Object.keys(reactions)
    .sort()
    .filter((k) => reactions[k] === 'confirmed' || reactions[k] === 'rejected')
    .map((k) => `${normStr(k)}:${reactions[k]}`)
    .join('|');

  const centralMotifNorm = normStr(
    inputs.mainPattern ||
      inputs.codeV2Payload?.central_motif ||
      inputs.codeV2Payload?.synthesis?.strongest_motif ||
      ''
  );

  const albertCtx = inputs.codeV2Payload?.albert_context;
  const albertCtxNorm = albertCtx
    ? [
        normStr(albertCtx.opening_statement),
        normStr(albertCtx.opening_question),
        normStr(albertCtx.strongest_hypothesis),
      ].join('|')
    : '';

  const positionsNorm = Array.isArray(inputs.codeV2Payload?.positions)
    ? inputs.codeV2Payload!.positions
        .map((p) =>
          [
            normStr(p?.position),
            normStr(p?.public_name),
            normStr(p?.role),
            normStr(p?.energy),
            normStr(p?.essence),
          ].join(':')
        )
        .join('|')
    : '';

  const storyInputsNorm = inputs.storyInputs
    ? [
        normStr(inputs.storyInputs.q1),
        normStr(inputs.storyInputs.q2),
        normStr(inputs.storyInputs.q3),
        normStr(inputs.storyInputs.q4),
      ].join('|')
    : '';

  const mythTitle = normStr(inputs.mythAnchors?.title ?? inputs.storyResult?.title ?? '');
  const mythMainImage = normStr(
    inputs.mythAnchors?.mainImage ?? inputs.storyResult?.mirror?.mainImage ?? ''
  );
  const mythInnerTension = normStr(
    inputs.mythAnchors?.innerTension ?? inputs.storyResult?.mirror?.innerTension ?? ''
  );
  const mythHiddenResource = normStr(
    inputs.mythAnchors?.hiddenResource ?? inputs.storyResult?.mirror?.hiddenResource ?? ''
  );
  const mythNewView = normStr(
    inputs.mythAnchors?.newView ?? inputs.storyResult?.mirror?.newView ?? ''
  );
  const mythOneStep = normStr(
    inputs.mythAnchors?.oneStep ?? inputs.storyResult?.one_step ?? ''
  );
  const mythJournalQuestion = normStr(
    inputs.mythAnchors?.journalQuestion ?? inputs.storyResult?.journal_question ?? ''
  );

  const storyResultNorm = [
    mythTitle,
    mythMainImage,
    mythInnerTension,
    mythHiddenResource,
    mythNewView,
    mythOneStep,
    mythJournalQuestion,
  ].join('|');

  const userQuestionNorm = normStr(inputs.userQuestion);
  const userNoteNorm = normStr(inputs.userNote);

  const parallelsNorm = Array.isArray(inputs.parallels)
    ? inputs.parallels
        .map((p) =>
          [
            normStr(p?.theme),
            normStr(p?.codeAnchor),
            normStr(p?.mythAnchor),
            normStr(p?.synthesis),
          ].join(':')
        )
        .join('|')
    : '';

  const divergencesNorm = Array.isArray(inputs.divergences)
    ? inputs.divergences
        .map((d) =>
          [
            normStr(d?.theme),
            normStr(d?.codeAspect),
            normStr(d?.mythAspect),
            normStr(d?.reflection),
          ].join(':')
        )
        .join('|')
    : '';

  const meetingNorm = [
    normStr(inputs.meetingSummary),
    normStr(inputs.confidenceNote),
    normStr(inputs.reflectiveQuestion),
    normStr(inputs.albertInsight),
    parallelsNorm,
    divergencesNorm,
  ].join('|');

  const payload = [
    codeDateNorm,
    codeResultNorm,
    codeReactionsNorm,
    centralMotifNorm,
    albertCtxNorm,
    positionsNorm,
    storyInputsNorm,
    storyResultNorm,
    userQuestionNorm,
    userNoteNorm,
    meetingNorm,
  ].join('\n');

  return `v1_${fnv1a32Hex(payload)}`;
}

function parseStoredConversation(raw: string | null): PersistedAlbertConversationV1 | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== 1 || typeof parsed.sourceStateVersion !== 'string') {
      return null;
    }
    const messages: Message[] = Array.isArray(parsed.messages)
      ? parsed.messages
          .filter(
            (m: any) =>
              m &&
              (m.sender === 'user' || m.sender === 'albert') &&
              typeof m.text === 'string' &&
              m.text.trim().length > 0
          )
          .map((m: any, idx: number) => ({
            id: typeof m.id === 'string' && m.id ? m.id : `restored_${idx}`,
            sender: m.sender,
            text: m.text,
            timestamp: m.timestamp ? new Date(m.timestamp) : new Date(),
            ...(m.isOpener ? { isOpener: true } : {}),
            ...(typeof m.sourceStateVersion === 'string' ? { sourceStateVersion: m.sourceStateVersion } : {}),
          }))
      : [];

    return {
      version: 1,
      sourceStateVersion: parsed.sourceStateVersion,
      messages,
      openerRecord: parsed.openerRecord ?? null,
      userConclusion: parsed.userConclusion ?? null,
      crisisIntercepted: Boolean(parsed.crisisIntercepted),
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function loadAlbertConversation(): PersistedAlbertConversationV1 | null {
  if (typeof window === 'undefined') return null;
  try {
    const fromSession = parseStoredConversation(
      window.sessionStorage.getItem(ALBERT_CONVERSATION_STORAGE_KEY)
    );
    if (fromSession) return fromSession;
  } catch {
    // Ignore sessionStorage errors
  }
  try {
    const fromLocal = parseStoredConversation(
      window.localStorage.getItem(ALBERT_CONVERSATION_STORAGE_KEY)
    );
    if (fromLocal) return fromLocal;
  } catch {
    // Ignore localStorage errors
  }
  return null;
}

export function saveAlbertConversation(state: PersistedAlbertConversationV1): void {
  if (typeof window === 'undefined' || !state) return;
  const payload: PersistedAlbertConversationV1 = {
    version: 1,
    sourceStateVersion: state.sourceStateVersion,
    messages: Array.isArray(state.messages) ? state.messages : [],
    openerRecord: state.openerRecord ?? null,
    userConclusion: state.userConclusion ?? null,
    crisisIntercepted: Boolean(state.crisisIntercepted),
    updatedAt: state.updatedAt || new Date().toISOString(),
  };
  const serialized = JSON.stringify(payload);
  try {
    window.sessionStorage.setItem(ALBERT_CONVERSATION_STORAGE_KEY, serialized);
  } catch {
    // Ignore sessionStorage quota/availability errors
  }
  try {
    window.localStorage.setItem(ALBERT_CONVERSATION_STORAGE_KEY, serialized);
  } catch {
    // Ignore localStorage quota/availability errors
  }
}

export function clearAlbertConversation(): void {
  inFlightOpenerRequests.clear();
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(ALBERT_CONVERSATION_STORAGE_KEY);
  } catch {
    // Ignore sessionStorage errors
  }
  try {
    window.localStorage.removeItem(ALBERT_CONVERSATION_STORAGE_KEY);
  } catch {
    // Ignore localStorage errors
  }
}

export function isOpenerStale(
  saved: PersistedAlbertConversationV1 | null,
  currentSourceStateVersionOrInputs: string | SourceStateVersionInputs
): boolean {
  if (!saved) {
    return false;
  }
  const hasMessages = Array.isArray(saved.messages) && saved.messages.length > 0;
  const hasOpener = Boolean(saved.openerRecord);
  if (!hasMessages && !hasOpener) {
    return false;
  }
  const currentVersion =
    typeof currentSourceStateVersionOrInputs === 'string'
      ? currentSourceStateVersionOrInputs
      : computeSourceStateVersion(currentSourceStateVersionOrInputs);
  if (!currentVersion) {
    return false;
  }
  const savedVersion = saved.openerRecord?.sourceStateVersion || saved.sourceStateVersion;
  if (!savedVersion) {
    return false;
  }
  return savedVersion !== currentVersion;
}

export function isOpenerRequestInFlight(sourceStateVersion: string): boolean {
  if (!sourceStateVersion) return false;
  return inFlightOpenerRequests.has(sourceStateVersion);
}

export function markOpenerRequestInFlight(sourceStateVersion: string, inFlight: boolean): void {
  if (!sourceStateVersion) return;
  if (inFlight) {
    inFlightOpenerRequests.add(sourceStateVersion);
  } else {
    inFlightOpenerRequests.delete(sourceStateVersion);
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener(TRUTH_CLEARED_EVENT, () => {
    clearAlbertConversation();
  });
}
