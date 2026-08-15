# LAB FORENSIC — Gate 1: Myth Recovery First

Ветка: `lab/myth-recovery-v1`
Snapshot: `ce33e945` (заморожен, unreviewed)
Base: свежий clone `gnabriverner-pixel/Zerkalo`

## Что произошло с main до заморозки

- `2eed58e4` — «Merge PR #12 product/website-release-v2-foundation»: последний main до рефакторинга (в бриф-снапшоте он фигурировал как актуальный).
- `c50eee3` «refactor: overhaul system architecture and UI» — большой незарецензированный рефакторинг:
  - перевёл core на Gemini 2.5 (`DEFAULT_MODEL=gemini-2.5-flash`, `MYTH_MODEL_A/B`, `SYNTHESIS_MODEL=gemini-2.5-flash`);
  - удалил `server/personalMyth.ts` (валидатор/ретраи/provenance), `personalMyth.test.ts`, smoke-скрипт, docs, `.env.example`-документацию;
  - добавил Meeting of Mirrors, blind A/B harness (`/api/ab-compare`, `ModelComparisonHarness`), TesterFeedbackWidget, LabEntryView, MirrorJourney и др.;
  - **вернул canned-фолбэк**: `applyFallback()` с `title: "Отражение"` в `PersonalMyth.tsx` (срабатывает на любую ошибку), а `story.test.ts` кодифицировал его наличие.
- `ce33e94` — правка копирайта/типографики `LabEntryView` (15 строк).

## Обнаруженные дефекты снапшота (зафиксированы, не исправляются в main)

1. Fake-success фолбэк «Отражение» в myth-UI + тест, требующий его наличия.
2. Нет quality-гейта: schema/лексика не проверяются после генерации (кроме crisis pre-check).
3. Встреча зеркал получает сырые 4 ответа как источник совпадений + fallback-якорь «Связка амбиции ядра и вектора реализации»; `generateDeterministicMeeting` всегда `hasStrongParallels: true`.
4. `.env.example` выхолощен; model IDs не задокументированы.

## Что сделано в Gate 1 (lab-ветка)

- `server/myth.ts` — новый модуль: DeepSeek V4 провайдер (env-модель, non-thinking по умолчанию, `reasoning_effort` env-gated), parse, crisis pre-check, post-generation safety (schema + запрещённая лексика), bounded retry, **без fake success**.
- `server.ts` — добавлен `POST /api/lab/myth/generate` (rate limit 5/10 мин, idempotency 30 мин), `GET /health/ready`; `/api/ab-compare` переведён на DeepSeek V4 с **одинаковыми настройками** для обеих моделей и **строгой слепотой** (имена моделей не в ответе; `POST /api/ab-reveal` — только после выбора).
- `src/components/PersonalMyth.tsx` — ходит только в `/api/lab/myth/generate`; `applyFallback`/«Отражение» удалены; честный error-экран; draft в localStorage; повтор использует тот же `request_id`.
- `src/services/story.test.ts` — инверсия: фолбэк запрещён, lab-эндпоинт обязателен.
- `server/myth.test.ts` — unit-тесты: контракт, независимость writer-prompt (без кода/дат), retry, честный отказ.
- `scripts/lab_myth_smoke.ts` — 3 фикстуры (транспорт/schema; не quality-гейт).
- `scripts/lab_myth_ab.ts` — blind A/B 5×2 → `lab_ab_runs/<ts>-blind.json` + `<ts>-reveal.json` (gitignored).

## Модельный контракт

- Только `deepseek-v4-flash` / `deepseek-v4-pro`. `deepseek-chat`/`deepseek-reasoner` в конфигах и доки этой ветки отсутствуют.
- A/B: одинаковый prompt, одинаковая температура, одинаковый `max_tokens`, одинаковый thinking-режим (по умолчанию `off`; `LAB_MYTH_THINKING=high|max` — эксперимент, до запуска сверяется с официальной документацией).

## Заморожено (не трогать в Gate 1)

- `src/services/mythPrompts.ts` (старый writer-prompt с перечнем запретов и «250–450 слов») — используется только замороженным `/api/generate`.
- `/api/generate`, `/api/meeting-of-mirrors`, `src/services/meetingOfMirrors.ts`, `generateDeterministicMeeting` — контракт Встречи переписывается в Gate 2 после ревью владельца.
- `src/components/MeetingOfMirrors.tsx`, `MirrorJourney.tsx`, `TesterFeedbackWidget.tsx` — визуал и виджеты снапшота.

## Как запустить

```bash
cp .env.example .env   # вписать DEEPSEEK_API_KEY (никогда не коммитить)
npm ci
npm run dev            # http://localhost:3000 → «Личный миф»
node --import tsx scripts/lab_myth_smoke.ts
node --import tsx scripts/lab_myth_ab.ts
npm test -- --run
npm run lint
npm run build
```

## Rollback Gate 1

- main не тронут (проверка: `git ls-remote origin HEAD` = `ce33e945`).
- Удаление лаборатории: удалить ветку `lab/myth-recovery-v1` и клон `zerkalo-lab`.
