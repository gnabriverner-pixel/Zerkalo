/** Signed evidence is opaque to the browser. Bounded local persistence preserves
 * corrections across browser restart; existing delete/reset actions clear it. */
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
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (saved?.journey === journey && Date.parse(saved.state?.expiresAt) > Date.now()) return saved.state;
    if (saved && !(Date.parse(saved.state?.expiresAt) > Date.now())) localStorage.removeItem(KEY);
  } catch { /* Missing/unavailable storage must not manufacture evidence. */ }
  return undefined;
}

export function saveTruthState(journey: string, state: any) {
  if (!state) return;
  try { localStorage.setItem(KEY, JSON.stringify({ journey, state })); } catch { /* In-memory caller retains it. */ }
}

export function clearTruthState() {
  localStorage.removeItem(KEY);
  window.dispatchEvent(new Event(TRUTH_CLEARED_EVENT));
}
