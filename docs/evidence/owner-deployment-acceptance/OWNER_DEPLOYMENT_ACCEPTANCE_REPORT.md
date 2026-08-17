# Owner-Only Deployment Acceptance Report — Zerkalo V1

- **Final Verdict**: `OWNER_ONLY_DEPLOYMENT_ACCEPTED`
- **Date**: 2026-08-17
- **Target Domain**: `https://zerkalosebya.ru`
- **Public Rollout**: OFF (Owner-only path / invite-only access)

---

## 1. Authority & SHA Provenance

| Role | Git SHA | Notes |
|---|---|---|
| Pre-merge `main` | `eeb308b42e14802f264458f613546d343050f25f` | Base branch prior to PR #22 |
| PR #22 Head | `0b39d01c84e1f5d7ee38594f3519952277a84a95` | Accepted Release QA evidence head |
| Accepted Runtime Target | `25025150a1f28f936f3c152643791316598431ae` | Immutable runtime code target |
| Merge Commit / Main HEAD | `f4a73769893bdad3ff47d02271cf4e547dd0fbbf` | Exact deployed commit |
| Exact Deployed SHA | `f4a73769893bdad3ff47d02271cf4e547dd0fbbf` | Verified via `git rev-parse HEAD` on Beget |

---

## 2. Pre-Deploy State & Rollback Procedure

- **Pre-Deploy Production SHA**: `2eed58e4d38282011bb24b2a1f4ce28a6c1c7818` (release directory `/opt/zerkalo-releases/2eed58e4d38282011bb24b2a1f4ce28a6c1c7818`)
- **Rollback Target Directory**: `/opt/zerkalo-releases/2eed58e4d38282011bb24b2a1f4ce28a6c1c7818`
- **Exact Rollback Procedure**:
  ```bash
  ssh root@217.12.37.223 "ln -sfn /opt/zerkalo-releases/2eed58e4d38282011bb24b2a1f4ce28a6c1c7818 /media/vda1/opt/zerkalo-releases/current && ln -sfn /opt/zerkalo-releases/2eed58e4d38282011bb24b2a1f4ce28a6c1c7818 /opt/zerkalo-releases/current && systemctl restart zerkalo.service"
  ```

---

## 3. Production Deployment Execution

- **Release Location**: `/media/vda1/opt/zerkalo-releases/f4a73769893bdad3ff47d02271cf4e547dd0fbbf`
- **Build**: `npm ci && npm run build` (executed cleanly inside `/media/vda1` chroot)
- **Environment**: Server-side `/etc/zerkalo/production.env` configured with strict permissions (`0640 root:zerkalo`), keeping keys off the client
- **Service & Proxy**: `zerkalo.service` running on port 3001, Nginx reverse-proxies `location /` and `location /api/` to `http://127.0.0.1:3001`
- **No ad hoc runtime code modifications** on Beget

---

## 4. Live Health & Readiness Audit (`https://zerkalosebya.ru`)

### `/health`
- **HTTP Status**: 200 OK
- **Payload**:
  ```json
  {
    "status": "ok",
    "service": "zerkalo",
    "version": "1.0.0-lab",
    "models": {
      "personalMyth": "deepseek-v4-pro",
      "meeting": "deepseek-v4-pro",
      "albert": "deepseek-v4-pro"
    },
    "google_production_dependency": "none"
  }
  ```

### `/health/ready`
- **HTTP Status**: 200 OK
- **Payload**:
  ```json
  {
    "status": "ready",
    "service": "zerkalo",
    "providers": {
      "personal_myth": {
        "ready": true,
        "provider": "deepseek",
        "model": "deepseek-v4-pro",
        "writer": "personal-myth-v1.1-rc"
      },
      "meeting": {
        "ready": true,
        "provider": "deepseek",
        "model": "deepseek-v4-pro"
      },
      "albert": {
        "ready": true,
        "provider": "deepseek",
        "model": "deepseek-v4-pro"
      }
    },
    "google_production_dependency": "none"
  }
  ```

---

## 5. Real-Domain Phone-First Journey (390×844)

Executed against live production domain `https://zerkalosebya.ru`:

1. **Threshold**:
   - Clean dark luxury layout (`01-prod-threshold-390x844.png`)
2. **Personal Myth (Live DeepSeek)**:
   - Status: `ok` | Provider: `deepseek` | Model: `deepseek-v4-pro`
   - Story Title: `Маяк и грозовой фронт`
   - Main Image: `Каменный маяк на скале перед грозой: неподвижная структура, встроенная в стихию, но не сливающаяся с ней.`
   - Screenshot: `02-prod-myth-390x844.png`
3. **Digital Code (15.08.1990)**:
   - Alabaster sanctuary calculation (`6 / 5 / 33 / 3 / 6`)
   - Screenshot: `03-prod-code-390x844.png`
4. **Meeting of Mirrors (Live DeepSeek Synthesis)**:
   - Status: `ok` | Provider: `deepseek` | Model: `deepseek-v4-pro`
   - Resonances: 4 | Divergences: 2
   - Summary: `Два зеркала встретились: одно — строгий расчёт чисел, другое — живые образы, выбранные человеком. Оба отражают поиск равновесия между внутренней структурой и внешней стихией, но с разных ракурсов.`
   - Screenshot: `04-prod-meeting-390x844.png`
5. **Web Albert Dialogue (Live DeepSeek)**:
   - Status: `ok` | Provider: `deepseek` | Model: `deepseek-v4-pro`
   - Output Contract: Valid (157 words, ends with single `?`)
   - Reply preview: `Главная точка опоры между вашим кодом и мифом, как она видится из сопоставления... Как вы сами ощущаете эту грань между «убеждать» и «просто быть»?`
   - Screenshot: `05-prod-albert-390x844.png`
6. **My Mirror Local Save**:
   - Note added, saved to `localStorage` (`06-prod-my-mirror-saved-390x844.png`)
7. **Real Page Reload**:
   - Browser hard reload: non-auto-restore threshold displayed with saved card (`07-prod-reload-saved-390x844.png`)
8. **Explicit Restore & Zero Regeneration Assertion**:
   - Restored cleanly from threshold. Exactly **0 provider calls** made on restore (`08-prod-restored-meeting-390x844.png`)
9. **Restored Albert Request Context & Live Reply**:
   - Outgoing request context verified:
     - `context.meetingSummary` present & > 20 chars (`true`)
     - `context.codeAnchors` present (`true`)
     - `context.mythAnchors` present (`true`)
     - `context.resonances` present (`true`)
     - `context.divergences` present (`true`)
   - Live Albert reply from restored Meeting verified: `deepseek/deepseek-v4-pro`, 143 words, ends with single `?` (`09-prod-restored-albert-390x844.png`)

---

## 6. Desktop Catastrophic Smoke (1440×900)

- Desktop Threshold: `10-prod-desktop-threshold-1440x900.png`
- Desktop Completed Meeting: `11-prod-desktop-meeting-1440x900.png`
- No responsive overflow, no broken assets, clean typography and spacing.

---

## 7. Production Journalctl Log Audit

- Log window inspected from service restart through live tests:
- Clean server startup: `Server running on http://localhost:3001`
- Quality validation filter successfully intercepted template wording during generation and triggered editorial rewrite with 0 client-facing errors.
- Albert validation successfully verified dialogue contract.
- 0 unhandled exceptions, 0 crashes.

---

## 8. Verdict and Next Steps

- **BLOCKERS**: NONE
- **MAJORS**: NONE
- **Final Verdict**: `OWNER_ONLY_DEPLOYMENT_ACCEPTED`
- **Rollout Guard**: Public rollout remains OFF. Any further user rollout requires explicit owner authorization.
