import {
  CalculationResult,
  StoryInputs,
  ApiResponse,
  AlbertOpenerRecordV1,
  UserConclusionStateV1,
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
  storyInputs?: StoryInputs | null;
  storyResult?: NonNullable<ApiResponse['story_result']> | null;
  userQuestion?: string;
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

/**
 * Детерминированно вычисляет версию входного состояния (FNV-1a 32-bit hex)
 * по дате, результатам Кода, ответам/результату Личного мифа и вопросу человека.
 */
export function computeSourceStateVersion(inputs: SourceStateVersionInputs = {}): string {
  const codeDateNorm = inputs.codeDate?.trim() || '';
  const codeResultNorm = inputs.codeResult
    ? [
        inputs.codeResult.soul,
        inputs.codeResult.expression,
        inputs.codeResult.path,
        inputs.codeResult.direction,
        inputs.codeResult.result,
      ].join('-')
    : '';
  const storyInputsNorm = inputs.storyInputs
    ? [
        inputs.storyInputs.q1?.trim() || '',
        inputs.storyInputs.q2?.trim() || '',
        inputs.storyInputs.q3?.trim() || '',
        inputs.storyInputs.q4?.trim() || '',
      ].join('|')
    : '';
  const storyResultNorm = inputs.storyResult
    ? [
        inputs.storyResult.title?.trim() || '',
        inputs.storyResult.mirror?.mainImage?.trim() || '',
        inputs.storyResult.mirror?.innerTension?.trim() || '',
        inputs.storyResult.mirror?.hiddenResource?.trim() || '',
        inputs.storyResult.mirror?.newView?.trim() || '',
      ].join('|')
    : '';
  const userQuestionNorm = inputs.userQuestion?.trim() || '';

  const payload = [
    codeDateNorm,
    codeResultNorm,
    storyInputsNorm,
    storyResultNorm,
    userQuestionNorm,
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
  currentSourceStateVersion: string
): boolean {
  if (!saved || !Array.isArray(saved.messages) || saved.messages.length === 0) {
    return false;
  }
  if (!saved.sourceStateVersion || !currentSourceStateVersion) {
    return false;
  }
  return saved.sourceStateVersion !== currentSourceStateVersion;
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
