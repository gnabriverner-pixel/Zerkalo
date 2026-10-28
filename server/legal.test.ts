import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { renderLegalPage, legalRequisitesConfigured, publicLegalContact, LEGAL_NEUTRAL_REQUISITES, LEGAL_EDITION_DATE } from './legal';
import { STORY_PRICE_RUB } from '../src/services/storyPrice';

const read = (f: string) => fs.readFileSync(path.resolve(__dirname, '../public', f), 'utf8');
const visible = (html: string) => html.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ');
const SYN = { OPERATOR_NAME: 'Иванов <b>Тестовый</b> & Ко', OPERATOR_INN: '000000000000', OPERATOR_EMAIL: 'test@example.test' } as NodeJS.ProcessEnv;

describe('legal pages: operator details from the environment', () => {
  it('substitutes and escapes synthetic values', () => {
    for (const f of ['privacy.html', 'terms.html']) {
      const html = renderLegalPage(read(f), SYN);
      expect(html).toContain('Иванов &lt;b&gt;Тестовый&lt;/b&gt; &amp; Ко');
      expect(html).not.toContain('<b>Тестовый</b>');
      expect(html).toContain('000000000000');
      expect(html).toContain('mailto:test@example.test');
      expect(html).not.toContain('{{');
      expect(visible(html)).not.toMatch(/[\[\]]/);
      expect(html).toContain(LEGAL_EDITION_DATE);
    }
    expect(renderLegalPage(read('terms.html'), SYN)).toContain(`${STORY_PRICE_RUB} ₽`);
    expect(legalRequisitesConfigured(SYN)).toBe(true);
    expect(publicLegalContact(SYN).email).toBe('test@example.test');
  });
  it('without requisites: no brackets, neutral line, support link, flag is false', () => {
    const env = { FREE_PREVIEW_SUPPORT_URL: 'https://t.me/zerkalo_test_support' } as NodeJS.ProcessEnv;
    for (const f of ['privacy.html', 'terms.html']) {
      const html = renderLegalPage(read(f), env);
      expect(visible(html)).not.toMatch(/[\[\]]/);
      expect(html).not.toContain('class="ph"');
      expect(html).toContain(LEGAL_NEUTRAL_REQUISITES);
      expect(html).toContain('https://t.me/zerkalo_test_support');
      expect(html).not.toContain('{{');
    }
    expect(legalRequisitesConfigured(env)).toBe(false);
    expect(legalRequisitesConfigured({ OPERATOR_NAME: 'Иванов Тестовый', OPERATOR_INN: '000000000000', OPERATOR_EMAIL: 'bad' } as any)).toBe(false);
    expect(publicLegalContact(env).email).toBeNull();
  });
  it('raw templates carry no bracketed text', () => {
    for (const f of ['privacy.html', 'terms.html']) expect(visible(read(f))).not.toMatch(/[\[\]]/);
  });
});
