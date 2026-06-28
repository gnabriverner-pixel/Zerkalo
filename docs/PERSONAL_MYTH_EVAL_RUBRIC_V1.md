# PERSONAL MYTH EVAL RUBRIC V1
**Date:** 2026-05-08 | **Status:** Canonical

Score each axis 1–5. **Minimum bar: ≥4 on ALL axes.**
Any axis < 4 = output rejected, re-generate.

---

## Axis 1: IMAGE QUALITY (Образность mainImage)

Does the central image earn its place?

| Score | Criteria |
|---|---|
| 5 | Concrete, sensory, unexpected. Not read elsewhere. Stays with you after the story ends. |
| 4 | Concrete and specific. Works. Not memorable but not generic either. |
| 3 | Somewhat concrete but close to familiar territory. Usable with light edit. |
| 2 | Generic or abstract: «journey», «weight», «storm», «путь», «тяжесть», «буря». |
| 1 | Pure cliché or esoteric bypass: «waves of energy», «мудрость вселенной», «свет в конце туннеля». |

**Test:** Can you find this exact image in a generic horoscope or self-help article? If yes → 1 or 2.

---

## Axis 2: ANSWER RESONANCE (Резонанс с ответами Q1–Q4)

Are all 4 user answers recognizably present in the story?

| Score | Criteria |
|---|---|
| 5 | All 4 answers reflected. User reads it and thinks: «this is about me, specifically, right now.» |
| 4 | 3 of 4 answers present. One somewhat general but not absent. |
| 3 | 2 of 4 answers present. Story could fit many people at a stretch. |
| 2 | 1 answer present. Generic story with thin personal gloss. |
| 1 | No recognizable connection to user's answers. Could have been generated without reading them. |

**Test:** Read only the user's Q1–Q4. Then read only the story. Can you find where each answer appears? If you can't find Q2 anywhere → axis score ≤ 2.

---

## Axis 3: NON-DIRECTIVENESS (Отсутствие директивности)

Does the story avoid giving direct advice or embedded prescription?

| Score | Criteria |
|---|---|
| 5 | Zero direct advice anywhere. Story creates space without pushing. Reader decides what it means for them. |
| 4 | No explicit advice. One sentence slightly prescriptive but embedded deeply enough in narrative. |
| 3 | Advice implicit but detectable: «she knew she had to let go», «герой наконец понял, что нужно остановиться». |
| 2 | Direct advice disguised as story event: «the traveler learned that one should always listen to their heart». |
| 1 | The story is a self-help article with character names. Prescription everywhere. |

**Test:** Find every sentence containing «нужно», «должна», «следует», «важно», «пора», «необходимо». Each one reduces the score by 1.

---

## Axis 4: OPEN ENDING (Открытость journal_question)

Does the journal_question open genuine inquiry without a built-in correct answer?

| Score | Criteria |
|---|---|
| 5 | Question has no right answer. Could be answered in opposite ways with equal validity. Sits with you. |
| 4 | Open, honest question. Not quite «no right answer» but genuinely exploratory. Both directions possible. |
| 3 | Technically a question but the answer is strongly implied. |
| 2 | Rhetorical question with obvious answer: «Isn't it time to believe in yourself?», «Разве не пора начать жить для себя?» |
| 1 | Not a question, or a motivational statement with a question mark. |

**Test:** Answer the question with «нет» or the opposite of what seems expected. Does that answer feel valid? If no → score ≤ 3.

---

## Axis 5: ONE REAL STEP (Конкретность one_step)

Is the one_step small, physical, actionable — not motivational?

| Score | Criteria |
|---|---|
| 5 | Something you can do in under 15 minutes with your hands. Specific. Unglamorous. Works immediately. |
| 4 | Concrete. Could be slightly more specific but clearly actionable in today's timeframe. |
| 3 | Action-adjacent but vague: «spend time alone», «побудь с этим ощущением». |
| 2 | Motivational framing: «take the first step toward your dream», «начни движение к себе». |
| 1 | No step, or pure abstraction: «begin your healing journey», «позволь себе быть». |

**Test:** Can you do this step today, in a specific place, with specific materials? If no → score ≤ 3.

---

## Scoring Summary

```
Axis 1  IMAGE QUALITY          ___  (min 4)
Axis 2  ANSWER RESONANCE       ___  (min 4)
Axis 3  NON-DIRECTIVENESS      ___  (min 4)
Axis 4  OPEN ENDING            ___  (min 4)
Axis 5  ONE REAL STEP          ___  (min 4)

PASS (all ≥ 4)?   YES / NO
```

---

## Usage Protocol

1. Before production: generate 3 test outputs using test dates + test Q1–Q4 sets
2. Score each on 5 axes using this rubric
3. If any axis < 4: identify the specific failure mode, return to PERSONAL_MYTH_VOICE_CONTRACT_V1 for correction, re-generate
4. Record baseline scores in test log with date and system prompt version
5. Re-evaluate after ANY change to Personal Myth system prompt in AGENTS.md

---

## Test Cases (Baseline)

### Test Case A
Q1: «Работа занимает всё время, не остаётся сил на остальное»
Q2: «Как будто несу тяжёлый рюкзак и не могу его поставить»
Q3: «Когда рисую что-то руками»
Q4: «Лёгкости»

### Test Case B
Q1: «Чувствую, что стою на месте, хотя много делаю»
Q2: «Как колесо, которое крутится но не едет»
Q3: «Когда выхожу за город и молчу»
Q4: «Направления»

### Test Case C
Q1: «Сложности в отношениях с близким человеком»
Q2: «Как два разных языка, которые не переводятся»
Q3: «Когда готовлю еду для кого-то»
Q4: «Терпения к себе»

**Baseline result:** Every test case output must score ≥ 4 on all axes before deployment.
