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

/**
 * Privacy-safe, vendor-neutral product analytics event.
 *
 * Hard boundary:
 * - no date of birth;
 * - no free-text answers;
 * - no generated report/story text;
 * - no names, phone numbers, Telegram handles, or other contact data.
 *
 * The shared runtime allowlist is the enforcement layer. A future first-party
 * storage adapter must reuse the same contract server-side before persistence.
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

  if (import.meta.env.DEV) {
    console.debug('[product-event]', detail);
  }
}
