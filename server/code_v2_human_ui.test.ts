import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { cleanPositionEssence, CodeV2Experience } from '../src/components/CodeV2/CodeV2Experience';
import { LabEntryView } from '../src/components/LabEntryView';
import { SampleStoryModal } from '../src/components/SampleStoryModal';
import { QaPresetPicker, QaTopBar } from '../src/components/CodeV2/qaPanel';
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
    expect(html).toContain('Ваши пять чисел');
    expect(html).toContain('Посмотреть свой разбор');
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

    // Artistic content words (central motif + mini-stories or fallback essences)
    const artisticWords = [
      payload.central_motif || '',
      ...payload.positions.flatMap((p) => {
        const s = (p as any).mini_story;
        return s ? [s.title, ...s.paragraphs, s.question] : [p.essence, p.verification_question];
      }),
    ].join(' ').match(/[а-яА-ЯёЁ]+/g) || [];

    // All visible Russian words
    const textOnly = html.replace(/<[^>]*>/g, ' ');
    const ruWords = textOnly.match(/[а-яА-ЯёЁ]+/g) || [];

    // Navigation and framing copy counted separately from full literary content
    const navWordsCount = ruWords.length - artisticWords.length;
    expect(navWordsCount).toBeGreaterThanOrEqual(100);
    expect(navWordsCount).toBeLessThanOrEqual(700);

    // Sequence verification: symbolic framing, 5 numbers visually, central motif with planetary badge, quiet Albert link, expandable calculation
    expect(html).toContain('Как читать');
    expect(html).toContain('Пять чисел, пять ролей');
    expect(html).toContain('Роль подсказывает, куда смотреть: Душа — чего вам хочется внутренне');
    expect(html).toContain('Ваши пять чисел и их роли');
    expect(html).toContain('Венера (6) ⟷ Сатурн (8)');
    expect(html).toContain('Покой сердца и строгий закон формы');
    expect(html).toContain('Сравните это описание со своей жизнью. Оно может не совпасть.');
    expect(html).toContain('Хотите проверить это на себе?');
    for (const paragraph of (payload.central_motif || '').split('\n\n')) {
      expect(html).toContain(paragraph);
    }
    expect(html).not.toContain('Раскрыть эту связь');
    expect(html).toContain('Вот откуда это взялось');

    // Full mini-stories with all paragraphs and story question visible immediately without expanding
    for (const position of payload.positions) {
      if (position.mini_story) {
        expect(html).toContain(position.mini_story.title);
        for (const paragraph of position.mini_story.paragraphs) {
          expect(html).toContain(paragraph);
        }
        expect(html).toContain(position.mini_story.question);
      } else {
        expect(html.split(position.verification_question).length - 1).toBe(1);
      }
    }

    // Must contain human labels
    expect(html).toContain('Как читать');
    expect(html).toContain('Проверьте на себе');
    expect(html).not.toContain('Вопросы для проверки карты');
    expect(html).toContain('Альберт · проводник');
    expect(html).not.toContain('Альберт · ИИ-проводник');
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

  it('renders legacy markdown-rich Direction payloads as clean structured prose', async () => {
    const payload = await calculateCanonicalCodeV2('06.05.1986');
    const direction = payload.positions.find((position) => position.position === 'direction');
    expect(direction).toBeTruthy();
    direction!.essence = 'Короткое человеческое описание.\n\n### Параметры среды:\n* **Темп:** Быстрый.';
    direction!.environment_parameters = { 'Темп среды': 'Быстрый и гибкий' };

    expect(cleanPositionEssence(direction!.essence)).toBe('Короткое человеческое описание.');

    const html = renderToString(
      React.createElement(CodeV2Experience, {
        initialDate: '06.05.1986',
        initialPayload: payload,
        initialExpanded: { direction: true },
        isQaMode: false,
        onOpenAlbert: () => {}
      })
    );

    expect(html).toContain('В какой среде раскрывается это Направление');
    expect(html).toContain('Быстрый и гибкий');
    expect(html).not.toContain('###');
    expect(html).not.toContain('**Темп:**');
  });

  it('frames Path as a capability learned through life rather than a finished trait', async () => {
    const payload = await calculateCanonicalCodeV2('06.05.1986');
    const htmlWithStory = renderToString(
      React.createElement(CodeV2Experience, {
        initialDate: '06.05.1986',
        initialPayload: payload,
        isQaMode: false,
        onOpenAlbert: () => {}
      })
    );

    expect(htmlWithStory).toContain('Осваиваемый способ действия');
    // Mini-story is rendered without duplicating the fallback trait plaque
    expect(htmlWithStory).not.toContain('Это не готовая черта характера, а направление практики');

    // Fallback mode without mini_story retains the explanatory plaque
    const fallbackPayload = {
      ...payload,
      positions: payload.positions.map((p) => ({ ...p, mini_story: undefined }))
    };
    const htmlFallback = renderToString(
      React.createElement(CodeV2Experience, {
        initialDate: '06.05.1986',
        initialPayload: fallbackPayload,
        isQaMode: false,
        onOpenAlbert: () => {}
      })
    );

    expect(htmlFallback).toContain('Осваиваемый способ действия');
    expect(htmlFallback).toContain('Это не готовая черта характера, а направление практики');
    expect(htmlFallback).toContain('О чём это число');
  });

  // Release hygiene: the QA surface (top bar + preset dates) moved to the dev-only
  // module ../src/components/CodeV2/qaPanel, which CodeV2Experience loads through a
  // COMPILE-TIME `import.meta.env.DEV` dynamic import — the production build cannot
  // contain it. renderToString does not run effects, so the QA contract is asserted
  // against the module itself, and the component tree is asserted to be free of QA
  // copy on its own.
  it('QA mode (?preview=v2&qa=1) surfaces live in the dev-only module, not in the component tree', () => {
    const qaHtml = renderToString(
      React.createElement(
        React.Fragment,
        null,
        React.createElement(QaTopBar, { onSwitchToV1: () => {} }),
        React.createElement(QaPresetPicker, { currentDob: '', onSelect: () => {} })
      )
    );

    expect(qaHtml).toContain('QA Режим');
    expect(qaHtml).toContain('Контрольные даты для проверки');
    expect(qaHtml).toContain('06.05.1986');
    expect(qaHtml).toContain('Переключить на V1');

    const componentHtml = renderToString(
      React.createElement(CodeV2Experience, {
        isQaMode: true,
        onOpenAlbert: () => {},
        onSwitchToV1: () => {}
      })
    );

    expect(componentHtml).not.toContain('QA Режим');
    expect(componentHtml).not.toContain('Контрольные даты для проверки');
    expect(componentHtml).not.toContain('06.05.1986');
  });

  it('Release 4 contract: home has two gates with Astra copy and exact actions, and no visible AI outside footer', () => {
    const entryHtml = renderToString(
      React.createElement(LabEntryView, {
        onSelectMyth: () => {},
        onSelectCode: () => {},
      })
    );

    // Hero title and subtitle verbatim from Astra
    expect(entryHtml).toContain('Зеркало себя');
    expect(entryHtml).toContain('Посмотреть на знакомое иначе.');
    expect(entryHtml).not.toContain('ИИ напишет для вас сказку');

    // Gate 1: Personal Myth
    expect(entryHtml).toContain('История по вашей ситуации');
    expect(entryHtml).toContain('Четыре вопроса о том, что происходит сейчас. Затем — личная история, в которой можно узнать знакомое переживание.');
    expect(entryHtml).toContain('Начать историю');
    expect(entryHtml).toContain('Прочитать пример');

    // Gate 2: Digital Code
    expect(entryHtml).toContain('Разбор по дате рождения');
    expect(entryHtml).toContain('Пять сторон жизни через образы чисел: желания, поступки, способ действовать, окружение и то, что вы создаёте.');
    expect(entryHtml).toContain('Посмотреть свой разбор');
    expect(entryHtml).toContain('Посмотреть пример');

    // Split at footer to test that hero and gates have NO "ИИ" at all
    const [aboveFooter, footer] = entryHtml.split('<footer');
    expect(aboveFooter).not.toContain('ИИ');
    expect(aboveFooter).not.toContain('AI');

    // Footer contains project disclaimer
    expect(footer).toContain('Информационно-развлекательный проект для самопознания. Личные истории и ответы Альберта создаются с помощью ИИ. Разборы и истории не являются консультацией или прогнозом.');
  });

  it('Release 4 contract: SampleStoryModal renders synthetic sample and PDF download link', () => {
    const modalHtml = renderToString(
      React.createElement(SampleStoryModal, {
        isOpen: true,
        onClose: () => {},
      })
    );
    expect(modalHtml).toContain('Дверь у воды — вымышленный образец');
    expect(modalHtml).toContain('Вымышленный демонстрационный случай');
    expect(modalHtml).toContain('Подготовленный вымышленный образец состава услуги');
    expect(modalHtml).toContain('href="/api/stories-sample/pdf"');
  });
});

