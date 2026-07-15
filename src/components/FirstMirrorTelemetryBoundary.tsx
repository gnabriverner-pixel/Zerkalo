import React, { PropsWithChildren, useEffect, useRef } from 'react';
import { trackProductEvent } from '../lib/productAnalytics';

function getRequestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

export function FirstMirrorTelemetryBoundary({ children }: PropsWithChildren) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const originalFetch = window.fetch;

    const handleSubmit = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLFormElement)) return;
      trackProductEvent('first_mirror_submit');
    };

    const trackedFetch: typeof window.fetch = async (...args) => {
      const url = getRequestUrl(args[0]);
      const isFirstMirrorRequest = url.includes('/api/generate');

      if (!isFirstMirrorRequest) {
        return originalFetch(...args);
      }

      const startedAt = Date.now();
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
