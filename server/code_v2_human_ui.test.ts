import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { CodeV2Experience } from '../src/components/CodeV2/CodeV2Experience';
import { calculateCanonicalCodeV2 } from './dcsBridge';

const FORBIDDEN_NORMAL_TERMS = [
  'V2',
  'Предпросмотр',
  'Акт 1',
  'Акт 2',
  'Акт 3',
  'Акт 4',
  'Акт 5',
  'Акт 6',
  'Акт 7',
  'Эпистемический контур',
  'Базовый закон',
  'QA Режим',
  'максимальный КПД',
  'исследовательские вопросы',
  'внутренний срез'
];

describe('Code V2 Human Product Experience UI Contract', () => {
  it('normal entry view (?preview=v2) contains none of the forbidden developer terms', () => {
    const html = renderToString(
      React.createElement(CodeV2Experience, {
        isQaMode: false,
        onOpenAlbert: () => {}
      })
    );

    for (const term of FORBIDDEN_NORMAL_TERMS) {
      expect(html).not.toContain(term);
    }

    // Must contain human entry copy
    expect(html).toContain('ЗЕРКАЛО СЕБЯ');
    expect(html).toContain('Ваш Цифровой Код');
    expect(html).toContain('Открыть мой Код');
    expect(html).not.toContain('qa=1');
  });

  it('normal calculated view (?preview=v2) contains none of the forbidden terms, fits word budget and exhibits human language', async () => {
    const payload = await calculateCanonicalCodeV2('06.05.1986');

    // Default collapsed view: word budget strictly 450-700 words
    const html = renderToString(
      React.createElement(CodeV2Experience, {
        initialDate: '06.05.1986',
        initialPayload: payload,
        isQaMode: false,
        onOpenAlbert: () => {}
      })
    );

    for (const term of FORBIDDEN_NORMAL_TERMS) {
      expect(html).not.toContain(term);
    }

    // Must NOT contain internal taxonomy terms in normal view
    const FORBIDDEN_TAXONOMY = ['TENSION', 'RESONANCE', 'AMPLIFICATION', 'BRAKE', 'COMPENSATION'];
    for (const tax of FORBIDDEN_TAXONOMY) {
      expect(html).not.toContain(tax);
    }

    // Visible text budget: 450-700 Russian words
    const textOnly = html.replace(/<[^>]*>/g, ' ');
    const ruWords = textOnly.match(/[а-яА-ЯёЁ]+/g) || [];
    expect(ruWords.length).toBeGreaterThanOrEqual(450);
    expect(ruWords.length).toBeLessThanOrEqual(700);

    // Sequence verification: 5 numbers visually, central motif, quiet Albert link, expandable calculation
    expect(html).toContain('Пять позиций вашей карты');
    expect(html).toContain('Покой внутри — жёсткий мотор в деле');
    expect(html).toContain('Хотите проверить это на себе?');
    expect(html).toContain('Вот откуда это взялось');

    // Must contain human labels
    expect(html).toContain('Как это читать');
    expect(html).toContain('О чём это число');
    expect(html).toContain('Проверьте на себе');
    expect(html).toContain('Вопросы для проверки карты');
    expect(html).toContain('Альберт — собеседник по вашей карте');
    expect(html).toContain('Поговорить с Альбертом');

    // Expanded view has the required human replacements for strong/shadow/trap
    const expandedHtml = renderToString(
      React.createElement(CodeV2Experience, {
        initialDate: '06.05.1986',
        initialPayload: payload,
        initialExpanded: { soul: true },
        isQaMode: false,
        onOpenAlbert: () => {}
      })
    );
    expect(expandedHtml).toContain('Когда эта сила работает');
    expect(expandedHtml).toContain('Где она начинает мешать');
    expect(expandedHtml).toContain('Главная ловушка');
  });

  it('QA mode (?preview=v2&qa=1) exposes QA controls and presets', () => {
    const html = renderToString(
      React.createElement(CodeV2Experience, {
        isQaMode: true,
        onOpenAlbert: () => {},
        onSwitchToV1: () => {}
      })
    );

    expect(html).toContain('QA Режим');
    expect(html).toContain('Контрольные даты для проверки');
    expect(html).toContain('06.05.1986');
    expect(html).toContain('Переключить на V1');
  });
});
