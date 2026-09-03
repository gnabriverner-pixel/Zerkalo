import { describe, it, expect } from "vitest";
import { calculateCanonicalDigitalCode, computeCanonicalFallback } from "../server/dcsBridge";
import { legacyCalculateDigitalCodeTs } from "../src/services/calculator";

describe("Calculation Parity Suite: DCS Canon vs Zerkalo DTO", () => {
  const goldenDates = [
    "06.05.1986",
    "15.03.1990",
    "01.01.1900",
    "31.12.1999",
    "29.02.2000", // Leap year
    "29.02.2024", // Leap year
    "07.07.1977",
    "11.11.1989", // Master numbers
    "22.02.2022",
    "09.09.1999",
    "10.10.2010",
    "05.08.1965",
    "18.04.1982",
    "25.12.1995",
    "03.06.2001",
    "14.07.1987",
    "21.09.1993",
    "28.10.1984",
    "04.11.2005",
    "12.12.2012",
  ];

  for (const dob of goldenDates) {
    it(`guarantees canonical parity for ${dob}`, async () => {
      const canonical = await calculateCanonicalDigitalCode(dob);
      const fallback = computeCanonicalFallback(dob);
      const legacyTs = legacyCalculateDigitalCodeTs(dob);

      // 1. Five numbers exact match
      expect(canonical.soul).toBe(fallback.soul);
      expect(canonical.soul).toBe(legacyTs.soul);

      expect(canonical.path).toBe(fallback.path);
      expect(canonical.path).toBe(legacyTs.path);

      expect(canonical.direction).toBe(fallback.direction);
      expect(canonical.direction).toBe(legacyTs.direction);

      expect(canonical.expression).toBe(fallback.expression);
      expect(canonical.expression).toBe(legacyTs.expression);

      expect(canonical.result).toBe(fallback.result);
      expect(canonical.result).toBe(legacyTs.result);

      // 2. Base Matrix exact match
      for (let i = 1; i <= 9; i++) {
        const key = String(i);
        expect(canonical.baseMatrix[key]).toBe(fallback.baseMatrix[key]);
        expect(canonical.baseMatrix[key]).toBe(legacyTs.baseMatrix[key]);
      }

      // 3. Detailed Matrix exact match
      for (let i = 1; i <= 9; i++) {
        const key = String(i);
        expect(canonical.detailedMatrix[key]).toBe(fallback.detailedMatrix[key]);
        expect(canonical.detailedMatrix[key]).toBe(legacyTs.detailedMatrix[key]);
      }

      // 4. Canonical authority tag
      expect(canonical.canonicalAuthority).toBe("digital-code-system/engine.py::full_analysis");
    });
  }
});
