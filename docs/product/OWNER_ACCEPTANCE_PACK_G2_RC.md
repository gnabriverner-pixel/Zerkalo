# G2 Convergence release candidate — owner acceptance pack

## Current stage

Stage: `IMPLEMENTED CANDIDATE / OWNER ACCEPTANCE NOT RUN`

Branch: `feature/g2-convergence-rc-v1`

Base: `eeb308b42e14802f264458f613546d343050f25f`

Stable `digital-code-system` production, deployment, payments, Telegram bot and public routes were not changed.

## What is implemented

- Threshold opens the one-product journey instead of the isolated Alabaster mode.
- Equal independent entry to Personal Myth and Digital Code.
- Digital Code uses the existing deterministic calculation and existing FirstMirror output in an alabaster room.
- Personal Myth uses the real DeepSeek `deepseek-v4-pro` runtime with writer v1.1, bounded validation/repair and honest failure.
- Meeting consumes only completed real Code and Myth results.
- Meeting contract allows `0..4` resonances and `0..2` divergences, validates every anchor and accepts zero resonance as complete.
- Missing provider, invalid JSON or invalid contract returns an error; deterministic Meeting success was removed.
- Albert remains the continuation after Meeting.
- Optional feedback is post-release evidence and reports storage failure honestly.

## Automated gates

| Gate | Result |
|---|---|
| Frozen blind schema validation | PASS, 3/3 result files |
| Sealed identity reveal | 30/30 for each of 3 judges |
| Counterfactual rejection | 30/30 for each of 3 judges |
| TypeScript | PASS |
| Unit + mutation tests | PASS |
| Production build | PASS |
| Diff whitespace | PASS |
| Bundle advisory | WARN, main JS about 600 kB minified |
| Live provider smoke | BLOCKED BY LOCAL EXECUTION LIMIT |
| Phone e2e + screenshots | BLOCKED BY LOCAL EXECUTION LIMIT |
| Owner acceptance | NOT RUN |

## Owner phone flow

Target viewport: owner phone first; verify at approximately `390 x 844`, then desktop.

1. Threshold
   - Dark cinematic world appears without a theme chooser.
   - `Войти в коллекцию` is the only primary action.
   - Both mirrors are presented as independent and equal.

2. Personal Myth
   - Four questions are usable with one thumb and keyboard does not cover the primary action.
   - Result is a warm-paper/ink reading room.
   - Source images are visible before the story.
   - Refresh is not part of this pre-bridge acceptance; session continuity is enough.

3. Digital Code
   - Impossible and future dates are rejected.
   - Real deterministic calculation appears even if extended Code prose is unavailable.
   - Alabaster room feels like a reveal inside the same product, not a second site.

4. Meeting
   - It cannot run until both real results exist.
   - Result visibly shows resonance/divergence counts.
   - Code anchors use alabaster material; Myth anchors use paper/ink.
   - A zero-resonance result is readable and does not apologize or fabricate a match.
   - Removing the Meeting provider key must show the honest unavailable state while preserving both results.

5. Albert and feedback
   - Site dialogue opens from the completed Meeting.
   - Feedback is optional, never blocks continuation and does not claim success when storage fails.

## Owner decision

Accept G2 only if the complete phone flow is coherent, readable and trustworthy, including the zero-match/error states. After explicit acceptance, implement the smallest session bridge for `Моё зеркало`; do not create a new architecture or database.

If any visual or live-runtime check fails, keep the branch as a candidate and fix only the observed defect before another acceptance pass.
