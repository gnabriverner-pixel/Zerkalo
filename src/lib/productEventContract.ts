export const PRODUCT_EVENT_NAMES = [
  'mode_view',
  'hero_primary_cta_click',
  'first_mirror_submit',
  'first_mirror_generation_started',
  'first_mirror_generation_succeeded',
  'first_mirror_generation_failed',
  'first_mirror_result_viewed',
  'telegram_deep_cta_click',
  'privacy_link_click',
  'personal_myth_availability',
  'personal_myth_started',
  'personal_myth_step_completed',
  'personal_myth_generation_started',
  'personal_myth_generation_succeeded',
  'personal_myth_generation_failed',
  'personal_myth_restarted',
] as const;

export type ProductEventName = (typeof PRODUCT_EVENT_NAMES)[number];
export type ProductEventValue = string | number | boolean | null | undefined;
export type ProductEventPayload = Record<string, ProductEventValue>;

type PayloadRule = (value: ProductEventValue) => boolean;

const isFiniteNonNegativeNumber = (value: ProductEventValue): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

const isBoolean = (value: ProductEventValue): value is boolean => typeof value === 'boolean';

const oneOf = (...values: string[]): PayloadRule =>
  (value) => typeof value === 'string' && values.includes(value);

const API_STATUS = oneOf('ok', 'demo', 'error', 'crisis', 'unavailable', 'unknown', 'network_error');

const EVENT_PAYLOAD_RULES: Record<ProductEventName, Record<string, PayloadRule>> = {
  mode_view: { mode: oneOf('code', 'myth') },
  hero_primary_cta_click: { destination: oneOf('first_mirror') },
  first_mirror_submit: {},
  first_mirror_generation_started: {},
  first_mirror_generation_succeeded: {
    duration_ms: isFiniteNonNegativeNumber,
    http_status: isFiniteNonNegativeNumber,
    api_status: API_STATUS,
  },
  first_mirror_generation_failed: {
    duration_ms: isFiniteNonNegativeNumber,
    http_status: isFiniteNonNegativeNumber,
    api_status: API_STATUS,
  },
  first_mirror_result_viewed: { result_mode: oneOf('generated', 'fallback') },
  telegram_deep_cta_click: { source: oneOf('first_mirror', 'product_trust_layer') },
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
    status: API_STATUS,
  },
  personal_myth_restarted: {},
};

export function isProductEventName(value: unknown): value is ProductEventName {
  return typeof value === 'string' && (PRODUCT_EVENT_NAMES as readonly string[]).includes(value);
}

/**
 * Shared privacy boundary used by both browser and server.
 * Unknown keys and invalid values are dropped before storage or adapters.
 */
export function sanitizeProductEventPayload(
  name: ProductEventName,
  payload: ProductEventPayload = {},
): ProductEventPayload {
  const rules = EVENT_PAYLOAD_RULES[name];
  const safePayload: ProductEventPayload = {};

  for (const [key, rule] of Object.entries(rules)) {
    const value = payload[key];
    if (value !== undefined && rule(value)) safePayload[key] = value;
  }

  return safePayload;
}
