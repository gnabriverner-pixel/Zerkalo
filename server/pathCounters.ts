import fs from 'node:fs';
import path from 'node:path';

/**
 * Anonymous path counters: event name, time, test flag. Nothing else - no birth date, answers, account id or IP.
 * Append-only JSON lines; the report script only reads.
 */
export const PATH_EVENTS = [
  'date_entered', 'code_result_shown', 'bridge_clicked', 'myth_started', 'myth_ready', 'checkout_started', 'paid',
] as const;
export type PathEventName = typeof PATH_EVENTS[number];
/** Events the browser may report; the rest are recorded by the server where they actually happen. */
export const CLIENT_PATH_EVENTS: readonly PathEventName[] = ['date_entered', 'code_result_shown', 'bridge_clicked'];
export const PATH_COUNTERS_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

export interface PathCounterRow { e: PathEventName; t: number; test: 0 | 1 }

export function pathCountersFile(): string {
  return process.env.PATH_COUNTERS_FILE || path.join(process.cwd(), 'data', 'events', 'path_counters.jsonl');
}

export function isPathEvent(name: unknown): name is PathEventName {
  return typeof name === 'string' && (PATH_EVENTS as readonly string[]).includes(name);
}

/** Never throws: counters must not break the user path. */
export function recordPathEvent(name: PathEventName, test = false, now = Date.now()): boolean {
  try {
    if (!isPathEvent(name)) return false;
    const file = pathCountersFile();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const row: PathCounterRow = { e: name, t: now, test: test ? 1 : 0 };
    fs.appendFileSync(file, JSON.stringify(row) + '\n', 'utf8');
    return true;
  } catch {
    return false;
  }
}

export function readPathCounters(file = pathCountersFile()): PathCounterRow[] {
  let text = '';
  try { text = fs.readFileSync(file, 'utf8'); } catch { return []; }
  const rows: PathCounterRow[] = [];
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    try {
      const r = JSON.parse(line);
      if (isPathEvent(r?.e) && Number.isFinite(r?.t)) rows.push({ e: r.e, t: r.t, test: r.test ? 1 : 0 });
    } catch { /* skip a damaged line */ }
  }
  return rows;
}

/** Removes rows older than the retention period (90 days, as the policy states). */
export function prunePathCounters(now = Date.now(), file = pathCountersFile()): number {
  const rows = readPathCounters(file);
  const kept = rows.filter(r => now - r.t <= PATH_COUNTERS_RETENTION_MS);
  if (kept.length === rows.length) return 0;
  try {
    fs.writeFileSync(file, kept.map(r => JSON.stringify(r)).join('\n') + (kept.length ? '\n' : ''), 'utf8');
  } catch { return 0; }
  return rows.length - kept.length;
}

/** Counts per Moscow-time day and event; `includeTest` false drops test rows. */
export function dailyCounts(rows: PathCounterRow[], includeTest = false, timeZone = 'Europe/Moscow') {
  const fmt = new Intl.DateTimeFormat('sv-SE', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
  const days = new Map<string, Record<PathEventName, number>>();
  for (const r of rows) {
    if (!includeTest && r.test) continue;
    const day = fmt.format(new Date(r.t));
    if (!days.has(day)) days.set(day, Object.fromEntries(PATH_EVENTS.map(n => [n, 0])) as Record<PathEventName, number>);
    days.get(day)![r.e] += 1;
  }
  return [...days.entries()].sort(([a], [b]) => a.localeCompare(b));
}
