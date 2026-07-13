# ZERKALO PR #8 — BASE DECISION

Status: `REBASE_REQUIRED_BEFORE_APPROVAL`.

## Verified state

PR #8 is draft and currently targets:

`feat/premium-content-system@56800629cea9ce0bb6b5242450109cb51a001079`

Current remote heads on 2026-07-13:

- `main@6d9f689be581fb9a50caeb5a8acf4e93ffa713e2`;
- `feat/premium-content-system@56800629cea9ce0bb6b5242450109cb51a001079`;
- PR #8 head `1f62a2c8072a1f6476904e668d9b1bf07875b8dc`.

The two possible base branches have diverged:

- 11 commits exist only on `main`;
- 26 commits exist only on `feat/premium-content-system`;
- neither branch is an ancestor of the other.

The feature branch is not merged into `main`. The repository default branch is `main`, and there is no repository evidence that the divergent feature branch is the canonical production-site base.

## Decision

PR #8 must not be approved or merged against the current feature base.

Required order:

1. Keep PR #8 draft.
2. Recreate or rebase the trust-layer change onto current site `main` in a separate integration pass.
3. Preserve current `main` behaviour and avoid importing unrelated feature-only commits.
4. Confirm that the resulting diff contains only the intended trust/privacy layer.
5. Rerun TypeScript lint, all site tests, production build and browser review.
6. Retarget PR #8 to `main` only after those checks pass.

This documentation pass does not perform the rebase because it would change product-code lineage outside the allowed documentation scope.
