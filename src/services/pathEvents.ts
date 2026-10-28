export type ClientPathEvent = 'date_entered' | 'code_result_shown' | 'bridge_clicked';

/** Anonymous path counter: sends the event name only. Never blocks or breaks the user path. */
export function reportPathEvent(name: ClientPathEvent): void {
  try {
    void Promise.resolve(fetch('/api/path-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
      keepalive: true,
    })).catch(() => {});
  } catch {
    // counters are best effort
  }
}
