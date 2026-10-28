export type ServerDeletionOutcome = 'deleted' | 'nothing_to_delete' | 'failed';

/**
 * Asks the server to erase what it holds for this browser session (calculation cache, linked events).
 * Local deletion never waits for this and never fails because of it.
 */
export async function requestServerDeletion(): Promise<ServerDeletionOutcome> {
  try {
    const response = await fetch('/api/delete-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: '{}',
    });
    if (response.ok) return 'deleted';
    const body = await response.json().catch(() => ({}));
    return body?.code === 'deletion_scope_not_found' || body?.code === 'invalid_token' ? 'nothing_to_delete' : 'failed';
  } catch {
    return 'failed';
  }
}
