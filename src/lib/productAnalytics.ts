export type ProductEventName =
  | 'mode_view'
  | 'hero_primary_cta_click'
  | 'first_mirror_submit'
  | 'first_mirror_generation_started'
  | 'first_mirror_generation_succeeded'
  | 'first_mirror_generation_failed'
  | 'telegram_deep_cta_click'
  | 'privacy_link_click'
  | 'personal_myth_availability'
  | 'personal_myth_started'
  | 'personal_myth_step_completed'
  | 'personal_myth_generation_started'
  | 'personal_myth_generation_succeeded'
  | 'personal_myth_generation_failed'
  | 'personal_myth_restarted';

type EventValue = string | number | boolean | null | undefined;
export type ProductEventPayload = Record<string, EventValue>;

type DataLayerWindow = Window & {
  dataLayer?: Array<Record<string, unknown>>;
};

/**
 * Privacy-safe, vendor-neutral product analytics event.
 *
 * Rules:
 * - never send date of birth, free-text answers, generated report text, names, or contact data;
 * - keep payloads to product state, funnel step, availability, duration, and outcome;
 * - a future analytics provider can consume `window.dataLayer` or the
 *   `zerkalo:product-event` browser event without changing product components.
 */
export function trackProductEvent(
  name: ProductEventName,
  payload: ProductEventPayload = {},
): void {
  if (typeof window === 'undefined') return;

  const detail = {
    name,
    payload,
    path: window.location.pathname,
    occurred_at: new Date().toISOString(),
  };

  window.dispatchEvent(new CustomEvent('zerkalo:product-event', { detail }));

  const dataLayer = (window as DataLayerWindow).dataLayer;
  dataLayer?.push({
    event: 'zerkalo_product_event',
    event_name: name,
    ...payload,
  });

  if (import.meta.env.DEV) {
    console.debug('[product-event]', detail);
  }
}
