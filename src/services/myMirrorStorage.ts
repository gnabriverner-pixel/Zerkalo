import { CalculationResult, FirstMirror, StoryInputs, ApiResponse, MeetingOfMirrorsResult } from '../types';

export const MY_MIRROR_STORAGE_KEY = 'zerkalo.myMirror.v1';

export interface MyMirrorSnapshotV1 {
  version: 1;
  savedAt: string;
  codeDate: string;
  codeResult: CalculationResult;
  firstMirror: FirstMirror;
  storyInputs: StoryInputs;
  storyResult: NonNullable<ApiResponse['story_result']>;
  meetingResult: MeetingOfMirrorsResult;
  meetingUserNote?: string;
}

export type SaveMyMirrorInput = Omit<MyMirrorSnapshotV1, 'version' | 'savedAt'>;

/**
 * Validates whether an unknown parsed object matches the strict MyMirrorSnapshotV1 schema.
 * Fails closed (returns false) if any required property is missing, wrong type, or invalid.
 */
export function isValidMyMirrorSnapshotV1(data: unknown): data is MyMirrorSnapshotV1 {
  if (!data || typeof data !== 'object') return false;

  const candidate = data as Record<string, unknown>;

  // 1. Version check
  if (candidate.version !== 1) return false;

  // 2. SavedAt timestamp
  if (typeof candidate.savedAt !== 'string' || candidate.savedAt.trim().length === 0) return false;

  // 3. Code date & result
  if (typeof candidate.codeDate !== 'string' || candidate.codeDate.trim().length === 0) return false;
  if (!candidate.codeResult || typeof candidate.codeResult !== 'object') return false;
  const calc = candidate.codeResult as Record<string, unknown>;
  if (typeof calc.soul !== 'number' || typeof calc.path !== 'number') return false;

  // 4. FirstMirror (Code synthesis)
  if (!candidate.firstMirror || typeof candidate.firstMirror !== 'object') return false;
  const firstMirror = candidate.firstMirror as Record<string, unknown>;
  if (typeof firstMirror.title !== 'string' || typeof firstMirror.keyInsight !== 'string') return false;

  // 5. Story inputs (4 answers)
  if (!candidate.storyInputs || typeof candidate.storyInputs !== 'object') return false;
  const inputs = candidate.storyInputs as Record<string, unknown>;
  if (
    typeof inputs.q1 !== 'string' ||
    typeof inputs.q2 !== 'string' ||
    typeof inputs.q3 !== 'string' ||
    typeof inputs.q4 !== 'string'
  ) {
    return false;
  }

  // 6. Story result (Personal Myth)
  if (!candidate.storyResult || typeof candidate.storyResult !== 'object') return false;
  const story = candidate.storyResult as Record<string, unknown>;
  if (typeof story.title !== 'string' || typeof story.story !== 'string') return false;

  // 7. Meeting result
  if (!candidate.meetingResult || typeof candidate.meetingResult !== 'object') return false;
  const meeting = candidate.meetingResult as Record<string, unknown>;
  if (
    typeof meeting.summary !== 'string' ||
    typeof meeting.confidenceNote !== 'string' ||
    !Array.isArray(meeting.parallels) ||
    !Array.isArray(meeting.divergences) ||
    typeof meeting.reflectiveQuestion !== 'string' ||
    typeof meeting.albertInsight !== 'string'
  ) {
    return false;
  }

  // 8. Optional meetingUserNote
  if (candidate.meetingUserNote !== undefined && typeof candidate.meetingUserNote !== 'string') {
    return false;
  }

  return true;
}

/**
 * Explicitly saves a completed Mirror session into browser localStorage.
 * Only allowed, sanitized fields are persisted. Secrets and provider internals are never stored.
 */
export function saveMyMirrorSnapshot(input: SaveMyMirrorInput): boolean {
  if (typeof window === 'undefined' || !window.localStorage) return false;

  try {
    const snapshot: MyMirrorSnapshotV1 = {
      version: 1,
      savedAt: new Date().toISOString(),
      codeDate: String(input.codeDate || ''),
      codeResult: input.codeResult,
      firstMirror: input.firstMirror,
      storyInputs: {
        q1: String(input.storyInputs.q1 || ''),
        q2: String(input.storyInputs.q2 || ''),
        q3: String(input.storyInputs.q3 || ''),
        q4: String(input.storyInputs.q4 || '')
      },
      storyResult: input.storyResult,
      meetingResult: input.meetingResult,
      ...(input.meetingUserNote ? { meetingUserNote: String(input.meetingUserNote) } : {})
    };

    if (!isValidMyMirrorSnapshotV1(snapshot)) {
      return false;
    }

    window.localStorage.setItem(MY_MIRROR_STORAGE_KEY, JSON.stringify(snapshot));
    return true;
  } catch (err) {
    console.error('[MyMirrorStorage] Failed to save snapshot:', err);
    return false;
  }
}

/**
 * Loads and validates the local snapshot from localStorage.
 * Fails closed (returns null) on corrupt JSON, schema mismatch, or missing fields without crashing.
 */
export function loadMyMirrorSnapshot(): MyMirrorSnapshotV1 | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;

  try {
    const raw = window.localStorage.getItem(MY_MIRROR_STORAGE_KEY);
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    if (!isValidMyMirrorSnapshotV1(parsed)) {
      return null;
    }

    return parsed;
  } catch {
    // Corrupted JSON or parsing failure -> fail closed gracefully
    return null;
  }
}

/**
 * Explicitly deletes the saved local mirror from browser localStorage.
 */
export function deleteMyMirrorSnapshot(): boolean {
  if (typeof window === 'undefined' || !window.localStorage) return false;

  try {
    window.localStorage.removeItem(MY_MIRROR_STORAGE_KEY);
    return true;
  } catch (err) {
    console.error('[MyMirrorStorage] Failed to delete snapshot:', err);
    return false;
  }
}

/**
 * Checks whether a valid V1 snapshot exists in browser localStorage.
 */
export function hasMyMirrorSnapshot(): boolean {
  return loadMyMirrorSnapshot() !== null;
}

export interface CurrentSessionPayload {
  codeDate?: string;
  codeResult?: CalculationResult | null;
  firstMirror?: FirstMirror | null;
  storyInputs?: StoryInputs | null;
  storyResult?: ApiResponse['story_result'] | null;
  meetingResult?: MeetingOfMirrorsResult | null;
  meetingUserNote?: string;
}

/**
 * Compares a loaded V1 snapshot against the currently active session payload.
 * Returns true if the snapshot represents the exact current session, false otherwise.
 */
export function isSnapshotMatchingCurrentSession(
  snapshot: MyMirrorSnapshotV1 | null,
  current: CurrentSessionPayload
): boolean {
  if (
    !snapshot ||
    !current.codeResult ||
    !current.storyResult ||
    !current.meetingResult
  ) {
    return false;
  }

  // 1. Code match
  if (current.codeDate && snapshot.codeDate !== current.codeDate) {
    return false;
  }
  if (
    snapshot.codeResult.soul !== current.codeResult.soul ||
    snapshot.codeResult.path !== current.codeResult.path ||
    snapshot.codeResult.expression !== current.codeResult.expression ||
    snapshot.codeResult.direction !== current.codeResult.direction ||
    snapshot.codeResult.result !== current.codeResult.result
  ) {
    return false;
  }

  // 2. FirstMirror match (if provided in current session)
  if (current.firstMirror) {
    if (
      snapshot.firstMirror.title !== current.firstMirror.title ||
      snapshot.firstMirror.keyInsight !== current.firstMirror.keyInsight ||
      snapshot.firstMirror.practicalStep !== current.firstMirror.practicalStep
    ) {
      return false;
    }
  }

  // 3. Story inputs match (if provided in current session)
  if (current.storyInputs) {
    if (
      snapshot.storyInputs.q1 !== current.storyInputs.q1 ||
      snapshot.storyInputs.q2 !== current.storyInputs.q2 ||
      snapshot.storyInputs.q3 !== current.storyInputs.q3 ||
      snapshot.storyInputs.q4 !== current.storyInputs.q4
    ) {
      return false;
    }
  }

  // 4. Myth match
  if (
    snapshot.storyResult.title !== current.storyResult.title ||
    snapshot.storyResult.story !== current.storyResult.story
  ) {
    return false;
  }

  // 5. Meeting result match (exact fields)
  if (
    snapshot.meetingResult.summary !== current.meetingResult.summary ||
    snapshot.meetingResult.confidenceNote !== current.meetingResult.confidenceNote ||
    snapshot.meetingResult.reflectiveQuestion !== current.meetingResult.reflectiveQuestion ||
    snapshot.meetingResult.albertInsight !== current.meetingResult.albertInsight ||
    snapshot.meetingResult.hasStrongParallels !== current.meetingResult.hasStrongParallels ||
    snapshot.meetingResult.parallels.length !== current.meetingResult.parallels.length ||
    snapshot.meetingResult.divergences.length !== current.meetingResult.divergences.length
  ) {
    return false;
  }

  // Check parallels items
  for (let i = 0; i < snapshot.meetingResult.parallels.length; i++) {
    const p1 = snapshot.meetingResult.parallels[i];
    const p2 = current.meetingResult.parallels[i];
    if (
      p1.theme !== p2.theme ||
      p1.codeAnchor !== p2.codeAnchor ||
      p1.mythAnchor !== p2.mythAnchor ||
      p1.synthesis !== p2.synthesis
    ) {
      return false;
    }
  }

  // Check divergences items
  for (let i = 0; i < snapshot.meetingResult.divergences.length; i++) {
    const d1 = snapshot.meetingResult.divergences[i];
    const d2 = current.meetingResult.divergences[i];
    if (
      d1.theme !== d2.theme ||
      d1.codeAspect !== d2.codeAspect ||
      d1.mythAspect !== d2.mythAspect ||
      d1.reflection !== d2.reflection
    ) {
      return false;
    }
  }

  // 6. User note match (normalize undefined / empty string)
  const snapshotNote = (snapshot.meetingUserNote || '').trim();
  const currentNote = (current.meetingUserNote || '').trim();
  if (snapshotNote !== currentNote) {
    return false;
  }

  return true;
}

export const TRANSIENT_DRAFT_KEY = 'zerkalo.transientDraft.v1';

export interface TransientDraftV1 {
  version: 1;
  updatedAt: string;
  mode?: 'entry' | 'alabaster' | 'myth' | 'meeting' | 'ab-test';
  codeDate?: string;
  codeResult?: CalculationResult | null;
  firstMirror?: FirstMirror | null;
  storyInputs?: StoryInputs | null;
  storyResult?: NonNullable<ApiResponse['story_result']> | null;
  meetingResult?: MeetingOfMirrorsResult | null;
  meetingUserNote?: string;
}

export function isValidTransientDraftV1(data: unknown): data is TransientDraftV1 {
  if (!data || typeof data !== 'object') return false;
  const candidate = data as Record<string, unknown>;
  if (candidate.version !== 1) return false;
  if (typeof candidate.updatedAt !== 'string') return false;
  return true;
}

export function saveTransientDraft(draft: Omit<TransientDraftV1, 'version' | 'updatedAt'>): boolean {
  if (typeof window === 'undefined' || !window.sessionStorage) return false;
  try {
    const payload: TransientDraftV1 = {
      version: 1,
      updatedAt: new Date().toISOString(),
      ...draft
    };
    window.sessionStorage.setItem(TRANSIENT_DRAFT_KEY, JSON.stringify(payload));
    return true;
  } catch (err) {
    console.warn('[MyMirrorStorage] Failed to save transient draft:', err);
    return false;
  }
}

export function loadTransientDraft(): TransientDraftV1 | null {
  if (typeof window === 'undefined' || !window.sessionStorage) return null;
  try {
    const raw = window.sessionStorage.getItem(TRANSIENT_DRAFT_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isValidTransientDraftV1(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearTransientDraft(): boolean {
  if (typeof window === 'undefined' || !window.sessionStorage) return false;
  try {
    window.sessionStorage.removeItem(TRANSIENT_DRAFT_KEY);
    return true;
  } catch {
    return false;
  }
}

export function hasMeaningfulDraft(draft: TransientDraftV1 | null): boolean {
  if (!draft) return false;
  const hasCode = !!(draft.codeResult || (draft.codeDate && draft.codeDate.trim().length > 0));
  const hasMyth = !!(draft.storyResult || (draft.storyInputs && (draft.storyInputs.q1 || draft.storyInputs.q2 || draft.storyInputs.q3 || draft.storyInputs.q4)));
  return hasCode || hasMyth;
}
