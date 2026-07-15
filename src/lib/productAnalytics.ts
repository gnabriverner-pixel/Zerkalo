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

type PayloadRule = (value: EventValue) => boolean;

const isShortString = (value: EventValue): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= 64;

const isFiniteNonNegativeNumber = (value: EventValue): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

const isBoolean = (value: EventValue): value is boolean => typeof value === 'boolean';

const oneOf = (...values: string[]): PayloadRule =>
  (value) => typeof value === 'string' && values.includes(value);

const EVENT_PAYLOAD_RULES: Record<ProductEventName, Record<string, PayloadRule>> = {
  mode_view: { mode: oneOf('code', 'myth') },
  hero_primary_cta_click: { destination: oneOf('first_mirror') },
  first_mirror_submit: {},
  first_mirror_generation_started: {},
  first_mirror_generation_succeeded: {
    duration_ms: isFiniteNonNegativeNumber,
    http_status: isFiniteNonNegativeNumber,
    api_status: isShortString,
  },
  first_mirror_generation_failed: {
    duration_ms: isFiniteNonNegativeNumber,
    http_status: isFiniteNonNegativeNumber,
    api_status: isShortString,
  },
  telegram_deep_cta_click: { source: oneOf('product_trust_layer') },
  privacy_link_click: { source: oneOf('product_trust_layer') },
  personal_myth_availability: { state: oneOf('ready', 'unavailable') },
  personal_myth_started: { draft_restored: isBoolean },
  personal_myth_step_completed: {
    step: (value) => typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 4,
    answer_mode: oneOf('choice', 'free_text'),
  },
  personal_myth_generation_started: { retry: isBoolean },
  personal_myth_generation_succeeded: { duration_ms: isFiniteNonNegativeNumber },
  personal_myth_generation_failed: {
    duration_ms: isFiniteNonNegativeNumber,
    status: isShortString,
  },
  personal_myth_restarted: {},
};

/**
 * Enforces the analytics privacy contract at runtime.
 * Unknown keys and invalid values are dropped before any browser event or
 * analytics adapter can receive them.
 */
export function sanitizeProductEventPayload(
  name: ProductEventName,
  payload: ProductEventPayload = {},
): ProductEventPayload {
  const rules = EVENT_PAYLOAD_RULES[name];
  const safePayload: ProductEventPayload = {};

  for (const [key, rule] of Object.entries(rules)) {
    const value = payload[key];
    if (value !== undefined && rule(value)) {
      safePayload[key] = value;
    }
  }

  return safePayload;
}

/**
 * Privacy-safe, vendor-neutral product analytics event.
 *
 * Hard boundary:
 * - no date of birth;
 * - no free-text answers;
 * - no generated report/story text;
 * - no names, phone numbers, Telegram handles, or other contact data.
 *
 * The runtime allowlist above is the enforcement layer. Components may only
 * emit bounded product-state metadata such as funnel step, availability,
 * duration and outcome.
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
