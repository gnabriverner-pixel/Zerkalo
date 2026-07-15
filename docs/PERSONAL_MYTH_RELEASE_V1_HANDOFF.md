# Personal Myth Release V1 — execution handoff

## Product promise

Four short answers become an adult literary story for self-reflection. The
story must make all four answers recognizable, open a different view and offer
one small action. It is not therapy, diagnosis, prophecy or an automatic
placeholder.

## Current base and branch

- Base: `origin/main@bbb012505c646976695821f874f1374209b0c8e2`.
- Working branch: `codex/personal-myth-release-v1`.
- Production was previously observed on release `178d22d...`.

## Root cause of the live failure

- Production lacked a valid configured provider for Myth generation.
- The old server pinned a preview Gemini model.
- `/health` did not prove feature readiness.
- Frontend replaced provider/runtime failure with a canned result called
  “Отражение”, making a failure look like a generated story.

## Implemented backend contract

- `POST /api/personal-myth/generate` with four bounded answers, request ID and
  consent version.
- Provider abstraction for DeepSeek and non-preview Gemini.
- Feature, provider and model controlled through environment.
- `/health/live` for process liveness; `/health/ready` for feature readiness.
- Five attempts per IP per ten minutes.
- Thirty-minute idempotency cache by request ID.
- Explicit disabled, unavailable, rate-limit, invalid-input and provider-error
  responses.
- Crisis-language diversion to human support copy.
- 600–900 word literary contract, four answer echoes, one bounded retry and
  deterministic output-quality validation.

## Implemented frontend contract

- Personal Myth has its own first viewport; the Digital Code hero is absent.
- Four questions combine six optional choices with a free-text answer.
- Draft answers persist in local storage.
- Generation calls only `/api/personal-myth/generate`.
- No canned story or fake successful fallback.
- Failure preserves answers and offers retry/edit.
- Result shows the story, visible provenance from four answers, one action and
  one journal question.
- Mobile 390×844 layout was browser-checked without overlap.

## Remaining P0 work

### Provider proof

Configure a real supported provider in a controlled environment:

```text
PERSONAL_MYTH_ENABLED=1
PERSONAL_MYTH_PROVIDER=deepseek
PERSONAL_MYTH_MODEL=<approved current model>
DEEPSEEK_API_KEY=<secret from managed environment>
```

Do not print or commit the key. Run at least twelve synthetic fixtures spanning
different answer lengths and visual keys. Required:

- 12/12 HTTP success or a documented provider-level failure;
- 12/12 quality gate pass after at most one repair;
- four answer echoes present and grounded;
- 600–900 words;
- no forbidden diagnostic/therapeutic language;
- no identical generic opening across the batch.

### Editorial image set

Create six opaque editorial images matching `visual_key`:

- threshold;
- forest_path;
- quiet_room;
- river_crossing;
- night_window;
- open_field.

Art direction: tactile editorial gouache and paper texture, human scale,
specific light and physical detail. No tarot, fantasy magic, stock mysticism,
purple gradients, decorative orbs or text baked into images.

Each image must be useful as a full-width scene, have a calm crop for mobile,
and pass visual inspection at 390/768/1440 px. The result screen selects the
image from the validated server `visual_key`; it never asks the model for a URL.

### Production persistence

The current in-memory idempotency cache and rate limiter reset on restart. They
are acceptable for owner-only proof but not for a public launch. Before public
traffic, persist request status and result metadata in a small append-only
store with expiry and no raw public logs.

## Required tests

```bash
npm ci
npm run lint
npm test -- --run
npm run build
node --import tsx scripts/smoke_personal_myth_provider.ts
git diff --check
```

Browser QA:

1. provider unavailable: no fake story, draft remains;
2. all four question steps on mobile;
3. refresh restores draft;
4. successful provider result shows four grounded echoes;
5. retry does not create a second result for the same request ID;
6. long Russian answers do not overflow;
7. visual key selects the expected local asset.

## Controlled deploy

1. Build a clean release directory from a committed SHA.
2. Install production dependencies from lockfile.
3. Apply managed environment without copying `.env` into the release.
4. Run `/health/live` and `/health/ready` before traffic switch.
5. Run one synthetic generation before owner interaction.
6. Switch systemd atomically and keep the previous release as rollback.
7. Verify service command, active release path and journal errors.
8. Owner runs one complete live Myth flow.

Do not launch publicly if the provider is unavailable, the UI displays a canned
story, or a generated result cannot show how all four answers entered the text.
