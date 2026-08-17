# My Mirror V0 — Minimal Local Persistence Bridge Report (Issue #20)

## 1. Metadata
- **START_SHA**: `83de45900d87c4107d89a5b14210ee73e7b5b830`
- **TESTED_HEAD**: `b1b95e8f858a848d84c6352b85ed1744faa127f6`
- **Scope Contract**: GitHub Issue #20 + OWNER REVIEW (BOUNDED_CORRECTION_REQUIRED)
- **Status**: COMPLETE & VERIFIED

---

## 2. Bounded Correction Architecture & Integrity Fixes

### A. Derived Meeting Invalidation on Source Lens Changes
1. **New Code Calculation**:
   - When a new Code is calculated (`onCodeCalculated`), `App.tsx` sets the new `codeDate`, `codeResult`, `firstMirror` (`reading || null`), and explicitly resets active `meetingResult` to `null` and `meetingUserNote` to `''`.
2. **New Personal Myth Completion**:
   - When a new Personal Myth is completed (`onMythCompleted`), `App.tsx` sets the new `storyInputs` and `storyResult`, and explicitly resets active `meetingResult` to `null` and `meetingUserNote` to `''`.
3. **DOB Change on Entry**:
   - When entry submits a new DOB via `onSelectMode('code', initialDate)`, if `initialDate` differs from active `codeDate`, `codeResult`, `firstMirror`, `meetingResult`, and `meetingUserNote` are immediately invalidated before entering Code calculation.

### B. Persistent Local Snapshot Preservation
- In-memory invalidations do **not** delete or touch the `localStorage` key `zerkalo.myMirror.v1`.
- The previously saved snapshot remains safe and restorable via "Открыть сохранённое" on the threshold entry view until the user explicitly deletes or overwrites it.

### C. Session-Truthful Save Badge
- In `MeetingOfMirrors.tsx`, the save status (`savedAt`) is determined via `isSnapshotMatchingCurrentSession()`.
- If an active Meeting does not match the stored snapshot (e.g. following a recalculation or new synthesis), `savedAt` evaluates to `null` and the UI shows `Сохранить в «Моё зеркало»` and `Сохранить на этом устройстве`, preventing false positive save badges.
- After explicit Save, `isSnapshotMatchingCurrentSession()` evaluates to `true` and the badge `✓ Сохранено в этом браузере` is displayed.

---

## 3. Storage Schema V1 & Constraints

### Storage Key
`zerkalo.myMirror.v1`

### Exact Persisted Fields
- `version: 1`
- `savedAt: string` (ISO timestamp)
- `codeDate: string` (DOB)
- `codeResult: CalculationResult` (Vedic numerology calculation)
- `firstMirror: FirstMirror` (Formula-level synthesis reading)
- `storyInputs: StoryInputs` (The 4 user answers: `q1`, `q2`, `q3`, `q4`)
- `storyResult: ApiResponse['story_result']` (Personal Myth result)
- `meetingResult: MeetingOfMirrorsResult` (Synthesis summary, parallels, divergences, albertInsight, reflectiveQuestion, disclaimer)
- `meetingUserNote?: string` (Optional user reflective notes)

### Explicitly Excluded Fields
- API keys, env vars, provider credentials
- Albert conversation chat history
- Feedback records, telemetry, A/B testing state
- System prompts, identity tokens, tracking cookies

---

## 4. Verification & Regression Results

### Targeted Session Integrity Regression Suite (`src/services/sessionIntegrity.test.ts`)
1. **Meeting A exists → new Code calculation**: Active `meetingResult === null`, note cleared. Passed.
2. **Meeting A exists → new Myth completion**: Active `meetingResult === null`, note cleared. Passed.
3. **Different DOB entry**: In-memory Code, FirstMirror, and Meeting invalidated. Passed.
4. **localStorage snapshot preservation**: Snapshot survives in-memory invalidation intact. Passed.
5. **Restoration after invalidation**: Saved snapshot explicitly restored cleanly without data loss. Passed.
6. **Save badge session specificity**: False for active Meeting B when snapshot A exists. Passed.
7. **Explicit Save activation**: Makes save badge true for current session. Passed.

### Test Results
- **Vitest Unit & Integration**: 13 test files passed, 64 tests passed.
- **TypeScript Typecheck (`tsc --noEmit`)**: 0 errors.
- **Production Build (`vite build`)**: Clean production bundle generated in 2.92s.
- **Automated Playwright Regression Runner (`scripts/run_my_mirror_correction_regression.cjs`)**: 100% passed with zero errors.

---

## 5. Phone-First (390×844) Screenshots

1. `01-save-my-mirror-after-meeting-390x844.png` [SYNTHETIC_UI_STATE]: Completed Meeting with Web Albert primary CTA, secondary Telegram link, and truthful device-local save UI card.
2. `02-save-confirmation-390x844.png`: Restrained confirmation `✓ Сохранено в этом браузере` and update/delete actions.
3. `03-entry-saved-mirror-390x844.png`: Threshold entry view after real reload presenting "Моё зеркало" card without auto-restoring.
4. `04-restored-meeting-390x844.png`: Restored completed Meeting view opened explicitly with 0 provider calls.
5. `05-restored-albert-context-390x844.png`: Web Albert modal opened from restored Meeting with formula context strip.
6. `06-delete-saved-mirror-390x844.png`: Post-delete clean state confirming storage key removal and UI reset.

---

## 6. Changed Files in Correction
- `src/App.tsx`: Added invalidation of derived `meetingResult` and `meetingUserNote` on Code/Myth change and DOB switch.
- `src/components/MeetingOfMirrors.tsx`: Wired `isSnapshotMatchingCurrentSession` for truthful session-specific save badge.
- `src/services/myMirrorStorage.ts`: Added `isSnapshotMatchingCurrentSession` comparison helper.
- `src/services/sessionIntegrity.test.ts`: Added 7 comprehensive regression tests.
- `scripts/run_my_mirror_correction_regression.cjs`: Added automated end-to-end regression runner.
- `docs/evidence/my-mirror-v0/MY_MIRROR_V0_REPORT.md`: Updated evidence report.

---

## 7. Quality Gate Audit
- **BLOCKERS**: NONE
- **MAJORS**: NONE
- **MINORS_NOT_FIXED**: NONE
