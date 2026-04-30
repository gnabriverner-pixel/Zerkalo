# MASTER CONTEXT HANDOFF — Digital Code / Zerkalo

_Last updated: 2026-04-29_

This document gives a new model, agent, developer, or editor the current project context so they can continue work without re-discovering the same decisions.

## 1. Executive verdict

The project is now a smoke-test system, not just a prototype.

Current architecture:

- **Zerkalo web app**: premium visual entry point, first reflection, lead capture.
- **Telegram bot**: user return channel, conversation, notifications, future delivery.
- **Notion**: product headquarters, canon, methodology, roadmap, decisions.
- **GitHub**: code, docs, prompts, version control.
- **Beget VPS**: production server with separated services.

Nearest business goal: first real leads and first manual sales of the Big Research product.

## 2. Current Zerkalo state

GitHub repo: `gnabriverner-pixel/Zerkalo`.

Public modes:

1. **Code Architecture**
   - date input;
   - five main numbers;
   - matrix;
   - First Mirror;
   - CTA to Big Research;
   - lead capture through `LeadModal`.

2. **Personal Myth / Story About You**
   - four reflective questions;
   - metaphorical story when AI is available;
   - honest fallback when AI is unavailable;
   - blocks: main image, inner tension, hidden resource, new view, one step;
   - CTA to Big Research;
   - lead capture through `LeadModal`.

Hidden for now:

- Compatibility;
- separate Storytelling mode.

They remain experimental/backlog and should not return to public navigation before primary demand is validated.

## 3. Telegram bot role

The existing Digital Code Telegram bot is already running on the VPS and uses DeepSeek.

The bot should not be merged physically with Zerkalo.

Correct role split:

- Zerkalo = visual experience and lead capture.
- Telegram bot = return, dialogue, notifications, later delivery and follow-up.

Current desired user flow:

```text
/start in bot -> Open Zerkalo button -> web app -> First Mirror or Personal Myth -> lead -> admin notification -> manual follow-up.
```

## 4. VPS architecture

Recommended production structure:

```text
/opt/digital-code      existing Telegram bot, do not touch without need
/opt/zerkalo           separate web app
zerkalo.service        separate systemd service
PORT=3001              recommended Zerkalo port
Nginx                  reverse proxy
```

The two services should stay isolated. Integration should happen through URLs, API calls, lead notifications, and later Telegram Web App/Mini App mechanics.

## 5. GitHub status

Important pull requests:

- PR #2 `predeploy-hardening`: privacy page, LeadModal consent text, smoke-test README clarification.
- PR #3 `feat: add deploy artifacts and telegram lead notifications`: deploy files, admin notification on leads, service/nginx templates, production env example.

PR #3 was created on top of the predeploy fixes and should not lose `privacy.html`, `LeadModal`, or README scope decisions.

This docs package is created on branch:

```text
docs/master-context-handoff
```

## 6. Product layers

### Free layer: First Mirror

Purpose: a concise, accurate first hit that makes the user want the full product.

Flow:

```text
Date -> calculation -> five numbers -> matrix -> short synthesis -> first step -> lead.
```

### Reflective layer: Personal Myth

Purpose: show the user's current inner state through an image/story, without therapy framing.

Public framing:

```text
A metaphorical reflective story for self-understanding. Not diagnosis, not instruction, not a replacement for live support.
```

### Paid product: Big Research / Full Mirror

Current state: manual product, not automatic PDF generation.

MVP format: 15–30 pages. The criterion is not volume, but accuracy, structure, living language, and the feeling of personal assembly.

Recommended sections:

1. Cover.
2. How to read this document.
3. Numeric passport.
4. Main personality pattern.
5. Soul / Mind number.
6. Path / Action number.
7. Expression number.
8. Direction / Realization number.
9. Result / Outcome number.
10. Compound numbers.
11. Matrix of resources and tasks.
12. Strengths.
13. Tension points.
14. Money and realization.
15. Relationships.
16. Personal year / current period.
17. 30-day practical route.
18. Living Word.
19. What to do next.

## 7. Language and naming decisions

Use project-owned public terms and avoid direct copying of external systems.

Working vocabulary:

- Soul / Mind number: inner core.
- Path / Action number: way of movement.
- Expression number: how the person is perceived.
- Direction / Realization number: where to direct force.
- Result / Outcome number: mature assembly.
- Compound numbers: additional shades of the formula.
- Matrix: map of resources and tasks.

## 8. Voice contract

The project voice is not a bot, not a numerologist, not an esoteric guru, not a psychologist.

It is:

```text
a calm analytical-image guide helping a person see inner architecture without pressure or fatalism.
```

Tone:

- precise;
- warm but not sugary;
- deep but not vague;
- premium but not pompous;
- alive but not chaotic;
- structured but not dry;
- image-based but not mystical;
- direct but not rude.

Avoid public wording connected to:

- magic;
- healing claims;
- therapy claims;
- diagnosis;
- prediction;
- fatalism;
- guaranteed events;
- “you definitely…” statements.

Preferred language:

- inner architecture;
- formula;
- vector;
- tension;
- choice point;
- way of acting;
- resource;
- route;
- mature assembly;
- next step;
- living word over precise calculation;
- observation;
- support point;
- form;
- practical step.

## 9. Canon discipline

Source priority:

1. Canon books and internal system materials.
2. Internal methodology docs.
3. Best client examples and premium PDF cases.
4. Practical cases.
5. New hypotheses, clearly marked as hypotheses.

Rules:

```text
Do not present hypotheses as canon.
Do not copy books into the interface.
Do not transfer external text verbatim into the product.
Use source materials as methodology, not as public copy.
```

## 10. Key references

- Canon books: number meanings, positions, compound numbers, matrix, periods, compatibility.
- Evgeniya master research: model for large structured personal research, three layers: calculation, canon, living interpretation.
- ZARA PDF/HTML: model for high-touch premium live file and editorial PDF style.
- Story About You example: model for the metaphorical reflective layer.
- Project Instructions: source discipline, calculation discipline, style boundaries.

## 11. Do not do now

Do not build these before demand is validated:

- payment;
- Telegram Mini App SDK;
- initData validation;
- automatic PDF generation;
- personal account;
- full database;
- n8n as core;
- compatibility mode;
- mass ads.

## 12. Do now

1. Verify Zerkalo manually.
2. Connect domain and HTTPS.
3. Verify lead notifications.
4. Merge PR #3 after checks.
5. Run closed smoke-test with 5–10 people.
6. Manually prepare 1–3 Big Research documents.
7. Collect feedback.
8. Improve the paid offer and teaser based on real reactions.

## 13. Agent onboarding prompt

When connecting a new agent/model, provide this instruction:

```text
Read MASTER_CONTEXT_HANDOFF and the current open PRs before making changes. Do not touch production. First provide an audit and propose the first safe execution package.
```

## 14. Main strategic decision

The project should not evolve as “bot or site”. It should evolve as a system:

```text
Zerkalo -> visual entry and lead.
Telegram bot -> accompaniment and delivery.
Big Research -> main paid manual product.
Notion -> methodology headquarters.
GitHub -> code and handoff.
```

Main metric now:

```text
Real applications for Big Research and willingness to pay, not number of features.
```
