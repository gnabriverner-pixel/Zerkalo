# Owner Access Correction Report — Zerkalo V1

- **Final Verdict**: `OWNER_ONLY_DEPLOYMENT_CORRECTION_PASS`
- **Date**: 2026-08-17
- **Target Domain**: `https://zerkalosebya.ru`
- **Security Policy**: `NO_SECRETS_PRINTED=true`

---

## 1. SHA Lineage & Provenance

| Component | SHA | Status |
|---|---|---|
| Canonical `main` | `f4a73769893bdad3ff47d02271cf4e547dd0fbbf` | PR #22 merged |
| Deployed Runtime SHA on Beget | `f4a73769893bdad3ff47d02271cf4e547dd0fbbf` | Exact match (`git rev-parse HEAD`) |
| Runtime Worktree | Clean | 0 modified files |
| Evidence Branch | `evidence/owner-deployment-acceptance-v1` | Non-production evidence branch |

---

## 2. Infrastructure Owner-Only Access Guard

- **Access Guard Type**: HTTP Basic Authentication (`auth_basic` + `auth_basic_user_file`) at Nginx reverse-proxy layer.
- **Config File Modified**: `/etc/nginx/sites-available/zerkalo`
- **Timestamped Backup Path**: `/etc/nginx/sites-available/zerkalo.backup-20260817_153013`
- **Credentials Storage**: Server-side `/etc/nginx/auth/zerkalo-owner.htpasswd` (`0640 root:www-data`), zero credentials in git/reports.
- **Rollback Procedure**:
  ```bash
  ssh root@217.12.37.223 "cp /etc/nginx/sites-available/zerkalo.backup-20260817_153013 /etc/nginx/sites-available/zerkalo && nginx -t && systemctl reload nginx"
  ```
- **Nginx Test (`nginx -t`)**: PASS (`syntax is ok`, `test is successful`)
- **Nginx Reload (`systemctl reload nginx`)**: PASS (`active`)

---

## 3. Access Verification Matrix

### Test A: Unauthorized Root Access
- **Request**: `GET https://zerkalosebya.ru/` (without credentials)
- **Result**: `HTTP/1.1 401 Unauthorized` (`WWW-Authenticate: Basic realm="Zerkalo Owner-Only Area"`)
- **Verdict**: PASS — Unauthorized visitors cannot access or load the Zerkalo SPA bundle.

### Test B: Unauthorized API Access
- **Request**: `POST https://zerkalosebya.ru/api/albert/dialogue` (without credentials)
- **Result**: `HTTP/1.1 401 Unauthorized`
- **Verdict**: PASS — Backend and LLM provider endpoints are completely blocked from unauthorized public access.

### Test C: Authorized Owner Root Access
- **Request**: `GET https://zerkalosebya.ru/` (with owner credentials)
- **Result**: `HTTP/1.1 200 OK` (serves production HTML and assets without redirect loops or TLS errors)
- **Verdict**: PASS

### Test D: Authorized Frontend / API Path
- **Request**: `POST https://zerkalosebya.ru/api/albert/dialogue` (with owner credentials)
- **Result**: `HTTP/1.1 200 OK` (`status: ok`, `provider: deepseek`, `model: deepseek-v4-pro`, valid single-question contract, 148 words)
- **Verdict**: PASS — Authorized owner traffic reaches Node and DeepSeek backend seamlessly.

### Test E: Health & Monitoring Endpoints
- **Request**: `GET https://zerkalosebya.ru/health`
  - Result: `HTTP/1.1 200 OK` (`google_production_dependency: none`, zero secret values)
- **Request**: `GET https://zerkalosebya.ru/health/ready`
  - Result: `HTTP/1.1 200 OK` (`status: ready`, `personal_myth`, `meeting`, `albert` all mapped to `deepseek-v4-pro`)
- **Verdict**: PASS

---

## 4. Runtime Integrity & Security Hygiene

- **Product / Runtime Source Changes**: NONE (`NO_RUNTIME_SOURCE_CHANGES=true`)
- **Secrets Printed / Committed**: NONE (`NO_SECRETS_PRINTED=true`)
- **Active Providers / Models**: DeepSeek `deepseek-v4-pro` on all 3 services
- **Google Production Dependency**: `none`

---

## 5. Findings & Summary

- **BLOCKERS**: NONE
- **MAJORS**: NONE
- **MINORS**: NONE
- **VERDICT**: `OWNER_ONLY_DEPLOYMENT_CORRECTION_PASS`
