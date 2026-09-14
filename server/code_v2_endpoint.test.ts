import { describe, it, expect } from "vitest";
import { calculateCanonicalCodeV2 } from "./dcsBridge";

describe("Code V2 Canonical Authority Suite", () => {
  const testDobs = [
    {
      dob: "06.05.1986",
      expected: { soul: 6, expression: 2, path: 8, direction: 5, result: 1 },
    },
    {
      dob: "06.09.1991",
      expected: { soul: 6, expression: 6, path: 8, direction: 5, result: 1 },
    },
    {
      dob: "18.12.1989",
      expected: { soul: 9, expression: 3, path: 3, direction: 3, result: 6 },
    },
    {
      dob: "01.10.1990",
      expected: { soul: 1, expression: 2, path: 3, direction: 4, result: 8 },
    },
  ];

  for (const { dob, expected } of testDobs) {
    it(`calculates structured Code V2 payload for ${dob}`, async () => {
      const payload = await calculateCanonicalCodeV2(dob);
      expect(payload.status).toBe("ok");
      expect(payload.calculation.date).toBe(dob);
      expect(payload.calculation.five_numbers).toEqual(expected);

      // 5 Positions
      expect(payload.positions).toHaveLength(5);
      const names = payload.positions.map((p) => p.public_name);
      expect(names).toEqual([
        "Число Души",
        "Число Выражения",
        "Число Пути",
        "Число Направления",
        "Число Результата",
      ]);

      // Transparent calculation chain
      expect(payload.calculation.calculation_chain).toHaveLength(5);
      for (const step of payload.calculation.calculation_chain) {
        expect(step.calculation).toBeDefined();
        expect(step.calculation.length).toBeGreaterThan(0);
      }

      // Method orientation
      expect(payload.method_orientation.summary).toContain("Цифровой Код");
      expect(payload.method_orientation.epistemic_frame).toContain("систему гипотез");

      // 1-3 Interactions with human headings
      expect(payload.interactions.length).toBeGreaterThanOrEqual(1);
      expect(payload.interactions.length).toBeLessThanOrEqual(3);
      for (const inter of payload.interactions) {
        expect(inter.heading.length).toBeGreaterThan(5);
        expect(inter.meaning.length).toBeGreaterThan(10);
        // No debug leaks
        expect(inter.meaning).not.toContain("[TENSION]");
        expect(inter.meaning).not.toContain("[RESONANCE]");
        expect(inter.meaning).not.toContain("TENSION 88");
      }

      // Synthesis & Albert Context
      expect(payload.synthesis.strongest_motif.length).toBeGreaterThan(20);
      expect(payload.albert_context.calculated_map).toEqual(expected);
      expect(payload.albert_context.opening_statement.length).toBeGreaterThan(20);
      expect(payload.albert_context.opening_question.length).toBeGreaterThan(10);
    });
  }

  it("fails closed on invalid DOB", async () => {
    await expect(calculateCanonicalCodeV2("99.99.9999")).rejects.toThrow();
    await expect(calculateCanonicalCodeV2("")).rejects.toThrow();
    await expect(calculateCanonicalCodeV2("abc")).rejects.toThrow();
  });
});
