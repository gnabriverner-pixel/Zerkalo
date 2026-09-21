import { describe, it, expect } from "vitest";
import { readFileSync, statSync } from "fs";
import path from "path";

/**
 * Release-hygiene guard for the synthetic production smoke fixture.
 *
 * T6 policy: production smoke must never carry a real person's date of birth.
 * The only permitted fixture is SYNTHETIC_SMOKE_DOB declared in
 * scripts/production_smoke.sh. This test enforces, deterministically and
 * offline:
 *   1. the fixture itself is valid, adult and free of edge-case properties;
 *   2. every production-facing smoke/release script uses that same fixture;
 *   3. none of those scripts contains a known real or QA-preset DOB;
 *   4. the smoke asserts structure only and never touches Telegram,
 *      payments or delete-data flows.
 *
 * This is a targeted guard over the release/smoke tooling only — NOT a
 * universal PII scanner. The calculation canon golden case (documented in
 * docs/canon/PROTOCOL_CALCULATION_V1.md and scanned by
 * scripts/bundle_hygiene_gate.sh for the browser bundle) legitimately stays
 * in server-side canon tests and is out of scope here.
 */

const repoRoot = path.resolve(__dirname, "..");
const FORBIDDEN_DOBS = [
  // Owner's real DOB (used by pre-T6 smoke) and the QA preset dates that
  // bundle_hygiene_gate.sh already treats as non-shippable markers.
  "06.05.1986",
  "06.09.1991",
  "18.12.1989",
  "01.10.1990",
  // Leap-day edge date previously used by the mobile browser smoke route.
  "29.02.2000",
];

const smokeScript = readFileSync(path.join(repoRoot, "scripts/production_smoke.sh"), "utf8");
// Comments document the policy (including which flows are off-limits); the
// structural scan below must judge executable lines only.
const smokeCode = smokeScript
  .split("\n")
  .filter((line) => !line.trim().startsWith("#"))
  .join("\n");
const releaseVerifier = readFileSync(path.join(repoRoot, "scripts/release_verifier.sh"), "utf8");
const browserSmoke = readFileSync(path.join(repoRoot, "scripts/run_browser_smoke.ts"), "utf8");
const testApi = readFileSync(path.join(repoRoot, "test_api.ts"), "utf8");
const liveSpec = readFileSync(path.join(repoRoot, "tests/live_myth_synthetic.spec.ts"), "utf8");

function parseFixture(source: string): string | null {
  return source.match(/SYNTHETIC_SMOKE_DOB\s*[:=]\s*["'](\d{2}\.\d{2}\.\d{4})["']/)?.[1] ?? null;
}

function parseVerifierDob(source: string): string | null {
  return source.match(/code_v2_payload\.py --dob (\d{2}\.\d{2}\.\d{4})/)?.[1] ?? null;
}

describe("Synthetic production smoke fixture", () => {
  const fixture = parseFixture(smokeScript);

  it("is declared exactly once as the smoke constant", () => {
    expect(fixture).toBe("01.07.1990");
    expect(smokeCode.match(/SYNTHETIC_SMOKE_DOB=/g)).toHaveLength(1);
  });

  it("carries the DO NOT USE REAL USER DOB protection", () => {
    expect(smokeScript).toContain("DO NOT USE REAL USER DOB");
    expect(smokeScript).toContain("Never the owner's DOB");
  });

  it("is a valid, unambiguous DD.MM.YYYY calendar date", () => {
    expect(fixture).toMatch(/^\d{2}\.\d{2}\.\d{4}$/);
    const [day, month, year] = (fixture as string).split(".").map(Number);
    const asDate = new Date(Date.UTC(year, month - 1, day));
    expect(asDate.getUTCFullYear()).toBe(year);
    expect(asDate.getUTCMonth()).toBe(month - 1);
    expect(asDate.getUTCDate()).toBe(day);
  });

  it("is an adult (18+) at the T6 policy date and stays adult today", () => {
    const [day, month, year] = (fixture as string).split(".").map(Number);
    const ageAt = (atMs: number) => {
      const at = new Date(atMs);
      let age = at.getUTCFullYear() - year;
      const beforeBirthday =
        at.getUTCMonth() + 1 < month ||
        (at.getUTCMonth() + 1 === month && at.getUTCDate() < day);
      if (beforeBirthday) age -= 1;
      return age;
    };
    // Policy anchor: hardening introduced 2026-09-21.
    expect(ageAt(Date.UTC(2026, 8, 21))).toBeGreaterThanOrEqual(18);
    expect(ageAt(Date.now())).toBeGreaterThanOrEqual(18);
  });

  it("has no special edge-case properties", () => {
    const [day, month] = (fixture as string).split(".").map(Number);
    expect(day).toBeLessThanOrEqual(28); // no month-length edge
    expect(month).not.toBe(2); // no leap-day edge
    expect(month).toBeGreaterThanOrEqual(2);
    expect(month).toBeLessThanOrEqual(11); // no year-boundary edge
  });

  it("is not one of the forbidden real or QA-preset dates", () => {
    expect(FORBIDDEN_DOBS).not.toContain(fixture);
  });

  it("is not pinned by any expected numeric result in this test", () => {
    // The fixture is chosen so nothing anywhere depends on its numbers; the
    // smoke itself asserts structure only.
    expect(smokeCode).not.toMatch(/result\[k\]\s*===\s*\d/);
    expect(smokeCode).not.toMatch(/five_numbers\[k\]\s*===\s*\d/);
  });
});

describe("Production-facing smoke scripts use the synthetic fixture only", () => {
  const guarded: Array<[string, string]> = [
    ["scripts/production_smoke.sh", smokeScript],
    ["scripts/run_browser_smoke.ts", browserSmoke],
    ["test_api.ts", testApi],
    ["tests/live_myth_synthetic.spec.ts", liveSpec],
  ];

  it.each(guarded)("%s contains no forbidden real/QA DOB", (_name, source) => {
    for (const dob of FORBIDDEN_DOBS) {
      expect(source).not.toContain(dob);
    }
  });

  it.each(guarded)("%s declares the same synthetic fixture", (_name, source) => {
    expect(parseFixture(source)).toBe("01.07.1990");
  });

  it("release_verifier.sh drives its code-v2 payload check with the same fixture", () => {
    expect(parseVerifierDob(releaseVerifier)).toBe("01.07.1990");
    expect(releaseVerifier).toContain("DO NOT USE REAL USER DOB");
    for (const dob of FORBIDDEN_DOBS) {
      expect(releaseVerifier).not.toContain(dob);
    }
  });

  it("production_smoke.sh is executable", () => {
    const mode = statSync(path.join(repoRoot, "scripts/production_smoke.sh")).mode;
    expect(mode & 0o111).not.toBe(0);
  });
});

describe("Production smoke checks structure only and stays off restricted flows", () => {
  it("asserts the canonical authority and structural schema", () => {
    expect(smokeCode).toContain("digital-code-system/engine.py::full_analysis");
    expect(smokeCode).toContain("five_numbers");
    expect(smokeCode).toContain("positions.length === 5");
  });

  it("never invokes Telegram, payment, handoff or delete-data flows", () => {
    const restricted = [/telegram/i, /payment/i, /delete-data/, /create-claim/, /handoff/];
    for (const pattern of restricted) {
      expect(smokeCode).not.toMatch(pattern);
    }
  });
});
