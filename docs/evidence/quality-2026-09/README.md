# AI-native quality candidate — 2026-09-10

LOCAL CANDIDATE ONLY. No deployment, push, payment activation or production configuration changes.

## Starting truth

- Web base: `d31d27d6323760a26b897b0646118c2088c600ab`.
- DCS base: `b7cdee5c177f5bddf8acfec46315d115c9e3e037`.
- Accepted reconciliation: `/Users/artemkrysin/Documents/Zerkalo-Independent-Audit/audit/2026-09-reconciliation/`.
- P1/P2 remain accepted production baselines, not reopened. Changes address newly observed output attribution, fallback wording and already identified trust gaps.

## Evidence boundaries

All new personas, dates, names and dialogue artifacts in this directory are explicitly fictional. No production conversations were sampled. No signing secret was recorded. `scripts/quality/run.ts` uses the real canonical Python calculation, Web Myth/Meeting and real DCS Albert orchestrator/provider. It serializes context between WEB and TELEGRAM capability contracts; it does **not** exercise public Telegram transport. Provider model: `deepseek-v4-pro`.

`TECHNICAL_RESULTS.json` is reproducible with `node --import tsx scripts/quality/analyze.ts`. Its checks are mechanical, not an independent semantic verdict. No aggregate score conceals incomplete cases.

## One benchmark, preserved iterations

| Run | Cases | Code | Myth / Meeting | Albert turns | Boundary |
|---|---:|---:|---:|---:|---|
| baseline-18 | 18 | 18 | 16 / 16 | 62 nominal + 2 recovery | Original baseline; its old `complete` label does not exclude recovery. |
| candidate-18 | 18 | 18 | 16 / 16 | 60 nominal + 4 recovery | Exploratory intermediate run. DCS prompt was refined during this run; not final-SHA acceptance. |
| final-18 | 18 | 18 | 11 / 9 | 36 nominal | Nine complete journeys; eight blocked by HTTP 402; one blocked by the subsequently corrected plural-address false positive. |

`baseline/` is an environment/network failure, not a product-quality case. `baseline-live/` is an initial harness probe; its ambiguous “работу” follow-up was corrected in the benchmark, not in the product. `weak-baseline-reproduction/` preserves the two targeted reproductions.

The final run predates the narrow grammatical validation correction (`между вами` / `вы вдвоём` are plural, not polite singular address). Revalidation of the last relationship repair now passes: 555 words / five paragraphs. That does **not** mean its missing Meeting/Albert stages passed. Runtime system/grounding prompts were frozen before `final-18`; no further model calls were made after HTTP 402 became established. The benchmark now stops subsequent cases on terminal authentication/payment responses.

## Findings → bounded changes

1. Existing Code corpus was rendered as settled psychological biography, including an unsafe “психика рассчитана на сверхнагрузки”. Assembly now attributes method interpretations and distinguishes motive, contact, action, application and outcome. Existing arithmetic and knowledge corpus are unchanged. Equal numbers no longer prove unity of personality; different numbers do not prove conflict.
2. Myth scene details became unsupported causal/personality claims in mirror fields, then repeated through Meeting and Albert. Writer/Meeting system contracts and Albert's existing context instructions now keep scene, user report and suggested lens distinct. No evidence status, receipt, memory or send policy is weakened.
3. Repair copied a 282-word story unchanged. The editor now receives actual word count and one delimited draft, including all ancillary fields, with an explicit bounded length correction. Maximum remains one editorial repair.
4. Formal-address detection rejected valid grammatical plural in a relationship scene. Only two explicit plural constructions are excluded; actual formal address in any field remains rejected. Biography checks now inspect ancillary fields too.
5. Albert recovery ended with “вы не против?” even when a user requested no closing question. The failure copy now states that the request was not completed, without a question. Delivery/idempotency machinery is unchanged.
6. Privacy/Terms were SPA fallbacks and inaccurate Myth-only prose. Explicit routes now serve policy documents. Explicit adult/core consent has a signed HttpOnly cookie with server time/version/scope; a separate transfer action is required. API tests reject absent, expired or forged consent. Operator legal identity/contact is still an owner-supplied fact, not fabricated by AI.
7. Authenticated expired transient claim payloads are swept; active shared claim files use 0660/0770; private DCS state uses 0600 and rejects symlink opening. Existing HMAC/TTL/one-time semantics are retained. Production ownership/group compatibility must still be checked before deployment; this pass makes no production chmod.

## Before → after

- Creative baseline: Albert asserted that hesitation came from unwillingness to display unfinished work. Final example: “Встреча зеркал ... добавляет различение: можно выбирать аналитически ...” and offers a different way to inspect a work, rather than claiming a proven motive. The metaphorical “устойчивость” remains an editorial interpretation, not a newly confirmed fact.
- Creative Myth's former “твоя способность ... терпение — твоя сила” becomes “Точный синий оттенок, который уже существует на листе, как материальная опора ...”.
- Baseline calm invitation hit recovery and forgot the painting downstream. Completed final dialogues preserve invitation/name/painting/library/Saturday and contain no requested closing question. This is not a promise of zero future provider failures.
- A grammatical relationship example failed twice despite appropriate singular narrative; current deterministic validation distinguishes explicit plural from formal address. Unit tests preserve rejection of “Вы можете ...”.

## Remaining limits

- Main acceptance blocker: real provider returns HTTP 402; final model validation cannot be completed honestly. Do not auto-fund, rotate credentials or switch provider.
- Operator identity/public privacy contact remains a placeholder pending owner facts. The candidate does not claim legal compliance.
- First Mirror is more source-honest, but repeated method attribution and the generic character of parts of the existing corpus remain editorial limitations, not proof of deep individualized expertise.
- Independent read-only critic supplied concrete baseline findings, but hit its usage limit before a complete final review. No second council or unauthorized usage reset was launched.
- PDF/Personal Book is not a current end-to-end surface of these accepted runtimes. No new artifact product was built.
- Public Telegram candidate acceptance is impossible without deployment, which is forbidden here. Local channel contracts and delivery/idempotency suites provide bounded regression evidence only.

## Commands

Web: `npm run lint`; `npx vitest run` (242 passed after final grammar change); `npm run build`.

DCS: `PYTHONDONTWRITEBYTECODE=1 .venv312/bin/python -B -m pytest -q -p no:cacheprovider test_engine.py tests/test_albert_conversation.py tests/test_albert_truth.py tests/test_quality_store_permissions.py tests/test_telegram_v2*.py tests/test_unified_method_profile_v2.py tests/test_first_mirror_relation_matrix.py tests/test_formula_presenter_single_source.py tests/test_xx_xxi_xxii_are_deterministic_primary.py` — 492 passed, one existing unknown-`asyncio_mode` configuration warning.

Opt-in live benchmark: `QUALITY_LIVE=1 QUALITY_OUTPUT=<new-directory> node --import tsx scripts/quality/run.ts` (never silently overwrites a case).

Isolated stable local UI: `npm run build`, then `QUALITY_STATIC=1 node --import tsx scripts/quality/local-server.ts`; browser suite: `npx playwright test --config playwright.quality.config.ts --project chromium-390 --project chromium-430 --project chromium-1440`. Three sizes passed. Browser provider responses are recorded synthetic outputs; calculation, consent and claim creation use the local real API. Telegram URLs are blocked at the browser boundary. A separate real UI Code/Myth journey completed before provider billing rejection.

Browser setup attempts are not hidden: the bundled Chromium headless executable was missing, so the suite uses installed Chrome. Initial development-server attempts encountered HMR resets; two attempts also missed the real `/api/lab/meeting/generate` route and reached the blocked provider. Both harness issues were corrected before the passing static-build runs. WebKit installation reached the download stage but did not produce an executable after more than nine minutes; its installer was stopped. WebKit/Safari acceptance remains NOT_TESTED, not PASS. Screenshots must wait for modal opacity to reach 1; transition frames are not product UI defects.

## Verdict

`AI_NATIVE_PRODUCT_CANDIDATE_NOT_READY`

The implementation is retained for review, but incomplete real-model acceptance must not be promoted into a release PASS. No next gate is started automatically.
