# External Release Verification — PASS

- Date: 2026-09-20T09:38:41Z (duration 387s)
- Web: `ee44fcda9b0bbf0289cb9b54349e0c2a1065eaca` (gnabriverner-pixel/Zerkalo)
- DCS: `fe67002ce2a2f9d05fa9faf205ef45264f05a931` (gnabriverner-pixel/digital-code-system)
- Pinned pair (manifest `43c37a3405c51fc047fc3ffcb3446cabef2d080c`): web=true dcs=true pair=true
- Sources at pinned SHAs: clean checkouts
- GitHub Actions: EXTERNAL_BLOCKED (account billing lock) — this run is the release gate.

## Checks

| Side | Check | Status | Time |
|------|-------|--------|------|
| Web | npm_ci | PASS | 5 |
| Web | typecheck | PASS | 5 |
| Web | tests | PASS | 9 |
| Web | build | PASS | 3 |
| Web | bundle_hygiene | PASS | 0 |
| Web | package_boot_check | PASS | 2 |
| Web | release_identity | PASS | 0 |
| Web | manifest_pair_consistency | PASS | 0 |
| DCS | pip_install | PASS | 15 |
| DCS | pytest_full | PASS | 246 |
| DCS | code_v2_payload | PASS | 0 |

Evidence log: `/tmp/verify-ext-ee44fcd/verifier.log`; JSON: `/tmp/verify-ext-ee44fcd/report.json`.
