/** Signed evidence is opaque to the browser. Session storage is the default;
 * explicit saving also preserves it across restart. Delete/reset clears both. */
const KEY = 'zerkalo.albert.truth.v1';
export const TRUTH_CLEARED_EVENT = 'zerkalo:truth-cleared';

/** Presentation may suppress an old summary conservatively; this grants no stance. */
export function hasTruthCorrections(state: any): boolean {
  return Array.isArray(state?.evidence) && state.evidence.some((item: any) => item?.receipt &&
    (item.source === 'user_correction' || item.status === 'partial' || item.status === 'rejected'));
}

export function truthJourneyKey(calc: any, story: any, meeting: any): string {
  const text = JSON.stringify([calc?.soul, calc?.path, calc?.direction, calc?.expression, calc?.result,
    story?.title, meeting?.summary]);
  let hash = 2166136261;
  for (const c of text) hash = Math.imul(hash ^ c.charCodeAt(0), 16777619);
  return (hash >>> 0).toString(16); // Scoping only, not an authentication mechanism.
}

export function loadTruthState(journey: string) {
  try {
    for (const storage of [sessionStorage, localStorage]) {
      const saved = JSON.parse(storage.getItem(KEY) || 'null');
      if (saved?.journey === journey && Date.parse(saved.state?.expiresAt) > Date.now()) return saved.state;
      if (saved && !(Date.parse(saved.state?.expiresAt) > Date.now())) storage.removeItem(KEY);
    }
  } catch { /* Missing/unavailable storage must not manufacture evidence. */ }
  return undefined;
}

export function saveTruthState(journey: string, state: any) {
  if (!state) return;
  try {
    const value = JSON.stringify({ journey, state });
    sessionStorage.setItem(KEY, value);
    const snapshot = JSON.parse(localStorage.getItem('zerkalo.myMirror.v1') || 'null');
    if (snapshot?.journeyId === journey) localStorage.setItem(KEY, value);
  } catch { /* In-memory caller retains it. */ }
}

/** Called only by the existing explicit save action. */
export function persistTruthState(journey: string) {
  const state = loadTruthState(journey);
  if (state) {
    try { localStorage.setItem(KEY, JSON.stringify({ journey, state })); } catch { /* Saving may be unavailable. */ }
  }
}

export function clearTruthState() {
  try { localStorage.removeItem(KEY); sessionStorage.removeItem(KEY); } catch { /* Still invalidate in-flight replies. */ }
  window.dispatchEvent(new Event(TRUTH_CLEARED_EVENT));
}
