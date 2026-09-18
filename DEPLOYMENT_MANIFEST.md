# DEPLOYMENT MANIFEST — Zerkalo / Digital Code (production pair)

> Единственная точка правды о текущей производственной паре. Обновляется
> каждым деплоем; исторические SHA не переписываются, а сохраняются ниже
> с датами (см. History). Актуальность сверяется с живым `/health`
> на zerkalosebya.ru и GitHub refs.

## Current production pair

| Component | Repo | Branch | SHA |
|-----------|------|--------|-----|
| Web (zerkalosebya.ru) | gnabriverner-pixel/Zerkalo | `main` | `7d9e00f08e9c65167d8e40195f2d5bd1bfd63cd1` |
| DCS bridge + Telegram | gnabriverner-pixel/digital-code-system | `release/routerai-acceptance` | `fe67002ce2a2f9d05fa9faf205ef45264f05a931` |

- Дата фиксации пары: 2026-09-18
- **Redeploy pending:** `main` продвинулся дальше задеплоенного `7d9e00f` (operability pass: честный health, верификатор, CI-pairing, мониторинг — без продуктовых изменений). Продолжает обслуживаться `7d9e00f`, пока владелец не передеплоит; после редеплоя обновить строку Web SHA выше.
- `/health` и `/health/ready` на проде возвращают Web SHA `7d9e00f…`, `dirty:false` (проверено 2026-09-18)
- Verified пара продублирована в [`release-compatibility.json`](release-compatibility.json) — его читает CI
- Release gate: внешний верификатор `scripts/release_verifier.sh` (GitHub Actions помечены `EXTERNAL_BLOCKED: GitHub account billing lock`; отсутствие зелёного Actions-рана не является дефектом проверенного SHA)

## Verification commands

```bash
# Локально (те же шаги, что в CI):
scripts/verify_release_local.sh

# Внешний verifier на точной паре (JSON+MD evidence, fail-closed):
scripts/release_verifier.sh --web-sha 7d9e00f08e9c65167d8e40195f2d5bd1bfd63cd1 \
                            --dcs-sha fe67002ce2a2f9d05fa9faf205ef45264f05a931
```

## Rollback

Релизные каталоги на хосте иммутабельны (`/opt/zerkalo-releases/<sha>`,
`/opt/digital-code-releases/<sha>`, см. docs/DIGITAL_CODE_PRODUCT_RELEASE_V1_DEPLOY_RECORD.md
для V1-паттерна). Rollback = переключение symlink сервиса на предыдущий
каталог релиза + рестарт юнита; БД и runtime-стейт живут вне релизных каталогов.
Точные команды для среды с SSH: `deploy/rollback.sh` (проверить соответствие
каталогов перед исполнением).

### Post-deploy acceptance (деплой Web `c7fc1f8…`, monitor из `a4bd2d5`)

Основание: верификатор PASS на паре `c7fc1f8` + `fe67002` (см.
`evidence/verify-20260918-180847/`); `a4bd2d5` отличается от `c7fc1f8`
только фиксом `deploy/health_monitor.sh` и evidence — продуктового кода не
меняет. Откат — каталог `7d9e00f…`.

```bash
# 1. Локально на сервере, после переключения symlink и рестарта:
curl -fsS http://127.0.0.1:<port>/health | python3 -m json.tool
#   Ожидаемо: release_sha c7fc1f8…, dirty:false,
#   components.dcs_bridge = {"state":"ready","sha":"fe67002…"} (мост на старом SHA fe67002).
# 2. Public:
curl -fsS https://zerkalosebya.ru/health/ready | python3 -m json.tool
#   Ожидаемо: status ready, checks.llm_provider.ready=true, checks.dcs_bridge.state=ready.
# 3. Мониторинг (после установки по PRODUCTION_MONITORING_SETUP.md):
/usr/local/bin/zerkalo-health-monitor.sh && echo OK   # rc=0, переходов нет
# 4. Smoke генерации через публичный API (consent → /api/calculate) — путь пользователя не менялся.
```

## Monitoring

`deploy/health_monitor.sh` + `deploy/zerkalo-health-monitor.{service,timer}`
(инструкция установки: `deploy/PRODUCTION_MONITORING_SETUP.md`). Уведомления
владельцу — только на переходы healthy↔failed и рост NRestarts.

## Known external blockers / risks

- **EXTERNAL_BLOCKED:** GitHub Actions не стартуют из-за биллинг-блокировки аккаунта GitHub (не дефект продукта; release gate — внешний верификатор).
- **Single AI gateway:** все генераторы идут через RouterAI (primary `deepseek/deepseek-v4.1-flash`; fallback-модели Myth/Albert `anthropic/claude-sonnet-5`, Meeting `openai/gpt-5.4-mini` — но всё через один шлюз). Отказ шлюза = контролируемый отказ сервиса, без выдуманных ответов. Второй независимый шлюз — отдельная будущая задача.
- Доступ к прод-хосту из агентной среды отсутствует; серверные действия выполняются из среды владельца с действующим SSH (см. PRODUCTION_MONITORING_SETUP.md).

## History

- 2026-09-18: пара `7d9e00f…` (Web) + `fe67002…` (DCS) задеплоена и проверена живым health; DCS `fe67002` = `a3e2fe1` + CI/док-коммиты. Telegram restart-loop (≈49k рестартов из-за удалённого release-каталога) устранён на хосте.
- 2026-09-17: `7d9e00f` — «Fix release identity and restore production CI» (PR-линия #30/#31); DCS `a3e2fe1` — релиз Code V2 journey (PR #106).
- Исторический деплой V1 (2026-07-13): Web `178d22d5…`, DCS `b0a9e7e5…` — см. docs/DIGITAL_CODE_PRODUCT_RELEASE_V1_DEPLOY_RECORD.md.
