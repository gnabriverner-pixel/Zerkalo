# RouterAI local release candidate — 2026-09-12

Owner gate: local integration and ONE release acceptance, no production changes,
push, merge, payment activation or model comparison. P1/P2 are not reopened.

## Frozen policy

- Gateway: `https://routerai.ru/api/v1`.
- Primary: `anthropic/claude-sonnet-5`.
- Fallback: `deepseek/deepseek-v4.1-flash`; request pin
  `provider.only=["deepseek"]`, `allow_fallbacks=false`, `thinking.type=disabled`,
  `include_reasoning=false`. Reported upstream must be DeepSeek; the proven
  upstream response alias `deepseek-flash` is allowed and logged separately.
- Sonnet: low reasoning, no returned reasoning, strict JSON Schema for Myth/Meeting.
- Runtime reads `ROUTERAI_API_KEY` on both Web and DCS. Legacy DeepSeek configuration
  is not a fallback or alternate gateway for these product paths. Bridge clients
  cannot choose a provider, key or URL in their request body.
- One fallback before delivery for transient transport/empty output or exhausted
  structural contract. No ranking of two successful answers, no subjective fallback.
  Model and cost telemetry records calls, not proof of user delivery.
- No new Telegram retry/outbox behavior. `DELIVERY_UNKNOWN` is unchanged.

## Bounds and repaired transport

Myth retains one repair per selected model and a total envelope of twice the
configured per-attempt timeout (default 150 seconds across primary and fallback).
The first RouterAI acceptance request returned HTTP 200 after 62.785 seconds,
outside the inherited 45-second Myth attempt. Default attempt is now 75 seconds,
within the existing configurable 90-second ceiling; no prompt or UX changes.
Meeting retains its 48-second total bound; primary receives 70% and fallback the
remaining time. RouterAI transport has no hidden SDK retry. Meeting output cap is
6000 tokens (was 4000); this is a candidate cap, not a live-proven minimum yet.
Albert shares a per-turn deadline (default 40 seconds) across generation/repair/
fallback; the Web bridge waits up to 45 seconds. Its existing guard repair remains.

The saved Stage 1.5 strong-rejection Meeting consumed 4000 tokens with `finish_reason=stop`,
but the JSON was complete. It contained `{result:{status:"ok",result:{...}}}`;
the inner summary was 452 characters. A narrowly recognized redundant transport
envelope is unwrapped once and checked by the unchanged product parser. Increasing
the token cap alone does not explain or prove a fix for that failure.

Validator base is `9906a9743d7e091312dffef4b8dd97cbf281e056`, descended from Web
candidate `ea0a59084351ee596ae2ec1edb83f86b12201e6a`. Pair-marked variants of
`вы сидите рядом`, `вы оказываетесь вдвоём`, `вы делите … на двоих` have regression
coverage. Ambiguous formal singular variants stay blocked. No global exemption.

## Acceptance procedure (not yet live accepted)

`scripts/quality/routeraiRelease.ts` uses the same 18 synthetic personas, freshly
on the new provider. Old 9/18 artifacts are not accepted as current evidence.
Three additional forced-primary-failure journeys use existing strong-rejection,
relationship and no-image personas. Injection is confined to the acceptance
transport, not production runtime. No real bot API calls are made by this driver.

With the approved key already loaded securely in the process environment:

```sh
QUALITY_LIVE=1 node --import tsx scripts/quality/routeraiRelease.ts
```

Default sibling DCS checkout: `../digital-code-product-journey` (override `DCS_ROOT`
only when necessary). Output: sibling `routerai-release-acceptance-2026-09`.
Both checkouts must have committed, unchanged source. A manifest mismatch stops
the run; existing scenario records are not overwritten or silently regenerated.

Before every billable request the isolated loopback proxy persists a conservative
reservation based on current endpoint tariffs, UTF-8 input byte upper bounds and
the configured output limit. Shared aggregate cap: **300 RUB**, across Web and
DCS, including repair/fallback. Actual `usage.cost` and balance delta reconcile
reservations. Missing cost, unknown transport outcome or unreconciled in-flight
records fail closed; restarting cannot discard the reservation. Metadata GETs do
not generate model outputs. No real provider key is sent to the child test driver.
The budget ledger location does not follow an output-directory override. A
host-wide exclusive lock rejects concurrent acceptance processes; a stale lock
requires inspection rather than automatic removal or allowance reset.
The proxy waits for an already billed request to settle before admitting a
subsequent attempt, even if the local caller has timed out. Shutdown also waits
for settlement; the ledger cannot report a false zero while a request is active.

The runner distinguishes mechanical completion from semantic review. It never
automatically certifies invented biography, unsupported causality or literary
quality. These require examination of the generated artifacts, case by case.
Exit 2 means all mechanical journeys completed but semantic review is still
required; exit 1 means incomplete/failed acceptance. Neither is an automatic PASS.

## Current evidence limits

At initial preflight the key was absent from both the process and the normal Web
environment. The owner subsequently supplied a credential for this acceptance.
It is loaded only into process memory through non-echoing stdin, not a command
argument, repository file, evidence record or persistent configuration. No public
runtime was reconfigured. Live results belong to the separate acceptance directory.

Routing reference: https://routerai.ru/docs/guides/overview/provider-selection
Parameters reference: https://routerai.ru/docs/guides/overview/parameters
The gateway's documentation contains caveats about provider preferences; request
pinning and response identity checks are implemented, not a claim that our code
can control an undocumented internal gateway retry. Live evidence must show the
official upstream for each fallback call.
