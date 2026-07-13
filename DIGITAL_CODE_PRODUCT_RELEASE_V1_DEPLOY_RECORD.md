# Digital Code Product Release V1 - Site Deploy Record

Date: 2026-07-13  
Release state: `DEPLOYED_OWNER_ACCEPTANCE_READY`  
Audience: owner-only; Wave A is prepared but not started.

## Release Lineage

- Superseded ambiguous PR: `gnabriverner-pixel/Zerkalo#8` (closed, not merged)
- Clean main-based site PR: `gnabriverner-pixel/Zerkalo#9`
  - base: canonical site `main`
  - merged at `2026-07-13T21:32:43Z`
  - merge and deployed SHA: `178d22d538b0f71da312fa741a6c165f30a84961`
- Product runtime PR: `gnabriverner-pixel/digital-code-system#55`
  - merge SHA: `f6995a13004e7cec9d8bc355b3cc454b780605a7`
- Runtime compatibility PR: `gnabriverner-pixel/digital-code-system#56`
  - merge and deployed SHA: `b0a9e7e5c64be5f1dcc556e442fd3fa0a2b34bf5`

PR #9 contains only the intended trust and privacy layer transplanted from the
earlier feature lineage: transparent Albert positioning, Free-to-Deep value
explanation, evidence-based compound-route example, honest external-provider
disclosure, privacy copy, Telegram CTA, and directly related tests.

## Production Deployment

- Site release: `/opt/zerkalo-releases/178d22d538b0f71da312fa741a6c165f30a84961`
- Site cutover: `2026-07-13T21:43:00Z`
- `zerkalo.service`: active, running, zero restarts after cutover
- Health endpoint: PASS
- Public landing page: HTTP 200
- Public privacy page: HTTP 200
- Mini App release:
  `/var/www/zerkalo-reveal-releases/b0a9e7e5c64be5f1dcc556e442fd3fa0a2b34bf5`
- Mini App profile data:
  `/var/lib/digital-code/webapp-data` through a dedicated no-cache nginx route

The site and Mini App builds are immutable root-owned release directories.
Lead storage and Mini App profile JSON remain in dedicated shared paths.

## Certification Evidence

- clean dependency install: PASS
- lint: PASS
- complete site tests: 20/20 PASS
- production build: PASS
- `git diff --check`: PASS
- landing page checked at mobile, tablet, and desktop widths before merge
- production landing and privacy pages checked at mobile and desktop widths
- no horizontal overflow
- Albert is explicitly a digital guide, not a psychologist or hidden human
- the method is presented as a self-observation hypothesis with clear limits
- privacy copy discloses the external language-model provider and data classes
- Telegram CTA points to the production bot
- Mini App Passport, Formula, Practice, and Route tabs are operable
- the optional seven-day route is not required for a complete Deep result
- existing profile JSON returns HTTP 200; missing profile JSON returns HTTP 404
- missing profiles show recovery rather than fabricated generic content

No first-party runtime error was observed. Playwright logged a failed external
Google Fonts request while direct HTTP verification returned 200; fallback
fonts remained usable. The intentional missing-profile test logged its expected
404.

## Closed Runtime State

- payments disabled
- public Deep beta disabled
- automatic follow-ups remain dry-run
- Deep PDF and methodology runtime remain owner-only
- Wave A not started

The detailed environment values are recorded in the private runtime repository;
no identifiers or secrets are duplicated here.

## Backup and Rollback

- Backup: `/opt/digital-code-backups/product-release-v1-20260713T213438Z`
- Site service unit, environment, nginx configuration, and lead storage were
  captured before cutover.
- Backup checksums: PASS
- Previous `/opt/zerkalo` deployment remains retained as the site rollback target.

Rollback was not required. Site, nginx, Mini App, and bot services are healthy.

## Owner Acceptance

Automated and synthetic acceptance is complete. The remaining action is one
manual owner journey in the production Telegram bot, followed by reading the
real Telegram synthesis, PDF, and Mini App result.

Public beta, payments, invitations, and automatic follow-ups must remain off
until that reading is explicitly accepted. Wave A requires a separate owner
approval and is not started by this release record.
