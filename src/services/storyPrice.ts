/** Single source of truth for the Personal Myth price (kopecks). Change it only here. */
export const STORY_PRICE = 79000;
export const STORY_CURRENCY = 'RUB';
export const STORY_PRICE_RUB = STORY_PRICE / 100;
/** Provider amount string, e.g. "790.00". */
export const STORY_PRICE_VALUE = (STORY_PRICE / 100).toFixed(2);
/** Display string for the interface, e.g. "790 ₽". */
export const STORY_PRICE_LABEL = `${Number.isInteger(STORY_PRICE_RUB) ? STORY_PRICE_RUB : STORY_PRICE_RUB.toFixed(2).replace('.', ',')} ₽`;
