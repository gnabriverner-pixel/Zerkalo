import { STORY_PRICE_RUB } from '../src/services/storyPrice';
import { previewSupport } from './freePreview';

/** Edition date of the offer and the policy. Change it here when the texts change. */
export const LEGAL_EDITION_DATE = '2026-10-29';
/** Working days to answer a request (offer and policy). */
export const LEGAL_RESPONSE_WORKING_DAYS = 10;
export const LEGAL_NEUTRAL_REQUISITES = 'Реквизиты оператора публикуются до начала продаж; обращения — через форму поддержки';

const EMAIL_RE = /^[^\s@<>"']{1,64}@[^\s@<>"']{1,255}\.[A-Za-z]{2,}$/;

export function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export interface LegalValues { name: string; inn: string; email: string; supportUrl: string | null; configured: boolean }

export function legalValues(env: NodeJS.ProcessEnv, supportUrlFromConfig?: string | null): LegalValues {
  const name = String(env.OPERATOR_NAME ?? '').trim();
  const inn = String(env.OPERATOR_INN ?? '').trim();
  const email = String(env.OPERATOR_EMAIL ?? '').trim();
  const configured = !!name && /^\d{10,12}$/.test(inn) && EMAIL_RE.test(email);
  return { name, inn, email, configured, supportUrl: previewSupport(env.FREE_PREVIEW_SUPPORT_URL || supportUrlFromConfig || undefined) };
}

/** Flag only (never the values) for /health/ready. */
export function legalRequisitesConfigured(env: NodeJS.ProcessEnv): boolean {
  return legalValues(env).configured;
}

function supportLink(v: LegalValues): string {
  return v.supportUrl ? `<a href="${escapeHtml(v.supportUrl)}" rel="noopener">форму поддержки</a>` : 'форму поддержки';
}

export function contactHtml(v: LegalValues): string {
  if (v.configured) return `<a href="mailto:${escapeHtml(v.email)}">${escapeHtml(v.email)}</a>`;
  return `через ${supportLink(v)}`;
}

export function operatorRequisitesHtml(v: LegalValues): string {
  if (v.configured) {
    return `${escapeHtml(v.name)}, самозанятый (плательщик налога на профессиональный доход), ИНН ${escapeHtml(v.inn)}`;
  }
  return `${escapeHtml(LEGAL_NEUTRAL_REQUISITES)}${v.supportUrl ? ` (<a href="${escapeHtml(v.supportUrl)}" rel="noopener">форма поддержки</a>)` : ''}`;
}

export function renderLegalPage(template: string, env: NodeJS.ProcessEnv, supportUrlFromConfig?: string | null): string {
  const v = legalValues(env, supportUrlFromConfig);
  const tokens: Record<string, string> = {
    OPERATOR_REQ_HTML: operatorRequisitesHtml(v),
    CONTACT_HTML: contactHtml(v),
    PRICE: escapeHtml(Number.isInteger(STORY_PRICE_RUB) ? String(STORY_PRICE_RUB) : STORY_PRICE_RUB.toFixed(2).replace('.', ',')),
    EDITION_DATE: escapeHtml(LEGAL_EDITION_DATE),
    RESPONSE_DAYS: String(LEGAL_RESPONSE_WORKING_DAYS),
  };
  return template.replace(/\{\{([A-Z_]+)\}\}/g, (m, k) => (k in tokens ? tokens[k] : m));
}

/** Public contact for the React footer (the e-mail is meant to be published). */
export function publicLegalContact(env: NodeJS.ProcessEnv, supportUrlFromConfig?: string | null) {
  const v = legalValues(env, supportUrlFromConfig);
  return { email: v.configured ? v.email : null, support_url: v.supportUrl };
}
