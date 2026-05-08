# AGENT START HERE — Claude Code / Digital Code / Zerkalo

**Date:** 2026-05-08  
**Audience:** Claude Code / CloudCode / external code agent  
**Status:** operational handoff for safe execution  

This file exists so a new agent does not enter the project blind. Read it before touching code, deployment, `.env`, systemd, payment logic, or calculation logic.

---

## 1. Core project in one paragraph

`Цифровой Код / Digital Code` is a premium AI-assisted self-knowledge product built around strict date-of-birth calculations, structured numeric interpretation, composite numbers, authorial voice, Telegram delivery, PDF/deep reports, and a visual web entry point called `Zerkalo`. The near-term goal is not architectural perfection; the near-term goal is a safe, monetizable MVP that can take the first controlled paying users and deliver Basic / Deep / Big Research experiences without breaking production.

---

## 2. One methodology, multiple surfaces

Do **not** treat Zerkalo, Personal Myth and Telegram Bot as unrelated products.

Correct model:

```text
ONE METHODOLOGY
  ├── Zerkalo / First Mirror — free analytical entry
  ├── Zerkalo / Personal Myth — free emotional/narrative entry
  └── Digital Code Telegram Bot — paid report / PDF / dialogue / consultation channel
```

Important current decision:

```text
Do not physically merge Telegram Bot and Zerkalo.

Zerkalo = first experience and request form.
Telegram Bot = communication, paid delivery, PDF/report/dialogue.
Big Research = main premium paid product.
Notion = method and decisions.
GitHub = implementation and handoff.
VPS = production runtime.
```

---

## 3. Current product map

```text
zerkalosebya.ru
  ├── [Free] First Mirror → date → 4 blocks → CTA to Telegram
  ├── [Free] Personal Myth → 4 questions → story/myth → CTA to Telegram
  └── [Lead] Big Research → lead form → manual consultation / author contact

@DigitalCodeBot / Telegram
  ├── Basic → shorter paid report / sections / dialogue
  ├── Deep → deeper report + PDF + follow-ups
  └── Live consultation / author analysis → premium upsell
```

Stars/payment amounts may still be smoke-test variables. Do not hardcode business truth from screenshots without reading the current code and config.

---

## 4. Key repositories and runtime locations

### GitHub

Primary known repo:
- `gnabriverner-pixel/Zerkalo`
- GitHub: `https://github.com/gnabriverner-pixel/Zerkalo`
- Current context PR: `https://github.com/gnabriverner-pixel/Zerkalo/pull/4`
- Branch: `docs/master-context-handoff`

Likely related repos / systems to verify, not assume:
- `digital-code-system`
- `digital-code-web`

If you cannot access a repo, say exactly what is blocked. Do not infer code state from memory.

### VPS / production

Known/expected paths:
- Zerkalo work path: `/home/hermes/work/Zerkalo/`
- Zerkalo production path: `/opt/zerkalo/`
- Digital Code runtime: `/opt/digital-code/`
- Bot service: `digital-code-bot.service`

Known Hermes/operator files:
- `/home/hermes/OPERATING_SYSTEM.md`
- `/home/hermes/ACCESS_REQUESTS.md`
- `/home/hermes/.hermes/SOUL.md`

Known Hermes commands:
- `hermes-mode-pro`
- `hermes-mode-flash`
- `hermes-mode-status`
- `hermes-safe-audit`
- `hermes-check-services`
- `hermes-check-n8n`
- `hermes-check-sites`

Verify all paths on the actual machine before relying on them.

---

## 5. Canonical Notion links

Read these if you have Notion access. If not, ask the owner/Hermes for export or paste.

1. Main base — `Система Цифровой Код — Главная База`  
   `https://www.notion.so/3384f3f462808189aeb3dfe5234827eb?pvs=1`

2. Project Control Center — `Canon / Product / Infra / Execution`  
   `https://www.notion.so/3394f3f4628081f4a104c408daa15fb0?pvs=1`

3. Agent Onboarding Snapshot — `Digital Code / Zerkalo — Agent Onboarding Snapshot 2026-04-29`  
   `https://www.notion.so/3514f3f46280814f9ce2cef5834942d3?pvs=1`

4. Canon Rail — `Source of Truth / Pack v1 / Registry`  
   `https://www.notion.so/3394f3f462808103993be7ce0c0a21b1?pvs=1`

5. GitHub Audit — `AUDIT — GitHub Repositories / Digital Code — 2026-04-18`  
   `https://www.notion.so/3464f3f4628081f091d0f90fc63df7a2?pvs=1`

6. Final App / Language Decisions — April 2026  
   `https://www.notion.so/33f4f3f46280814a813fedb948d9a6ac?pvs=1`

7. Market Research TZ — Digital Code / realization strategy  
   `https://www.notion.so/3404f3f4628081d4bdcfd5ee6c689066?pvs=1`

8. Objective Revision Audit — 2026-04-18  
   `https://www.notion.so/3464f3f46280810ca3c9e67e77f5eebd?pvs=1`

---

## 6. Important GitHub files to read first

In `gnabriverner-pixel/Zerkalo`, read in this order:

1. `README.md`
2. `docs/MASTER_CONTEXT_HANDOFF.md`
3. `docs/PROJECT_MEANING_MAP.md`
4. `docs/VOICE_AND_MEANING_CONTRACT.md`
5. `docs/BIG_RESEARCH_PRODUCT_SPEC.md`
6. `docs/REPORT_QA_GATE.md`
7. `docs/AGENT_START_HERE_CLAUDE_CODE_2026-05-08.md` — this file
8. `src/services/calculator.ts`
9. `src/services/interpretation.ts`
10. `src/data/numberKnowledge.ts`
11. `src/data/compoundKnowledge.ts`
12. `src/components/CodeArchitecture.tsx`
13. `src/components/PersonalMyth.tsx`
14. `src/components/BigResearchTeaser.tsx`
15. `DEPLOY.md`
16. `deploy/zerkalo.service`
17. `deploy/zerkalo.nginx.conf`

For the Telegram bot / Python system, if accessible, read:

1. `CLAUDE.md`
2. `DEPLOY_RUNBOOK_VPS.md`
3. `engine.py`
4. `bot_mvp.py`
5. `llm_gateway.py`
6. `master_prompt.md`
7. `knowledge_base.json`
8. `VOICE_AND_DIALOGUE_CONTRACT_V1.md`
9. `CONSULTATION_VOICE_V1.md`
10. `CONSULTATION_FRAMEWORK_V1.md`
11. `CONSULTATION_RUBRIC_V1.md`

---

## 7. Calculation canon to preserve

The current direction is detailed composite logic, not only reduced one-digit numbers.

For `06.05.1986`:

```text
Soul / Число Души:
06 → 6

Expression / Число Выражения:
0+6+0+5 = 11 → 2

Path / Число Пути:
0+6+0+5+1+9+8+6 = 35 → 8

Direction / Число Направления:
6 + 35 = 41 → 5

Result / Число Результата:
6 + 35 + 41 = 82 → 1

Public formula:
6 — 2 — 8 — 5 — 1

Visible composites:
11 / 35 / 41 / 82
```

Important:
- `Число Выражения` does **not** participate in Direction / Result calculation.
- Do not simplify Direction to `6 + 8 = 14 → 5` in detailed mode.
- Do not simplify Result to `6 + 8 + 5 = 19 → 1` in detailed mode.
- If Python bot and Zerkalo disagree, treat this as calculation-depth mismatch, not necessarily a bug.
- Future task: create `CALCULATION_PARITY_SPEC_V1.md` before changing engines.

---

## 8. Current safe execution scope

The owner currently needs context clarity and safe execution. The safest first scope is documentation/quality guardrail work, not production mutation.

Approved immediate scope:

```text
1. Create PERSONAL_MYTH_VOICE_CONTRACT_V1.md
2. Create PERSONAL_MYTH_EVAL_RUBRIC_V1.md
3. Add both to CLAUDE.md as Personal Myth canonical sources
4. Read DEPLOY_RUNBOOK_VPS.md and report readiness for future smoke test
5. Run local tests if safe
6. Return diff summary
```

Everything else requires next approval.

---

## 9. Personal Myth product direction

Personal Myth is the emotional/narrative free entry. It must not become a therapeutic product or generic fairy tale.

Required qualities:
- quiet;
- precise;
- image-based;
- user-answer-specific;
- not sugary;
- not moralizing;
- not deterministic;
- not guru-like;
- not therapy;
- open ending;
- one simple step;
- one journal/reflection question;
- soft CTA toward numbers / Big Research.

Forbidden patterns:
- “и жили они долго” fairy-tale cliché;
- прямые советы как команды;
- “травма”, “исцеление”, “внутренний ребёнок”;
- fatalism / prophecy;
- generic parable;
- excessive consolation;
- mystical fog.

Suggested output frame:
- 9 narrative steps;
- central image;
- internal tension;
- hidden resource;
- mirror phrase;
- one step;
- journal question;
- CTA to understand numbers behind the state.

---

## 10. Hard safety rules

Do not do these without explicit owner approval:

- do not edit `.env`;
- do not print secrets;
- do not ask owner to paste secrets in chat;
- do not rotate `BOT_TOKEN`;
- do not restart systemd services;
- do not deploy;
- do not `git push` from server;
- do not run real payment / Telegram Stars test;
- do not toggle `FIRST20_QA_GATE`;
- do not change production flags;
- do not rewrite `engine.py`;
- do not add RC1–RC4 immediately;
- do not expand `knowledge_base.json` immediately;
- do not modify `master_prompt.md` immediately;
- do not build shared login;
- do not build shared database;
- do not introduce n8n / Redis / Postgres / Docker / Celery / new infra;
- do not add Jyotish;
- do not make Personal Myth therapeutic.

---

## 11. Business posture

Current strategy:

```text
Free:
- First Mirror
- Personal Myth

Entry:
- Basic Telegram report

Core:
- Deep / Большое исследование / PDF

Premium:
- live author consultation / 15,000+ ₽
```

Do not over-focus on tiny Stars revenue. Stars/payment can validate flow; the premium product is deeper.

Near-term success means:

```text
zerkalosebya.ru → free experience → Telegram → Basic/Deep payment or manual paid request → report/PDF delivered → owner notified → dialogue/follow-up works → consultation upsell possible.
```

---

## 12. Public positioning

Preferred:

> «Цифровой Код» — система структурного самоисследования через дату рождения, числа и авторскую интерпретацию.

Avoid as core public framing:
- astrology;
- horoscope;
- prediction;
- diagnosis;
- therapy;
- healing;
- magic;
- deterministic destiny.

The product should feel:
- premium;
- precise;
- modern;
- emotionally alive;
- grounded;
- not cheap numerology;
- not generic AI;
- not mystical fog.

---

## 13. Required report format from Claude

After reading or changing anything, report in this structure:

```text
# 1. What I read
# 2. What I changed
# 3. Files created
# 4. Files modified
# 5. Tests run
# 6. Diff summary
# 7. Risks
# 8. What I did NOT touch
# 9. Blockers
# 10. Next approval request
```

No vague executive essays after execution begins. Concrete files, diffs, tests, risks.

---

## 14. First instruction to follow now

Claude, first do this:

```text
Read this file.
Read README.md and docs/MASTER_CONTEXT_HANDOFF.md.
Then execute only the approved safe scope:
- create PERSONAL_MYTH_VOICE_CONTRACT_V1.md;
- create PERSONAL_MYTH_EVAL_RUBRIC_V1.md;
- add them to CLAUDE.md as canonical Personal Myth sources;
- review DEPLOY_RUNBOOK_VPS.md read-only;
- run local tests if safe;
- return the required report format.
```

Do not touch production.
Do not deploy.
Do not edit secrets.
Do not change engine/calculation logic yet.
