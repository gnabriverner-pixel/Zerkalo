# Personal Myth writer contract v1.1 — frozen for release candidate

Status: `FROZEN_RC`

## Runtime identity

- Provider: DeepSeek API.
- Model: `deepseek-v4-pro` by default, overridable only by trusted server environment.
- Temperature: `0.72`.
- Max output: `5000` tokens.
- Response: JSON object.
- Thinking: explicitly disabled.
- Input: exactly four answers; no date, Code result, identity, hidden persona or Meeting context.
- Failure: explicit error. No canned Myth and no fake success.

## Preserved contract

- Mature Russian literary prose, concrete scenes and material detail.
- Every major image traceable to at least one of `q1..q4`.
- No diagnosis, prediction, biography, relationship fact or motive asserted as fact.
- Crisis pre-check before provider call.
- Schema and forbidden-language validation after generation.
- At most one bounded editorial repair after a failed validation; transport retry is separate and bounded.

## V1.1 correction from blind evidence

1. Do not use a fixed six-beat order. Vary entry point, chronology, narrator distance and scene count.
2. Do not name `q4` as the answer by default. Discover it indirectly or leave it as an open hypothesis.
3. The new view must connect at least two distinct answers. A paraphrase of one answer is not insight delta.
4. Preserve unresolved residue. The final action may change attention, not claim that the conflict is solved.
5. Psychological causality must be modal and grounded: `возможно`, `история предлагает увидеть`; never `он боится`, `она зависит`, `вы подавляете` without explicit support.
6. Avoid serial fingerprints such as `впервые за долгое время`, obligatory morning/window/tea/light, `не X, а Y`, and an automatic 5-15 minute ritual.
7. If inputs are too sparse for an honest story, fail explicitly instead of filling gaps with generic uplift.

## Output contract

The existing `story_result` shape remains unchanged for compatibility: `title`, `story`, four `mirror` fields, `meaning`, `one_step`, `journal_question`, `disclaimer`.

The writer version exposed by readiness and result metadata is `personal-myth-v1.1-rc`.
