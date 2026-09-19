export type QaPanelModule = typeof import('./qaPanel');

/**
 * Loads the dev-only QA surface module (`./qaPanel`).
 *
 * The branch is COMPILE-TIME: Vite replaces `import.meta.env.DEV` with `false` in a
 * production build, so the bundler eliminates the dynamic import entirely and
 * `./qaPanel` is never emitted as a public asset (no QA copy, no preset dates).
 *
 * Note: wrapping the dynamic import in a RUNTIME guard (e.g. `if (isQaMode)`) does
 * NOT achieve this — the chunk is still emitted into dist/assets and stays publicly
 * downloadable even when the UI never renders it. That is why the guard lives here,
 * in one place, as a static condition.
 */
export function loadQaPanel(): Promise<QaPanelModule | null> {
  return import.meta.env.DEV ? import('./qaPanel') : Promise.resolve(null);
}
