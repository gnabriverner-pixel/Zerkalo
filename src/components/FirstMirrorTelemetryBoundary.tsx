import React, { PropsWithChildren, useEffect, useRef } from 'react';
import { trackProductEvent } from '../lib/productAnalytics';

function getRequestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function getRequestMethod(input: RequestInfo | URL, init?: RequestInit): string {
  if (init?.method) return init.method.toUpperCase();
  if (typeof Request !== 'undefined' && input instanceof Request) return input.method.toUpperCase();
  return 'GET';
}

function getRequestPath(input: RequestInfo | URL): string {
  const url = getRequestUrl(input);
  try {
    return new URL(url, 'https://zerkalo.local').pathname;
  } catch {
    return url.split('?', 1)[0];
  }
}

/**
 * The telemetry boundary must only observe the exact First Mirror request.
 * It must not classify another API call merely because its URL contains the
 * same substring.
 */
export function isFirstMirrorGenerateRequest(
  input: RequestInfo | URL,
  init?: RequestInit,
): boolean {
  if (getRequestPath(input) !== '/api/generate') return false;
  if (getRequestMethod(input, init) !== 'POST') return false;
  if (typeof init?.body !== 'string') return false;

  try {
    const payload = JSON.parse(init.body) as { mode?: unknown };
    return payload.mode === 'code';
  } catch {
    return false;
  }
}

export function FirstMirrorTelemetryBoundary({ children }: PropsWithChildren) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const originalFetch = window.fetch;
    let pendingSubmitAt: number | null = null;

    const handleSubmit = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLFormElement)) return;
      pendingSubmitAt = Date.now();
    };

    const trackedFetch: typeof window.fetch = async (...args) => {
      if (!isFirstMirrorGenerateRequest(args[0], args[1])) {
        return originalFetch(...args);
      }

      const startedAt = Date.now();
      if (pendingSubmitAt !== null && startedAt - pendingSubmitAt <= 2_000) {
        trackProductEvent('first_mirror_submit');
      }
      pendingSubmitAt = null;
      trackProductEvent('first_mirror_generation_started');

      try {
        const response = await originalFetch(...args);
        let apiStatus = 'unknown';

        try {
          const data = await response.clone().json();
          if (typeof data?.status === 'string') apiStatus = data.status;
        } catch {
          // Response body shape is not required for telemetry.
        }

        trackProductEvent(
          response.ok ? 'first_mirror_generation_succeeded' : 'first_mirror_generation_failed',
          {
            duration_ms: Date.now() - startedAt,
            http_status: response.status,
            api_status: apiStatus,
          },
        );

        return response;
      } catch (error) {
        trackProductEvent('first_mirror_generation_failed', {
          duration_ms: Date.now() - startedAt,
          http_status: 0,
          api_status: 'network_error',
        });
        throw error;
      }
    };

    root?.addEventListener('submit', handleSubmit, true);
    window.fetch = trackedFetch;

    return () => {
      root?.removeEventListener('submit', handleSubmit, true);
      if (window.fetch === trackedFetch) window.fetch = originalFetch;
    };
  }, []);

  return <div ref={rootRef}>{children}</div>;
}
