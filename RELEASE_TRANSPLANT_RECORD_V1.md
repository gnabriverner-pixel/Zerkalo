# DIGITAL CODE PRODUCT RELEASE V1 — SITE TRANSPLANT

Status: `CANDIDATE_FROM_CANONICAL_MAIN`.

## Lineage

- base: `main@6d9f689be581fb9a50caeb5a8acf4e93ffa713e2`;
- source trust-layer commit: `1f62a2c8072a1f6476904e668d9b1bf07875b8dc`;
- integration branch: `codex/digital-code-product-release-v1-main`.

The source feature branch was not merged. Its 26 feature-only commits were not imported.

## Included scope

- transparent Albert positioning;
- Free to Deep value proposition;
- compound-route example `35/8`;
- exact V1 product promise;
- voluntary seven-day route wording;
- honest external LLM disclosure;
- privacy copy and link;
- canonical Telegram CTA;
- focused regression tests.

## Baseline compatibility fix

Current `main` returned a fifth `resonance` block from `generateFirstMirror()`, while `FirstMirror.blocks` and the canonical test require exactly four public blocks. That pre-existing mismatch failed both TypeScript lint and the test suite. The transplant removes only the unsupported fifth block; it does not weaken the type or test.

Browser proof also found a real `favicon.ico` 404 and an incorrect `lang="en"` baseline. The release adds an explicit favicon and declares the document language as Russian; no product layout or flow changes are involved.

Selecting a date from the calendar also exposed a pre-existing `onChangeRaw` crash when the date-picker emitted no text-input event. The handler now ignores that event shape, while typed dates keep the same normalization. A focused regression test covers both paths.

## File manifest

- `public/albert-guide.png`;
- `public/favicon.svg`;
- `public/privacy.html`;
- `index.html`;
- `server.ts`;
- `src/App.tsx`;
- `src/components/BigResearchTeaser.tsx`;
- `src/components/CodeArchitecture.tsx`;
- `src/components/LeadModal.tsx`;
- `src/components/ProductTrustLayer.tsx`;
- `src/components/ProductTrustLayer.test.tsx`;
- `src/lib/dateInput.ts`;
- `src/lib/dateInput.test.ts`;
- `src/services/interpretation.ts`.

No Personal Myth, provider/model, pricing, payment or unrelated feature code is included.

## Required verification

- `npm ci`;
- `npm run lint`;
- `npm test`;
- `npm run build`;
- browser proof on mobile, tablet and desktop;
- CTA, privacy, navigation, links, console and overflow checks;
- `git diff --check`.
