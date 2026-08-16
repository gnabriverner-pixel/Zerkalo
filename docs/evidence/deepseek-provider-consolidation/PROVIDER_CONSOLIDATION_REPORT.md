# Production Provider Consolidation Report (Issue #18)

## 1. Summary
- **Canonical Model Suite**: DeepSeek-only (`deepseek-v4-pro`)
- **Personal Myth**: `deepseek-v4-pro` (via server `DeepSeekMythProvider`)
- **Meeting of Mirrors**: `deepseek-v4-pro` (via server `generateMeetingOfMirrors`)
- **Albert Dialogue**: `deepseek-v4-pro` (via server `generateAlbertDialogue`, RP-1 behavioral law)
- **Google GenAI / Gemini Production Dependency**: **NONE** (`@google/genai` removed from runtime dependencies)

## 2. Core Transport & Architecture
- **Shared Transport**: `server/deepseek.ts` (`DeepSeekClient`)
- **API Endpoint**: `https://api.deepseek.com/chat/completions` (OpenAI-compatible server-side)
- **Client Security**: API keys are strictly confined to server-side process environment. No client bundle exposure.
- **Retry Policy**:
  - Transient failures (HTTP 408/409/429/5xx, timeouts, network aborts): at most **1 application retry**.
  - Terminal failures (HTTP 400/401/403, missing key, unparseable input): **0 retries** (fail-closed immediately).
- **Health Verification**:
  - `GET /health` returns `google_production_dependency: "none"` and models mapping.
  - `GET /health/ready` reports live readiness across `personal_myth`, `meeting`, and `albert`.

## 3. Albert Dialogue Migration (RP-1 Compliance)
- **Previous state**: Client-side static `setTimeout` template mockup.
- **Consolidated state**: Real server-side DeepSeek LLM dialogue at `POST /api/albert/dialogue`.
- **Grounding**:
  - Meeting summary, parallels, and divergences.
  - Calculation formula anchors (Soul, Path, Direction, Expression, Result).
  - Myth story anchors (Title, Main image, Tension, Hidden resource, One step).
- **Behavioral Law**:
  - `LISTEN → REFLECT → GROUND → OPEN → MOVE`
  - Concise response (<= 180 words).
  - Strict polite «вы» addressing.
  - Non-therapeutic, zero medical/karmic/fatalistic claims.
  - Ends with exactly one reflective open question.
- **Failure Integrity**: When provider is unconfigured or unreachable, returns honest 503/502 state with safe UI message without corrupting existing mirrors.

## 4. Live Acceptance Proofs & Viewport Artifacts (390x844)
1. **Route A (Myth -> Code -> Meeting -> Albert)**:
   - Myth Output: `docs/evidence/deepseek-provider-consolidation/screenshots/route_a_1_myth.png`
   - Code Output: `docs/evidence/deepseek-provider-consolidation/screenshots/route_a_2_code.png`
   - Meeting Synthesis: `docs/evidence/deepseek-provider-consolidation/screenshots/route_a_3_meeting.png`
   - Albert Live Dialogue: `docs/evidence/deepseek-provider-consolidation/screenshots/route_a_4_albert.png`
2. **Route B (Code -> Myth -> Meeting -> Albert)**:
   - Code Output: `docs/evidence/deepseek-provider-consolidation/screenshots/route_b_1_code.png`
   - Myth Output: `docs/evidence/deepseek-provider-consolidation/screenshots/route_b_2_myth.png`
   - Meeting Synthesis: `docs/evidence/deepseek-provider-consolidation/screenshots/route_b_3_meeting.png`
   - Albert Live Dialogue: `docs/evidence/deepseek-provider-consolidation/screenshots/route_b_4_albert.png`
3. **Controlled Provider Failure**:
   - Meeting 503 Provider Unavailable State: `docs/evidence/deepseek-provider-consolidation/screenshots/meeting_unavailable_honest_state.png`
   - Provenance log: `docs/evidence/deepseek-provider-consolidation/PROVIDER_PROVENANCE.json`
