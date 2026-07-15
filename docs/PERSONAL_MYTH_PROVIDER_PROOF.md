# Personal Myth provider proof — 2026-07-15

## Scope

Read-only provider proof from a temporary VPS checkout. Production code,
systemd and `/etc/zerkalo/production.env` were not changed.

- Branch: `codex/personal-myth-release-v1`
- Commit: `3f0dd15`
- Provider: DeepSeek
- Model: `deepseek-v4-flash`
- Credentials: inherited by one temporary process from the managed Digital
  environment; never printed, copied to the repository or persisted in `/tmp`.
- Command: `scripts/smoke_personal_myth_provider.ts`

## Result

```text
status: PASS
fixtures: 3/3
quality blockers: 0
editorial repair used: 0/3
word counts: 370, 306, 308
answer coverage: q1, q2, q3, q4 on every fixture
visual keys: river_crossing, quiet_room, night_window
```

## What this proves

- The configured provider endpoint and model can generate the required JSON.
- Three-scene generation meets the current 280–700 word gate.
- All four answer echoes reach the validated result.
- The provider can return supported local visual keys.
- Empty-output transport retry and editorial repair remain bounded safeguards,
  but were not needed in the passing run.

## What this does not prove

- It is not a production deploy.
- It is not owner acceptance.
- It is not the required 12-fixture pre-deploy batch.
- It does not certify the six editorial images; they do not exist yet.
- It does not certify public traffic, persistent rate limits or commercial use.

