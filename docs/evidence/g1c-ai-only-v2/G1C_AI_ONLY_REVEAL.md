# G1C AI-only Phase-1 — sealed reveal

Status: `SOURCE_FIT_ACCEPTED_WITH_WRITER_CORRECTION`

This is synthetic AI evidence. It is not human validation and does not claim that a real person will find the Myth valuable.

## Frozen inputs

- Blind package: `2ee422247adaad5db0a168101038fb6cde920415`
- Sealed mapping: `c813a1c6cec1f5a8cae7620178640a2a2a9043ef`
- Blind result schema: Draft 2020-12, scores `1..6`
- Judges received separate copies of only the five blind files. They had no Git, web, repository, sibling-directory, or mapping access.
- Reveal happened only after all three result files were written, hashed, and validated with Ajv CLI 5.0.0.

## Independent passes

| Pass | Identity | Counterfactual rejected | Grounding | Specificity | Literary | Non-genericity | Insight delta | Restraint |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Grounding / identity | 30/30 | 30/30 | 6.00 | 5.90 | 4.50 | 5.93 | 3.83 | 4.47 |
| Literary / template | 30/30 | 30/30 | 5.90 | 4.87 | 3.77 | 5.90 | 3.13 | 3.43 |
| Adversarial / counterfactual | 30/30 | 30/30 | 5.83 | 5.37 | 4.10 | 5.70 | 3.53 | 3.27 |

Random identity baseline: `20%`. All three judges were unanimous on all 30 identity choices.

Aggregate means across 90 ratings per dimension:

- grounding `5.91`, median `6`;
- specificity `5.38`, median `5`;
- literary quality `4.12`, median `4`;
- non-genericity `5.84`, median `6`;
- insight delta `3.50`, median `3`;
- restraint `3.72`, median `4`.

## What the result proves

The Myth preserves enough source-specific information to recover the correct four-answer set. It is not interchangeable at the level of concrete images, and gross counterfactual swaps are reliably rejected.

## What the result does not prove

- It does not prove human recognition, usefulness, or willingness to continue.
- Identity matching is unusually easy because rare `q2/q3` details are often transferred almost literally.
- Counterfactuals usually change several anchors at once; they do not fully test close semantic mutations.
- High grounding does not cancel unsupported biographical or psychological inference.

## Proven defects

Three independent passes and mechanical phrase analysis converge on the same defects:

1. Fixed serial arc: automatic morning -> materialized `q2` -> `q3` flashback -> named `q4` -> small sensory ritual.
2. Tidy resolution arrives before the conflict has been explored.
3. Rare details create easy keyword matching while relational insight is often only an expanded paraphrase.
4. Unsupported causal psychology appears in the weakest cases, especially T022, T023 and T030.
5. Repeated language includes `впервые за долгое время` in 15/30 myths, plus recurring `не X, а Y`, windows, tea/water, light and breath.

## Decision

Keep the Myth core and its four-answer independence. Apply one narrow writer-contract correction for variability, restraint, relational insight and unresolved endings. Do not regenerate or relabel the frozen benchmark. The corrected contract becomes the release-candidate writer and must keep honest failure, provenance, crisis handling and bounded retry.

Raw judge files and summaries are under `judges/`.
