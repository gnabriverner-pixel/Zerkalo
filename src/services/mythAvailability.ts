import { useEffect, useState } from 'react';

export interface MythConfig {
  writer: 'v41' | 'default';
  /** false when the server already knows that no new story can be generated (provider not configured). null = unknown. */
  generation_available: boolean | null;
  /** Public example to read, only when configured on the server (PERSONAL_MYTH_EXAMPLE_URL). */
  example_url: string | null;
}

/**
 * One cheap read of /api/personal-myth/config (no model call). Plain fetch on purpose: a config read must not open the
 * consent dialog. Any failure keeps the defaults (null).
 */
export function useMythConfig(): MythConfig | null {
  const [config, setConfig] = useState<MythConfig | null>(null);
  useEffect(() => {
    let alive = true;
    try {
      fetch('/api/personal-myth/config', { cache: 'no-store' })
        .then(r => (r.ok ? r.json() : null))
        .then(c => { if (alive && c && typeof c === 'object') setConfig({ writer: c.writer === 'v41' ? 'v41' : 'default', generation_available: typeof c.generation_available === 'boolean' ? c.generation_available : null, example_url: typeof c.example_url === 'string' ? c.example_url : null }); })
        .catch(() => { /* defaults */ });
    } catch { /* defaults */ }
    return () => { alive = false; };
  }, []);
  return config;
}
