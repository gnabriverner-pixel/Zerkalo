import {
  sanitizeProductEventPayload,
  type ProductEventName,
  type ProductEventPayload,
} from './productEventContract';

export { sanitizeProductEventPayload } from './productEventContract';
export type { ProductEventName, ProductEventPayload } from './productEventContract';

type DataLayerWindow = Window & {
  dataLayer?: Array<Record<string, unknown>>;
};

function createPageSessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `page_${Math.random().toString(36).slice(2, 18)}`;
}

const pageSessionId = typeof window === 'undefined' ? '' : createPageSessionId();

function deliverFirstPartyEvent(detail: {
  name: ProductEventName;
  payload: ProductEventPayload;
  path: string;
  occurred_at: string;
}): void {
  if (typeof window === 'undefined') return;

  void window.fetch('/api/product-events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...detail,
      page_session_id: pageSessionId,
    }),
    keepalive: true,
  }).catch(() => {
    // Product measurement must never block or degrade the user journey.
  });
}

/**
 * Privacy-safe product analytics event.
 *
 * Hard boundary:
 * - no date of birth;
 * - no free-text answers;
 * - no generated report/story text;
 * - no names, phone numbers, Telegram handles, or other contact data.
 *
 * The shared runtime allowlist is enforced in the browser and again on the
 * server before any first-party persistence.
 */
export function trackProductEvent(
  name: ProductEventName,
  payload: ProductEventPayload = {},
): void {
  if (typeof window === 'undefined') return;

  const safePayload = sanitizeProductEventPayload(name, payload);
  const detail = {
    name,
    payload: safePayload,
    path: window.location.pathname,
    occurred_at: new Date().toISOString(),
  };

  window.dispatchEvent(new CustomEvent('zerkalo:product-event', { detail }));

  const dataLayer = (window as DataLayerWindow).dataLayer;
  dataLayer?.push({
    event: 'zerkalo_product_event',
    event_name: name,
    ...safePayload,
  });

  deliverFirstPartyEvent(detail);

  if (import.meta.env.DEV) {
    console.debug('[product-event]', detail);
  }
}
