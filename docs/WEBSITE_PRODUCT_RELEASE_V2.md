# Website / Product Release V2 — Zerkalo

Status: **DRAFT IMPLEMENTATION TRAIN**  
Branch: `product/website-release-v2-foundation`  
Production deploy: **NOT INCLUDED**

## 1. Product objective

Move `zerkalosebya.ru` from a technically capable calculator/interface to a coherent product experience built around:

**Recognition → Image → Meaning → Framework → Action**

The first-time user must understand the human value before being asked to learn internal numerical terminology.

Golden standard:

**ВКУС × ЭМПАТИЯ × СМЫСЛ**

## 2. Current canonical reality

At source level, Personal Myth real generation is already merged to `main` through PR #11. The site also has a trust/privacy layer and a real Telegram continuation path.

This release train does not replace that work. It adds the product layer needed to answer four questions:

1. Does a new visitor understand the product in the first screen?
2. Does the user reach a meaningful first result?
3. Can we measure where people stop without collecting sensitive content?
4. Does the site create a credible path from free value to a live question in Telegram?

## 3. Release V2 scope

### A. Product Design

1. Rename the primary mode from internal language (`Архитектура`) to user value (`Первое зеркало`).
2. Rebuild the hero around recognition before framework.
3. Keep the formula as evidence, not as the first promise.
4. Preserve Personal Myth as a separate symbolic experience, not a generic AI-story feature.
5. Maintain explicit trust boundaries: no diagnosis, no prediction, no fake human expert.

### B. Data Analytics

Introduce a privacy-safe, vendor-neutral event contract.

Events implemented in the foundation pass:

- `mode_view`
- `hero_primary_cta_click`
- `telegram_deep_cta_click`
- `privacy_link_click`
- `personal_myth_availability`
- `personal_myth_started`
- `personal_myth_step_completed`
- `personal_myth_generation_started`
- `personal_myth_generation_succeeded`
- `personal_myth_generation_failed`
- `personal_myth_restarted`

Hard rule: analytics must never include date of birth, free-text answers, generated report text, names, phone numbers, Telegram handles, or contact data.

The event layer emits both:

- `window` event: `zerkalo:product-event`
- optional `window.dataLayer` event: `zerkalo_product_event`

This keeps the product independent from a specific analytics vendor.

### C. Sales / conversion architecture

Primary funnel:

1. Land on site.
2. Understand the promise.
3. Generate the free First Mirror.
4. See method/trust layer.
5. Continue with one real question in Telegram.
6. Only then encounter the deeper paid offer when product acceptance and payments are ready.

The site should not lead with price or pressure. The sales mechanism is proof-first:

**recognition → trust → question → deeper work**

Primary conversion event for the current stage:

`telegram_deep_cta_click`

Secondary activation events:

- Hero CTA click.
- First Mirror completion.
- Personal Myth completion.

## 4. Measurement model

### North-star activation

A user receives a meaningful result, not merely a rendered screen.

For the website this becomes two activation paths:

- First Mirror completed.
- Personal Myth generation succeeded.

### Funnel metrics

#### First Mirror funnel

`mode_view(code)` → `hero_primary_cta_click` → date/consent submit → First Mirror result → Telegram CTA

The date/consent submit and First Mirror success events still need instrumentation inside `CodeArchitecture.tsx` in the next bounded pass.

#### Personal Myth funnel

`mode_view(myth)` → `personal_myth_started` → step 1 → step 2 → step 3 → step 4 → generation started → generation succeeded/failed

Metrics:

- start rate;
- completion rate per question;
- generation success rate;
- median generation duration;
- retry rate;
- restart rate.

### Decision thresholds before public acquisition

Do not buy traffic until:

- real production generation succeeds end-to-end;
- analytics events are visible in the chosen analytics destination;
- error rate is measurable;
- mobile QA passes at 390 px;
- the primary CTA path is stable.

## 5. Visualize layer

Use visualization for meaning, not decoration.

Priority visual modules for the next product pass:

1. **Five-position route map**  
   Human function first, number second.

2. **Compound route visual**  
   Example: `35 → 8` as a sequence of movement rather than a label.

3. **Result provenance block**  
   Show: observation → position/route → practical implication.

4. **Funnel dashboard**  
   Internal only: activation, drop-off, generation success, Telegram continuation.

Avoid decorative charts that do not help the user understand themselves or help the owner make a product decision.

## 6. HyperFrames motion strategy

Motion should be used as a product explanation and acquisition asset, not as a heavy background layer.

Recommended first composition:

### `The Mirror Opens` — 12–18 seconds

Narrative arc:

1. A date appears as neutral raw input.
2. Five points emerge, not as mystical symbols but as distinct human functions.
3. The points connect into one route.
4. A short recognition phrase appears.
5. The formula is revealed as the evidence layer.
6. End frame: `Сначала — узнавание. Потом — ваш цифровой код.`

Outputs:

- 16:9 website/product explainer;
- 9:16 short acquisition version;
- silent loop variant for product presentation.

Hard motion rules:

- no generic cosmic particles;
- no zodiac/esoteric visual clichés;
- no fake AI avatar speech;
- no long autoplay hero video before the core funnel is proven;
- motion must explain transformation from raw data to meaningful structure.

## 7. UX priorities after production acceptance

P0:

- prove Personal Myth works in production;
- prove First Mirror/Telegram path works in production;
- instrument First Mirror funnel;
- verify event payloads contain no sensitive content.

P1:

- redesign the First Mirror result around one strong recognition thesis before numerical detail;
- create the five-position visual route;
- improve mobile reading rhythm and result hierarchy;
- add explicit loading progress states where real generation time is visible.

P2:

- product explainer motion asset;
- controlled acquisition experiments;
- landing variants by intent/problem;
- SEO content architecture.

## 8. Sales experiments

Run only after product acceptance.

### Experiment A — question-first

Promise: `Возьмите один вопрос, который действительно требует ясности.`

Traffic → First Mirror → Telegram question.

### Experiment B — recognition-first

Promise: `Сначала — узнавание. Потом — объяснение, почему это похоже на вас.`

Traffic → First Mirror → trust layer → Telegram.

### Experiment C — symbolic experience

Traffic directly to Personal Myth for audiences interested in reflective writing, symbolism, creativity, and self-observation.

Do not mix all audiences into one ad message.

## 9. Release gates

A V2 release cannot be called complete because files exist or a branch builds.

Required:

1. TypeScript check.
2. Unit tests.
3. Production build.
4. Mobile browser QA.
5. No horizontal overflow.
6. Event contract review for PII.
7. Real First Mirror journey.
8. Real Personal Myth journey.
9. Real Telegram continuation click.
10. Actual deployed SHA recorded.

## 10. Non-goals for this foundation pass

- no production deploy;
- no payment enablement;
- no public beta enablement;
- no replacement of canonical calculation logic;
- no new numerological methodology;
- no new AI provider migration;
- no decorative redesign that bypasses product truth.

## 11. Foundation changes in this branch

- human-first primary navigation;
- recognition-first hero;
- privacy-safe product analytics event layer;
- Personal Myth funnel instrumentation;
- sales/trust CTA instrumentation;
- this execution contract.

## 12. Next bounded implementation package

After review of this foundation branch:

1. instrument `CodeArchitecture` activation funnel;
2. add analytics adapter configuration only after a destination is chosen;
3. build the five-position route visualization;
4. integrate verified deep-research findings into this spec;
5. create the HyperFrames composition from the approved visual identity;
6. run full verification in a code-capable runner;
7. only then consider merge and controlled release.
