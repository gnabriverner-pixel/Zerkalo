# Website / Product Metrics V2 — Zerkalo

Status: **measurement contract for PR #12**  
Scope: Website/Product Release V2  
Production analytics destination: **not connected yet**

## 1. Decision this metric system supports

The website should answer one product question before public acquisition:

> Does a visitor reach a meaningful first recognition and then voluntarily continue with a real question?

Do not optimize for pageviews, raw API success, or button clicks in isolation.

The product sequence is:

**Recognition → Image → Meaning → Framework → Action**

The measurement sequence must mirror it.

## 2. Primary KPIs

### KPI A — First Mirror activation rate

**Definition**

`first_mirror_result_viewed / first_mirror_submit`

**Why it matters**

A request is not activation. An HTTP 200 is not activation. The user must actually receive a rendered First Mirror result.

**Interpretation**

- High API success + low result-view rate means rendering, state, navigation, or client errors.
- Low API success + high result-view rate can be acceptable temporarily when the deterministic fallback still produces a meaningful result.
- The numerator is intentionally source-agnostic: generated and fallback results both count as activation because the user receives value.

### KPI B — Qualified continuation rate

**Definition**

`telegram_deep_cta_click(source=first_mirror) / first_mirror_result_viewed`

**Why it matters**

This is the current proof-first commercial transition. The user has already received free value and chooses to bring one real question into Telegram.

This is more meaningful at the current stage than a lead-form submit or payment click because Public Beta and payments remain closed.

### KPI C — Personal Myth completion rate

**Definition**

`personal_myth_generation_succeeded / personal_myth_started`

**Why it matters**

Personal Myth is a separate symbolic product experience. Its success criterion is not question completion but delivery of the final generated story.

## 3. Driver metrics

### First Mirror drivers

1. **Hero-to-submit rate**  
   `first_mirror_submit / hero_primary_cta_click`

2. **Generation request success rate**  
   `first_mirror_generation_succeeded / first_mirror_generation_started`

3. **Generation duration**  
   Median and p95 of `duration_ms` on First Mirror generation outcome events.

### Personal Myth drivers

1. Step completion from 1 → 2 → 3 → 4.
2. Generation success rate after `personal_myth_generation_started`.
3. Median and p95 generation duration.
4. Retry rate after a failed generation.

## 4. Guardrails

### Privacy guardrail — zero sensitive analytics payloads

Hard requirement:

- no date of birth;
- no free-text answers;
- no generated result or story text;
- no name, phone, Telegram handle, email, or other contact data.

The browser event contract uses per-event runtime allowlists. Any future persistence adapter must reuse the same allowlist server-side before storage.

**Target: 0 violations.**

### Reliability guardrail

Do not open paid acquisition while real production journeys are not reproducibly completing.

Internal release gate:

- at least 20 real First Mirror journeys across target mobile/desktop surfaces;
- at least 95% reach `first_mirror_result_viewed` after a valid submit;
- at least 20 real Personal Myth journeys when the feature is enabled;
- at least 90% reach `personal_myth_generation_succeeded`;
- zero critical client/runtime errors in those journeys.

These are release-readiness thresholds, not market conversion benchmarks.

### Experience guardrail

Do not improve Telegram continuation by degrading trust or hiding the free result.

The Telegram CTA must remain after meaningful value is delivered.

## 5. Targets: what is and is not valid now

### Valid now — technical readiness thresholds

Use the reliability thresholds above for owner acceptance and controlled release.

### Not valid yet — business conversion target

Do **not** declare a target such as “20% Telegram conversion” before a baseline exists.

First establish an organic baseline with at least:

- 100 eligible First Mirror result views;
- traffic source recorded at a coarse, non-identifying campaign level if acquisition begins;
- stable production availability during the measurement window.

After that baseline, set a conversion target from observed behavior and the planned acquisition channel.

## 6. Event contract

### First Mirror

`mode_view(code)`  
→ `hero_primary_cta_click`  
→ `first_mirror_submit`  
→ `first_mirror_generation_started`  
→ `first_mirror_generation_succeeded | first_mirror_generation_failed`  
→ `first_mirror_result_viewed`  
→ `telegram_deep_cta_click(source=first_mirror)`

### Personal Myth

`mode_view(myth)`  
→ `personal_myth_availability`  
→ `personal_myth_started`  
→ `personal_myth_step_completed(1..4)`  
→ `personal_myth_generation_started`  
→ `personal_myth_generation_succeeded | personal_myth_generation_failed`

## 7. Storage decision

Current release candidate intentionally keeps the transport vendor-neutral and browser-local:

- `zerkalo:product-event` browser event;
- optional `window.dataLayer` event.

Do not add a production analytics destination until:

1. PR #12 passes code verification and browser QA;
2. production owner acceptance is complete;
3. the persistence location and retention period are explicitly chosen;
4. the same privacy allowlist is enforced again at the storage boundary.

Preferred future architecture:

**browser allowlist → first-party same-origin endpoint → server-side allowlist → append-only event store → derived KPI queries**

The production data path must live outside immutable release directories.

## 8. Weekly decision rules after release

- If activation is low: fix journey reliability before changing marketing.
- If activation is high but Telegram continuation is low: improve the value bridge and CTA context, not traffic volume.
- If Telegram continuation is high but downstream product completion is low: fix the bot/deep journey before scaling acquisition.
- If Personal Myth step completion is high but generation success is low: treat it as a reliability problem, not a content problem.
- If privacy validation fails once: stop persistence until the contract is repaired.

## 9. Current implementation state in PR #12

Implemented:

- privacy-safe event names and per-event payload allowlists;
- First Mirror request telemetry;
- rendered-result activation event;
- Personal Myth funnel telemetry;
- Telegram continuation events from the First Mirror and trust layer.

Not yet implemented:

- persistent analytics storage;
- production dashboard;
- traffic-source attribution;
- verified baseline or business conversion target.
