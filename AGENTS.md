# Agent Operating Contract — Zerkalo (Web)

Инженерный контракт для кодинг-агентов, работающих в этом репозитории.
Продуктовая персона Альберта (мастер-промпт генерации, режимы, языковой канон,
голосовые антипаттерны) живёт отдельно: [`prompts/albert_persona.md`](prompts/albert_persona.md) —
инженерным задачам она не нужна и не должна подменять этот контракт.

## Production authority

- Production Web-линия — ветка `main` (зеркало: `integration/current-production-v2-base`).
- Production bridge — репозиторий `gnabriverner-pixel/digital-code-system`, ветка `release/routerai-acceptance` (DCS `main` — историческая RP-1 линия, не production).
- Verified пара SHA пиннится в [`release-compatibility.json`](release-compatibility.json); CI чекаутит DCS по этому пину, а не по плавающей ветке.
- Текущая производственная пара и статус: см. `DEPLOYMENT_MANIFEST.md` и живой `/health` на zerkalosebya.ru. GitHub Actions помечены `EXTERNAL_BLOCKED` (биллинг-блокировка аккаунта) — release gate выполняет внешний верификатор `scripts/release_verifier.sh`.

## Точные команды проверки

Локальная проверка (те же шаги, что в CI):

```bash
scripts/verify_release_local.sh                       # найдёт DCS сам или: --dcs-root <path>
scripts/verify_release_local.sh --skip-build          # быстро: typecheck + tests
```

Внешний release verifier (чистые temp-checkout, fail-closed, JSON+MD evidence):

```bash
scripts/release_verifier.sh --web-sha <40-hex> --dcs-sha <40-hex> [--post-status]
```

Быстрые проверки по отдельности: `npm run lint` (typecheck), `npm test` (vitest), `npm run build`,
`node scripts/package_release.cjs` (упаковка + boot-check).

`npm test` требует DCS: `DCS_ROOT=<checkout DCS>`, `PYTHON_BIN=<python3.12 с deps DCS>`,
и мёртвый `DCS_BRIDGE_URL=http://127.0.0.1:9` — чтобы случайный локальный сервис
на `127.0.0.1:39500` не перехватил проверку. `verify_release_local.sh` делает это автоматически.

## Запрет подмены live evidence моками

- Никогда не объявлять генеративный этап (Personal Myth, Meeting, Albert) или интеграцию с DCS завершённой на основании тестов с fixture/mock-ответами: они подтверждают только синтаксис DTO.
- «Готово/работает» — только после: зелёный `verify_release_local.sh` / `release_verifier.sh` на точных SHA **и** живая проверка против production или preflight-инстанса (`/health/ready` → `ready:true`, реальный запрос к модели без моков).
- Не заменять интеграционные проверки skip-guard'ами.
- Candidate не может считаться READY, если live provider не прошёл preflight после текущего запуска сервера.

## Секреты и окружение

- Канонический шлюз: RouterAI (`ROUTERAI_API_KEY`, `https://routerai.ru/api/v1`, primary `deepseek/deepseek-v4.1-flash`). Fallback-модели: Myth/Albert → `anthropic/claude-sonnet-5`, Meeting → `openai/gpt-5.4-mini` (один шлюз RouterAI — зафиксированный архитектурный риск).
- Ключи устанавливаются только владельцем в локальный `.env` (в `.gitignore`, подхватывается через `dotenv/config`).
- Строгий запрет искать/извлекать/копировать API-ключи из других папок, проектов или истории терминала. Нет ключа в `.env` — запросить у владельца.
- Никогда не выводить значения ключей в логи, отчёты, коммиты, CI-логи. CI-секрет `DCS_DEPLOY_KEY` — read-only deploy key DCS (Contents:read), не печатать и не логировать его.
- Автоматический fallback клиента: если `ROUTERAI_API_KEY` не задан или шлюз недоступен/401 — использовать прямой `DEEPSEEK_API_KEY`; при отсутствии обоих — явно запросить ключ у владельца, а не падать в runtime.

## Правила Web/DCS pairing

- Пара Web↔DCS проверяется acceptance-тестами (`server/code_v2_acceptance.test.ts`) против конкретного чекаута DCS — не против «какой-то» локальной копии.
- Менять `release-compatibility.json` можно только после полного PASS внешнего верификатора на новой паре.
- Деплой одной стороны пары без перепроверки другой — запрещён.
- Health: `/health` публикует только доступность и версии (включая реальный probe DCS-моста); модели, fallback и прочая операционная деталь — в `/health/ready` и логах, не в публичном payload. Никаких секретов и внутренних URL в публичных health-ответах.

## Границы прохода operability pass

- Не менять пользовательский путь, тексты, Personal Myth, Meeting, Albert, расчёты, дизайн и продуктовую стратегию.
- Исторические документы не переписывать: устаревшие SHA остаются как датированная история; текущая реальность фиксируется в `DEPLOYMENT_MANIFEST.md`, GitHub refs и живом health.
- Не разворачивать новые платформы наблюдаемости и self-hosted runner'ы; мониторинг — systemd timer + локальный скрипт (`deploy/health_monitor.sh`).
