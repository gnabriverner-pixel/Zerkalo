# Зеркало себя — Architecture v1.1 frozen

Status: `RELEASE_CANDIDATE_ARCHITECTURE`

## One product

`Порог -> Цифровой код | Личный миф -> приглашение ко второй линзе -> Встреча зеркал -> Альберт -> Моё зеркало`

The two lenses are equal and independent. A user may start with either. Meeting opens only after both real runtime results exist.

## Surfaces

- Website/WebApp: complete primary journey and release-candidate truth.
- Telegram/Albert: continuation of a completed result, not a substitute for the website flow.
- Mini App and `Моё зеркало`: post-owner-acceptance runtime bridge only; no separate product architecture.
- PDF/Deep: later depth/export surfaces over the same saved result.

## Runtime contracts

### Digital Code

- Deterministic calculation from date of birth.
- Existing `CalculationResult` and `FirstMirror` are the only Code inputs to Meeting.
- Code is revealed in a local alabaster room inside the dark product world.

### Personal Myth

- Four answers only.
- DeepSeek `deepseek-v4-pro` writer contract v1.1.
- Ink/warm-paper reading room.
- Honest error keeps answers in client state and permits retry.

### Meeting of Mirrors

- Receives completed Code and Myth results; never raw hidden context.
- Returns `0..4` resonances and `0..2` divergences.
- Every resonance carries one Code anchor and one Myth anchor.
- Zero resonance is a complete valid result.
- Provider absence, invalid JSON or invalid contract returns HTTP `502/503`; deterministic success is forbidden.

### Albert

- Opens after a completed Meeting and receives only the visible result context.
- The reflective question is part of Meeting; chat is continuation, not proof.

## Visual canon

- Global world: dark Lovable mystery, slow cinematic threshold, restrained editorial hierarchy.
- Code: alabaster archive and bas-relief reveal rooms.
- Myth: warm paper, ink, breathing margins and explicit source provenance.
- Meeting: dark chamber joining alabaster and paper materials; resonances and divergences are visually equal evidence.
- No theme switch and no competing Alabaster/Lovable products.

## Evidence policy

- Pre-release gate: AI-only blind judges, counterfactuals, adversarial and mutation tests, consistency/provenance checks, UX heuristics and simulated personas.
- Synthetic evidence is labeled synthetic and never reported as human validation.
- Human feedback is optional post-release evidence collected inside the product. It does not block release candidate status.

## Persistence boundary

For owner acceptance, results live in the active browser session. No new database is introduced. After explicit owner acceptance, add the smallest first-party bridge needed for `Моё зеркало`; do not alter the stable `digital-code-system` production contour before that decision.

## Release boundaries

- No payments, public deployment, Mini App rebuild, new database or production migration in this branch.
- Stable `digital-code-system` production remains untouched.
- Release candidate requires build, typecheck, unit tests, provider-contract tests, phone-first e2e and visual acceptance.
