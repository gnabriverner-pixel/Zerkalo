# CANONICAL ENGINEERING TRUTH — ZERKALO (WEB) & DIGITAL CODE SYSTEM (DCS)

> **Authority**: CAMPAIGN-T3 Canonical Reality Foundation  
> **Status**: APPROVED & ACTIVE  
> **Last Empirical Verification**: 2026-09-20T19:33:00Z  
> **Governing Repositories**: `/Users/artemkrysin/code/Zerkalo` & `/Users/artemkrysin/code/digital-code-system`

---

## 1. Executive Quick Reference (< 2 Minutes)

### The 10 Canonical Questions Answered

| # | Question | Canonical Answer |
|---|---|---|
| **Q1** | **What is the canonical Web repository and its authoritative active branch?** | `/Users/artemkrysin/code/Zerkalo` on branch `main` (current HEAD `22ea2b7189de351a80cb14b67997608fa17a4ae9`). |
| **Q2** | **What is the canonical DCS repository and its authoritative active branch?** | `/Users/artemkrysin/code/digital-code-system` on branch `release/routerai-acceptance` (current HEAD `bd7827809b113f2fe057b7298ae381e648a28e36`). *Note: DCS `main` is at `2f5dd37`, 32 commits behind the active release line.* |
| **Q3** | **What is currently deployed and running in production?** | Live at `https://zerkalosebya.ru`: Web `ee44fcda9b0bbf0289cb9b54349e0c2a1065eaca` paired with DCS `fe67002ce2a2f9d05fa9faf205ef45264f05a931`. Cutover completed 2026-09-20 ~10:16 UTC. |
| **Q4** | **How does deployed production differ from current repository HEADs?** | Web production (`ee44fcd`) lacks the approved in-memory cache lifecycle hardening (PR #35 / #36, 1310 additions on `main` at `22ea2b7`). DCS production (`fe67002`) is 1 doc commit behind current branch HEAD (`bd78278`). |
| **Q5** | **What is the production rollback chain?** | Level 1 (immediate host fallback): Web `c7fc1f8d6c87f44bab86b54d7622c8cd56c97cc1` (verified pre-cutover, `dirty=false`). Level 2: Web `7d9e00f08e9c65167d8e40195f2d5bd1bfd63cd1`. |
| **Q6** | **What is the canonical calculation engine authority?** | Python `engine.py::full_analysis` in `digital-code-system`, invoked via HTTP bridge `POST /api/calculate`. Web `src/services/calculator.ts` is a pure presentation mirror. |
| **Q7** | **What is the AI provider architecture?** | **RouterAI** (`https://routerai.ru/api/v1`) using `ROUTERAI_API_KEY`. Primary model: `deepseek/deepseek-v4.1-flash`. Fallback: `anthropic/claude-sonnet-5`. Direct DeepSeek (`DEEPSEEK_API_KEY`) is completely superseded; no automatic client fallback exists. |
| **Q8** | **What are the canonical runtime toolchains?** | Web: Node.js (Dev: `v26.7.0`, Verification/CI: `v24.15.0`, Prod: `v22.23.2`), npm 11.19.0, TypeScript 5.5, Vite 5, Vitest. DCS: Python 3.12 (`/opt/homebrew/bin/python3.12`), pip (`requirements.txt`), Pytest. |
| **Q9** | **How should agents handle legacy/stale locations across the filesystem?** | 17 legacy/stale sites exist (e.g. `~/Zerkalo`, `digital-code-product-journey`, `Hermes_agent`). They are strictly READ-ONLY historical references. Runtimes must fail closed if canonical paths are missing; NEVER fall back to legacy paths. NEVER delete legacy directories. |
| **Q10** | **What are the inviolable safety invariants?** | NO deploy, NO production mutations or write calls, NO live payment/Telegram flows, NO deleting old clones or user files, NO worktree pruning, NO changing secrets, NO DCS methodology shifts, Untracked `data/claims/` preserved untouched. |

---

## 2. Structural Truth vs. Snapshot Truth

Engineering reality must clearly separate **Structural Truth** (persistent invariants that govern the system across time) from **Snapshot Truth** (point-in-time states verified by empirical audit).

### 2.1 Structural Truth (Persistent Invariants)

1. **Repository Topology**:
   - Web application frontend and API gateway live in `Zerkalo`.
   - Backend numerology calculation engine, knowledge base, and bot continuity live in `digital-code-system`.
   - Canon methodology, research texts, and visual assets live in `Documents/Digital_Code_Hub`.
2. **Authority Hierarchy**:
   - Calculation engine authority is DCS `engine.py`. Web `calculator.ts` must mirror `engine.py`, never define divergent algorithms.
   - Production deployment authority is governed by `scripts/release_verifier.sh` and immutable release pair pinning in `release-compatibility.json`.
3. **Security & Privacy Boundary**:
   - Zero-PII architecture: No dates of birth or personal user data stored in persistent databases.
   - Session continuity uses single-use HMAC-signed claims tokens and in-memory TTL caching with explicit data purge endpoints (`/api/delete-data`).
4. **AI Gateway Integration**:
   - Single gateway policy: All LLM traffic routes through RouterAI (`https://routerai.ru/api/v1`).
   - Direct provider endpoints (e.g., `api.deepseek.com`, Gemini API) are forbidden in production flows.
5. **Path Resolution Rule**:
   - Fail-closed runtime discovery: If canonical paths or sibling checkouts are unavailable, components must abort immediately with descriptive configuration errors. Silent fallback to historical or foreign clones is strictly prohibited.

### 2.2 Snapshot Truth (Empirically Verified as of 2026-09-20T19:33:00Z)

| Parameter | Empirically Verified State | Evidence Source |
|---|---|---|
| **Web Canonical Path** | `/Users/artemkrysin/code/Zerkalo` | Filesystem & Git Remote |
| **Web Branch & HEAD** | `main` @ `22ea2b7189de351a80cb14b67997608fa17a4ae9` | `git rev-parse HEAD` |
| **Web Remote Origin** | `https://github.com/gnabriverner-pixel/Zerkalo.git` | `git remote -v` |
| **DCS Canonical Path** | `/Users/artemkrysin/code/digital-code-system` | Filesystem & Git Remote |
| **DCS Branch & HEAD** | `release/routerai-acceptance` @ `bd7827809b113f2fe057b7298ae381e648a28e36` | `git rev-parse HEAD` |
| **DCS Remote Origin** | `https://github.com/gnabriverner-pixel/digital-code-system.git` | `git remote -v` |
| **DCS Untracked State** | `data/claims/` (4 JSON files, untouched) | `git status` |
| **Production Cutover Time** | 2026-09-20 ~10:16 UTC | Host deployment logs & manifests |
| **Production Web SHA** | `ee44fcda9b0bbf0289cb9b54349e0c2a1065eaca` | `DEPLOYMENT_MANIFEST.md` |
| **Production DCS SHA** | `fe67002ce2a2f9d05fa9faf205ef45264f05a931` | `DEPLOYMENT_MANIFEST.md` |
| **Release Verifier Run** | `evidence/verify-20260920-093841-rc-ee44fcd/` (11/11 PASS, 387s) | `report.json` |
| **Active Python Runtime** | `/opt/homebrew/bin/python3.12` (Python 3.12.13) | `python3 --version` |
| **Active Node Runtime** | `v26.7.0` (Dev) / `v24.15.0` (Canonical Verifier) / `v22.23.2` (Host) | Runtime inspection |

---

## 3. Authoritative Clarification of the Three Separated States

A primary source of engineering confusion has been conflating development HEADs with deployed code. The system exists in three mutually exclusive, verified states:

```
[State 1: Repository Main HEAD]
  Web: main @ 22ea2b7 (Merged PR #35 & #36)
  DCS: release/routerai-acceptance @ bd78278
        │
        ▼ (Code changes merged to main, but unreleased)
[State 2: Approved-but-not-deployed T1/T2]
  Web: 10 commits ahead of prod (11 files, +1310 / -39)
       - PR #35: Privacy DOB cache deletion & trust boundary
       - PR #36: In-memory HMAC cache, TTL, LRU eviction
  DCS: 1 doc commit ahead of prod (STATUS.md reality block)
        │
        ▼ (NOT YET PROMOTED TO PRODUCTION)
[State 3: Deployed Production Release]
  Web: ee44fcda9b0bbf0289cb9b54349e0c2a1065eaca
  DCS: fe67002ce2a2f9d05fa9faf205ef45264f05a931
  Domain: https://zerkalosebya.ru
  Cutover: 2026-09-20 ~10:16 UTC
```

### State 1: Repository Current Main / Active Development Line
- **Web**: Branch `main` at `22ea2b7189de351a80cb14b67997608fa17a4ae9`. Clean working tree.
- **DCS**: Branch `release/routerai-acceptance` at `bd7827809b113f2fe057b7298ae381e648a28e36`.
  *Note on DCS branches*: The historical `main` branch in DCS is at `2f5dd37`, which is 32 commits behind `release/routerai-acceptance`. The active development and deployment authority for DCS is strictly `release/routerai-acceptance`.

### State 2: Approved-but-not-deployed Changes (T1/T2)
- **Web Delta**: 10 commits (11 files changed, 1310 insertions, 39 deletions) between production `ee44fcd` and current main `22ea2b7`.
  - **T1 Scope (PR #35)**: Commits `ba7bc4d`, `57c1b62`, `4a48d29` — purges user caches upon data deletion requests (`/api/delete-data`), tightens session registration trust boundary, isolates parallel test states.
  - **T2 Scope (PR #36)**: Commits `22ea2b7`, `8e1d32c`, `0c088ec` — implements `server/cache.ts` providing an in-memory cache lifecycle with HMAC key derivation, strict TTL expiration, bounded LRU eviction, and adversarial unit tests.
- **DCS Delta**: 1 commit (`bd78278`) ahead of production `fe67002`, adding the dated production reality block in `STATUS.md`.
- **Release Status**: These changes are thoroughly tested and merged into git, but **they have NOT been packaged or deployed to the production host**. The production VPS continues to run `ee44fcd` + `fe67002`.

### State 3: Actually Deployed Production Release
- **Web Commit**: `ee44fcda9b0bbf0289cb9b54349e0c2a1065eaca`
- **DCS Commit**: `fe67002ce2a2f9d05fa9faf205ef45264f05a931`
- **Host Location**: Immutable release directory `/media/vda1/opt/zerkalo-releases/ee44fcda9b0bbf0289cb9b54349e0c2a1065eaca/` running via systemd unit `zerkalo.service`, with backend `digital-code-bridge.service`.
- **Pre-Cutover Verification**: Completed on 2026-09-20T09:38:41Z via `scripts/release_verifier.sh`. Passed all 11 integration and compatibility checks in 387 seconds (evidence in `evidence/verify-20260920-093841-rc-ee44fcd/`).
- **Production Rollback Chain**:
  - **Level 1 (Immediate Host Rollback)**: Web `c7fc1f8d6c87f44bab86b54d7622c8cd56c97cc1` (verified pre-cutover state present on the production filesystem).
  - **Level 2 (Secondary Fallback)**: Web `7d9e00f08e9c65167d8e40195f2d5bd1bfd63cd1`.

---

## 4. Runtime Toolchains & Bridge Configuration

### 4.1 Web Application Toolchain
- **Node.js**:
  - Local Dev / Test: `v26.7.0`
  - Canonical Verification & CI: `v24.15.0`
  - Production Host Runtime: `v22.23.2`
- **Package Manager**: `npm 11.19.0`
- **Core Scripts**:
  - Development: `npm run dev` (`tsx server.ts`)
  - Production start: `npm start` (`NODE_ENV=production tsx server.ts`)
  - Build: `npm run build` (`vite build` -> output in `dist/`)
  - Typecheck: `npm run lint` or `npx tsc --noEmit`
  - Tests: `npm test` (`vitest run`)
- **Vitest Suite**: 40 passed test files, 363 passed unit and integration tests.

### 4.2 DCS Calculation Engine Toolchain
- **Python Runtime**: `Python 3.12.13` (canonical interpreter: `/opt/homebrew/bin/python3.12`).
- **Dependency Management**: Standard `pip` and `requirements.txt`.
- **Pytest**: `pytest` (1,064 unit, integration, and architecture contract tests in `tests/`).
- **Webapp (`webapp/`)**: Embedded React 18 / Vite 5 app. Note: `node_modules` is not committed; running webapp tests locally requires running `npm ci` inside `webapp/`.

### 4.3 DCS Bridge Communication Architecture
Web connects to DCS to perform Vedic numerology calculations and continuity handling:
- **Canonical Bridge Script**: `integration/zerkalo_bridge.py` or HTTP service `integration/dcs_service.py`.
- **Environment Variables**:
  - `DCS_ROOT`: Root of the DCS repository.
    * In production: Injected by systemd service.
    * In test mode (`tests/setup.ts`): Resolves to canonical sibling `path.resolve(process.cwd(), "..", "digital-code-system")`.
    * In runtime (`server/dcsBridge.ts`): Must resolve strictly to `process.env.DCS_ROOT` or canonical sibling `../digital-code-system`.
  - `PYTHON_BIN`: Python interpreter executable (canonical: `/opt/homebrew/bin/python3.12` or `python3`).
  - `DCS_BRIDGE_URL`: HTTP endpoint for the running DCS daemon (default: `http://127.0.0.1:39500`).
- **Fail-Closed Resolution Rule**:
  If `DCS_ROOT` is unset and the canonical sibling directory does not exist, the bridge must throw an explicit error immediately. Falling back to legacy directories (`digital-code-product-journey`) is strictly prohibited.

---

## 5. AI Provider Architecture (RouterAI)

All dynamic LLM text generation (Albert dialogue, Personal Myth interpretations, Meeting of Mirrors) is unified under **RouterAI**:

```
[Web Application / DCS Albert Bot]
               │
      (ROUTERAI_API_KEY)
               ▼
   https://routerai.ru/api/v1
        ├── Primary: deepseek/deepseek-v4.1-flash
        └── Fallback: anthropic/claude-sonnet-5
```

- **Single Gateway Endpoint**: `https://routerai.ru/api/v1`
- **Authentication Key**: `ROUTERAI_API_KEY` (mandatory in environment).
- **Primary Model**: `deepseek/deepseek-v4.1-flash` (fast, cost-effective, high instruction adherence).
- **Fallback Model**: `anthropic/claude-sonnet-5` (configured in router backend).
- **Elimination of Direct Provider Fallbacks**:
  - Web client (`server/routerai.ts`) and DCS client (`telegram_v2/albert/routerai.py`) require `ROUTERAI_API_KEY`.
  - Claims in older documentation that the client automatically falls back to `DEEPSEEK_API_KEY` are **false and refuted by code**: `load_routerai_settings` strictly raises an error if `ROUTERAI_API_KEY` is missing.
  - Direct DeepSeek endpoints (`https://api.deepseek.com`) are obsolete and disabled.

---

## 6. Authoritative Documentation Registry

Only the following documents reflect active, canonical engineering truth. All other documents are either historical artifacts or superseded specifications:

### Web Repository (`/Users/artemkrysin/code/Zerkalo`)
1. `docs/CANONICAL_ENGINEERING_TRUTH.md`: This document. Authoritative operational and architectural foundation.
2. `docs/ENGINEERING_DRIFT_REGISTRY.md`: Comprehensive drift item catalog with status, severity, and resolution.
3. `DEPLOYMENT_MANIFEST.md`: Authoritative record of live production deployment, cutover time, and rollback chain.
4. `release-compatibility.json`: Versioned manifest pinning the production release pair.
5. `AGENTS.md`: Agent operating rules, tool routing, and communication protocols.
6. `README.md`: Developer onboarding, scripts, and setup commands.

### DCS Repository (`/Users/artemkrysin/code/digital-code-system`)
1. `docs/CANONICAL_ENGINEERING_TRUTH.md`: Synchronized copy of this authoritative foundation.
2. `docs/ENGINEERING_DRIFT_REGISTRY.md`: Synchronized copy of the drift registry.
3. `STATUS.md`: Authoritative repository status, active branch definition, and production pairing notes.
4. `AGENTS.md`: Agent instructions and file read hierarchy.
5. `CLAUDE.md`: Developer commands, test targets, and branch contracts.
6. `README.md`: Project overview and active line declaration.

---

## 7. Catalog of 17 Mapped Legacy & Stale Locations

The filesystem contains 17 legacy clones, worktrees, and experimental sandboxes. They are classified below with mandatory safety fallback rules:

| ID | Location | Classification | Description & Drift Risk | Mandatory Handling Rule |
|---|---|---|---|---|
| **SITE-01** | `/Users/artemkrysin/Zerkalo` | `STALE` | April 2026 clone (143 commits behind `origin/main`). | NEVER target from runtimes or agents. |
| **SITE-02** | `/Users/artemkrysin/Documents/New project/digital-code-product-journey` | `LEGACY_REFERENCE_ONLY` | Stale DCS clone from Sep 15. Previous erroneous fallback in `dcsBridge.ts`. | READ-ONLY historical reference. NEVER use as runtime target. |
| **SITE-03** | `/Users/artemkrysin/Documents/New project/digital-code-system-albert-guardrails-v1` | `LEGACY_REFERENCE_ONLY` | Local clone for Albert guardrails experiments (Aug 20). | READ-ONLY historical reference. |
| **SITE-04** | `/Users/artemkrysin/Documents/New project/zerkalo-routerai-rc` | `LEGACY_REFERENCE_ONLY` | Release candidate snapshot clone (commit `7d9e00f`). | READ-ONLY historical reference. |
| **SITE-05** | `/Users/artemkrysin/Documents/New project/routerai-release-acceptance-2026-09` | `LEGACY_REFERENCE_ONLY` | Static acceptance audit logs and spend records (Sep 13). | READ-ONLY historical reference. |
| **SITE-06** | `/Users/artemkrysin/Documents/Hermes_agent` | `LEGACY_REFERENCE_ONLY` | Historic multi-project scratchpad containing old prompts and scripts. | READ-ONLY historical reference. |
| **SITE-07** | `/Users/artemkrysin/Documents/Hermes_agent/digital-code-canonical-v3-owner-only` | `STALE` | May 2026 snapshot on `codex/autonomous-owner-candidate-v1`. | Mis-referenced by Gemini skill; fix skill to point to canonical. |
| **SITE-08** | `/Users/artemkrysin/Documents/Hermes_agent/ecliptic-hypernova` | `STALE` | Pre-DCS codebase name from June 2026. | READ-ONLY historical reference. |
| **SITE-09** | `/Users/artemkrysin/Documents/Hermes_agent/zerkalo-lab` | `STALE` | Legacy Web clone. Erroneously targeted by older DCS test scripts for `.env`. | READ-ONLY historical reference. Update scripts to canonical Web. |
| **SITE-10** | `/Users/artemkrysin/Documents/Archive_Zerkalo_Old` | `STALE` | Archived broken worktree stubs and releases. | READ-ONLY archive. |
| **SITE-11** | `/Users/artemkrysin/Documents/Digital_Code_Hub` | `ACTIVE_SUPPORTING` | Central repository for canon methodology (`01_CANON`), PDFs, and design assets. | ACTIVE REFERENCE for methodology and canon. |
| **SITE-12** | `/Users/artemkrysin/Documents/Zerkalo-Independent-Audit` | `ACTIVE_SUPPORTING` | Historical audit reports, adversarial tests, and human QA packs. | ACTIVE REFERENCE for audit history. |
| **SITE-13** | `/Users/artemkrysin/Documents/ZERKALO — AUDIT` | `ACTIVE_SUPPORTING` | Working directory for CAMPAIGN-T3 audit orchestration. | ACTIVE CAMPAIGN WORKSPACE. |
| **SITE-14** | `/Users/artemkrysin/code/digital-code-system-reliability-backport-v1` | `LEGACY_REFERENCE_ONLY` | Linked DCS worktree for PR #87 reliability backports. | READ-ONLY reference. |
| **SITE-15** | `/Users/artemkrysin/code/digital-code-system-semantic-v1` | `LEGACY_REFERENCE_ONLY` | Linked DCS worktree checked out on divergent `main`. | READ-ONLY reference. |
| **SITE-16** | `/Users/artemkrysin/code/digital-code-system-sonnet-v1` | `LEGACY_REFERENCE_ONLY` | Linked DCS worktree for vertical slice experiments. | READ-ONLY reference. |
| **SITE-17** | `/Users/artemkrysin/code/digital-code-web` | `LEGACY_REFERENCE_ONLY` | Standalone frontend repo prior to consolidation into `Zerkalo`. | READ-ONLY reference. |

### Safety Fallback Rules for Legacy Locations:
1. **No Deletion**: NEVER automatically delete, move, or prune legacy clones or worktrees.
2. **Fail-Closed Resolution**: Runtime scripts and tests must fail closed with an explicit error if canonical paths are missing, rather than falling back to any of these 17 locations.
3. **Agent Isolation**: AI agents must be bound exclusively to canonical `/Users/artemkrysin/code/Zerkalo` and `/Users/artemkrysin/code/digital-code-system`.

---

## 8. Hard Safety Invariants

Every human developer and AI agent working on this codebase is bound by the following non-negotiable rules:

1. **NO Deploy**: No deploy commands (`systemctl`, SSH commands, `rsync`, deploy scripts, Docker build/push) may be executed.
2. **NO Production Mutations**: No write calls to live endpoints, APIs, or databases.
3. **NO External Traffic**: No live payment, live Telegram bot webhook calls, or live user flows.
4. **NO Deletion of Legacy Locations**: No deletion or automated pruning of old clones, worktrees, or user data.
5. **NO Worktree Pruning**: Do not run `git worktree prune`.
6. **NO Credential Mutation**: Do not alter, rotate, or expose secrets, API keys, or bot tokens.
7. **NO Methodology Shifts**: Do not alter Vedic numerology algorithms, compound number meanings, or calculation formulas in DCS.
8. **NO Architecture Shifts without Blocker**: Do not change the privacy boundary, in-memory cache design, or RouterAI integration.
9. **Untracked DCS Data Preserved**: Untracked files in `data/claims/` in DCS must remain untouched (neither staged, committed, nor deleted).
10. **Dedicated Branch Delivery**: All changes must be made on dedicated branches (`chore/canonical-engineering-truth`). No direct commits to `main` or `release/routerai-acceptance`; open Pull Requests only.
