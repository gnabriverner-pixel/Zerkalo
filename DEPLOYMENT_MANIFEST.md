# DEPLOYMENT MANIFEST — Zerkalo / Digital Code (production pair)

> Единственная точка правды о текущей производственной паре. Обновляется
> каждым деплоем; исторические SHA не переписываются, а сохраняются ниже
> с датами (см. History). Актуальность сверяется с живым `/health`
> на zerkalosebya.ru и GitHub refs.

## Current production pair

| Component | Repo | Branch | SHA |
|-----------|------|--------|-----|
| Web (zerkalosebya.ru) | gnabriverner-pixel/Zerkalo | `main` (deployed from release dir) | `ee44fcda9b0bbf0289cb9b54349e0c2a1065eaca` |
| DCS bridge + Telegram | gnabriverner-pixel/digital-code-system | `release/routerai-acceptance` | `fe67002ce2a2f9d05fa9faf205ef45264f05a931` |

- **Дата переключения Web: 2026-09-20 ~10:16 UTC** (DCS `fe67002…` не менялся; предыдущая пара `c7fc1f8…` + `fe67002…` от 2026-09-18 — теперь непосредственный rollback).
- `/health` и `/health/ready` на проде возвращают Web SHA `ee44fcd…`, `dirty:false`, `dcs_bridge {ready, sha fe67002…}` (проверено живьём после cutover — локально и публично).
- Release gate: внешний верификатор `scripts/release_verifier.sh` — **fail-closed по пинам пары** (`release-compatibility.json` v2, оба SHA) + канонический runtime Node 24. GitHub Actions помечены `EXTERNAL_BLOCKED: GitHub account billing lock`; отсутствие зелёного Actions-рана не является дефектом проверенного SHA.
- Runtime прода: Node `v22.23.2` (наблюдение с сервера; канонический runtime *верификации* — Node 24, паритет с CI; прод не менялся).

## Production smoke policy (T6 hardening, 2026-09-21)

**DO NOT USE REAL USER DOB in production smoke — ever.** Every production
smoke run (manual or scripted) must use the documented synthetic fixture only:

- **`SYNTHETIC_SMOKE_DOB = 01.07.1990`** — deterministic, synthetic, tied to no
  real person: adult (18+ with a wide margin), valid DD.MM.YYYY with day ≤ 28,
  not a leap day, not a year boundary, not the calculation canon golden case,
  and no test anywhere pins numeric results for it.
- Canonical procedure: `scripts/production_smoke.sh [--base-url <url>]` —
  consent (synthetic session) → `/api/calculate` → `/api/code-v2`, asserting
  **structure only**: HTTP success, `status: ok`, canonical authority
  (`engine.py::full_analysis`), expected schema/positions, absence of server
  errors. Never psychological/numerological content of a specific person.
- Forbidden in smoke: Telegram sends, payment flows, delete-data calls for
  real users, real owner/user DOB.
- Enforcement: `server/production_smoke_fixture.test.ts` (Vitest) fails if a
  smoke/release script reintroduces a known real or QA-preset DOB.
- Historical smoke entries below that mention `dob 06.05.1986` record the
  pre-policy practice of 2026-09-18 and **must not be repeated**.

## Verification commands

```bash
# Локально (те же шаги, что в CI):
scripts/verify_release_local.sh

# Внешний verifier на точной паре (JSON+MD evidence, fail-closed):
scripts/release_verifier.sh --web-sha ee44fcda9b0bbf0289cb9b54349e0c2a1065eaca \
                            --dcs-sha fe67002ce2a2f9d05fa9faf205ef45264f05a931
```

## Rollback

Релизные каталоги на хосте иммутабельны (`/opt/zerkalo-releases/<sha>`,
`/opt/digital-code-releases/<sha>`, см. docs/DIGITAL_CODE_PRODUCT_RELEASE_V1_DEPLOY_RECORD.md
для V1-паттерна). Rollback = переключение symlink сервиса на предыдущий
каталог релиза + рестарт юнита; БД и runtime-стейт живут вне релизных каталогов.
Точные команды для среды с SSH: `deploy/rollback.sh` (проверить соответствие
каталогов перед исполнением).

- **Непосредственный rollback текущего релиза: `c7fc1f8d6c87f44bab86b54d7622c8cd56c97cc1`** — каталог проверен перед cutover: `dist/release.json` sha=c7fc1f8, `dirty=false`, `node_modules` и `server.ts` на месте. Второй уровень истории — `7d9e00f08e9c65167d8e40195f2d5bd1bfd63cd1`.

### Post-deploy acceptance — COMPLETED 2026-09-18 (факты, не ожидания)

Деплой Web `c7fc1f8…` из иммутабельного каталога `/media/vda1/opt/zerkalo-releases/c7fc1f8…` (зависимости установлены на сервере, права как у эталона). Мониторинг: база совместимости — `a4bd2d5` (фикс dcs_bridge-совместимости с legacy payload), production hardening — `4952b65` (санитизация unit-ключей состояния + getMe retry).

| Проверка | Результат | Время (UTC) |
|---|---|---|
| Verifier pair gate (Node 24, чистые checkout) | **PASS 10/10** — `evidence/verify-20260918-gatehardened/`; commit status на оба SHA | 16:16 |
| Negative pair tests | 3× **FAIL** (wrong web sha / wrong dcs sha / wrong node major), rc=1, 0 дорогих шагов | 16:09 |
| Preflight перед cutover | release dir, unit, rollback dir `7d9e00f…`, read-доступ юзера zerkalo — OK | 16:21 |
| Isolated boot-check :3999 (chroot) | `/health`: sha `c7fc1f8…`, dirty=false, `dcs_bridge {ready, fe67002…}` | 16:22 |
| Cutover | `current` → `c7fc1f8…`, `systemctl start zerkalo.service` → active, NRestarts=0 | 16:24 |
| Public `https://zerkalosebya.ru/health` | 200: sha `c7fc1f8…`, `dcs_bridge {ready, fe67002…}` | 16:25 |
| Public `https://zerkalosebya.ru/health/ready` | 200 `ready`: llm_provider=true, dcs_bridge=true/ready/fe67002 | 16:25 |
| **Реальный пользовательский smoke** *(pre-policy record — real-DOB smoke no longer permitted, see Production smoke policy)* | consent → `POST /api/calculate` (dob 06.05.1986) → `status: ok`, authority `engine.py::full_analysis`, числа 6/2/8/5/1, missing [2,3,4,7] — **живой путь через DCS-мост, не mock** | 16:25 |
| Мониторинг установлен | `/usr/local/bin/zerkalo-health-monitor.sh`, state `/var/lib/zerkalo-health-monitor`, токены из production.env (значения не печатались), timer активен (каждые 5 мин) | 16:26 |
| Цикл мониторинга | переходы: alert при healthy→failed и failed→healthy; **повторы без алертов**; getMe с retry; baseline NRestarts: zerkalo=0, bridge=0, v2-prod=49019 (рост → алерт) | 16:28 |
| Rollback SHA | `7d9e00f08e9c65167d8e40195f2d5bd1bfd63cd1` (каталог существует; откат = flip `current` + restart) | — |

### Post-deploy acceptance — COMPLETED 2026-09-20 (факты, не ожидания)

Cutover Web на пару `ee44fcd…` + `fe67002…` (DCS не менялся). Причина релиза: upstream перестал принимать `response_format: json_schema` в `/chat/completions`, из-за чего Myth и Meeting в проде падали на provenance-проверке; PR #34 переводит frozen primary на `json_object`, нормализует подтверждённую метку Claude-маршрута и даёт bounded headroom для Myth (8000).

| Проверка | Результат | Время (UTC) |
|---|---|---|
| Внешний verifier на точной паре (Node 24, чистые checkout'ы) | **PASS 11/11** — evidence `evidence/verify-20260920-093841-rc-ee44fcd/`; pair gate manifest `43c37a3`; 387 с | 09:32→09:38 |
| Стейджинг релиза из иммутабельного архива | `release-ee44fcd….tar.gz` sha256 `51ffeb1e…`; зависимости установлены на сервере; layout совпал с эталонным каталогом | 10:15 |
| Изолированный boot-check :3999 (chroot) | `/health`: sha `ee44fcd…`, dirty=false, `dcs_bridge {ready, fe67002…}`; `/health/ready` → ready | 10:16 |
| Каталог отката проверен ДО переключения | `c7fc1f8…`: release.json sha=c7fc1f8, dirty=false, node_modules и server.ts на месте | 10:16 |
| Cutover | `current` → `ee44fcd…`, restart, service active, NRestarts=0 | 10:16 |
| Локальный и публичный `/health`, `/health/ready` | 200: sha `ee44fcd…`, dirty=false, llm_provider ready (routerai), dcs_bridge ready/fe67002 | 10:17 |
| **Реальный публичный user-path (synthetic)** | consent → `/api/calculate` (`engine.py::full_analysis`) → `/api/code-v2` → **Myth 200** (428 слов, qa.passed, 9.6 с) → **Meeting 200** (1 параллель, 6.5 с) → **Albert 200** (1.5 с) | 10:17 |
| Provider path | 2 события, оба `upstream: deepseek`, `outcome: success`, без gateway/provider ошибок; расход 0.32 ₽ | 10:17 |
| Цикл мониторинга | `PREV_OVERALL=healthy`; NRestarts: zerkalo=0, bridge=0, v2-prod=49020 | 10:18 |
| Rollback текущего релиза | `c7fc1f8…` (непосредственный, проверен), второй уровень `7d9e00f…` | — |

## Monitoring

`deploy/health_monitor.sh` + `deploy/zerkalo-health-monitor.{service,timer}`
(инструкция установки: `deploy/PRODUCTION_MONITORING_SETUP.md`). Уведомления
владельцу — только на переходы healthy↔failed и рост NRestarts.

## Known external blockers / risks

- **EXTERNAL_BLOCKED:** GitHub Actions не стартуют из-за биллинг-блокировки аккаунта GitHub (не дефект продукта; release gate — внешний верификатор).
- **Single AI gateway:** все генераторы идут через RouterAI (primary `deepseek/deepseek-v4.1-flash`; fallback-модели Myth/Albert `anthropic/claude-sonnet-5`, Meeting `openai/gpt-5.4-mini` — но всё через один шлюз). Отказ шлюза = контролируемый отказ сервиса, без выдуманных ответов. Второй независимый шлюз — отдельная будущая задача.
- Доступ к прод-хосту из агентной среды отсутствует; серверные действия выполняются из среды владельца с действующим SSH (см. PRODUCTION_MONITORING_SETUP.md).

## History

- 2026-09-20 ~10:16 UTC: **cutover Web на `ee44fcd…`** (+ DCS `fe67002…` без изменений) — provider format compatibility (PR #34: `json_object` transport для frozen primary, нормализация подтверждённой метки Claude-маршрута, bounded headroom Myth 8000). Внешний verifier PASS 11/11, публичный synthetic Myth → Meeting → Albert пройден. Откат: `c7fc1f8…` (непосредственный), `7d9e00f…` (второй уровень).
- 2026-09-18 ~16:24 UTC: **cutover на пару `c7fc1f8…` + `fe67002…`** (operability closure). Мониторинг установлен и проверен. Откат: `7d9e00f…`.
- 2026-09-18 (до полудня): пара `7d9e00f…` (Web) + `fe67002…` (DCS) задеплоена и проверена живым health; DCS `fe67002` = `a3e2fe1` + CI/док-коммиты. Telegram restart-loop (≈49k рестартов из-за удалённого release-каталога) устранён на хосте.
- 2026-09-17: `7d9e00f` — «Fix release identity and restore production CI» (PR-линия #30/#31); DCS `a3e2fe1` — релиз Code V2 journey (PR #106).
- Исторический деплой V1 (2026-07-13): Web `178d22d5…`, DCS `b0a9e7e5…` — см. docs/DIGITAL_CODE_PRODUCT_RELEASE_V1_DEPLOY_RECORD.md.
