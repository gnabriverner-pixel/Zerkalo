# Production Provider Consolidation Report (Issue #18)

## 1. Summary
- **Canonical Model Suite**: DeepSeek-only (`deepseek-v4-pro`)
- **Personal Myth**: `deepseek-v4-pro` (via server `DeepSeekMythProvider`, single transient transport retry contract)
- **Meeting of Mirrors**: `deepseek-v4-pro` (via server `generateMeetingOfMirrors`, JSON-grounded synthesis)
- **Albert Dialogue**: `deepseek-v4-pro` (via server `generateAlbertDialogue`, RP-1 mechanical validation <= 180 words, exactly 1 final question)
- **Google GenAI / Gemini Production Dependency**: **NONE** (`@google/genai` purged from `package.json` and lockfile, `.env.example` and `README.md` updated)

## 2. Transport & Retry Architecture
- **Shared Transport**: `server/deepseek.ts` (`DeepSeekClient`)
- **API Endpoint**: `https://api.deepseek.com/chat/completions` (OpenAI-compatible server-side)
- **Retry Policy**:
  - Transient failures (HTTP 408/409/429/5xx, network aborts, timeouts): at most **1 application retry**.
  - Terminal failures (HTTP 400/401/403, missing key, unparseable payload): **0 retries** (fail-closed immediately).
- **Layering**:
  - `generatePersonalMyth` no longer stacks transport retry loops. Transport errors propagate immediately. Editorial QA loops (up to 3 attempts) apply solely to content quality/format repair on HTTP 200 responses.

## 3. Albert Dialogue Enforcement (RP-1 Compliance)
- **Mechanical Validation**: `validateAlbertResponse()`
  - Word count: 5 <= words <= 180.
  - Question mark count: exactly 1 `?` in entire response.
  - Ending: response must end with `?`.
- **Editorial Format Repair**: Exactly 1 bounded format repair generation on validation failure before failing closed.

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
3. **Controlled Provider Failure & State Preservation**:
   - Meeting 503 Provider Unavailable (Lenses Intact): `docs/evidence/deepseek-provider-consolidation/screenshots/meeting_unavailable_honest_state.png`
   - Albert 503 Provider Unavailable (Meeting Intact): `docs/evidence/deepseek-provider-consolidation/screenshots/albert_unavailable_honest_state.png`
   - Live Captured Provenance Manifest: `docs/evidence/deepseek-provider-consolidation/PROVIDER_PROVENANCE.json`
