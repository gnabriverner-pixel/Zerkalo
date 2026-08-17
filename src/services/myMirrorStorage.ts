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

/**
 * Compares a loaded V1 snapshot against the currently active session payload.
 * Returns true if the snapshot represents the exact current session, false otherwise.
 */
export function isSnapshotMatchingCurrentSession(
  snapshot: MyMirrorSnapshotV1 | null,
  current: {
    codeDate?: string;
    codeResult?: CalculationResult | null;
    storyResult?: ApiResponse['story_result'] | null;
    meetingResult?: MeetingOfMirrorsResult | null;
  }
): boolean {
  if (!snapshot || !current.codeResult || !current.storyResult || !current.meetingResult) {
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

  // 2. Myth match
  if (
    snapshot.storyResult.title !== current.storyResult.title ||
    snapshot.storyResult.story !== current.storyResult.story
  ) {
    return false;
  }

  // 3. Meeting match
  if (
    snapshot.meetingResult.summary !== current.meetingResult.summary ||
    snapshot.meetingResult.reflectiveQuestion !== current.meetingResult.reflectiveQuestion ||
    snapshot.meetingResult.parallels.length !== current.meetingResult.parallels.length ||
    snapshot.meetingResult.divergences.length !== current.meetingResult.divergences.length
  ) {
    return false;
  }

  return true;
}
