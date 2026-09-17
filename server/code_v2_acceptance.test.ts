import { describe, expect, it } from 'vitest';
import { calculateCanonicalCodeV2 } from './dcsBridge';

const ACCEPTANCE_DOBS = [
  { dob: '06.05.1986', expected: { soul: 6, expression: 2, path: 8, direction: 5, result: 1 } },
  { dob: '06.09.1991', expected: { soul: 6, expression: 6, path: 8, direction: 5, result: 1 } },
  { dob: '18.12.1989', expected: { soul: 9, expression: 3, path: 3, direction: 3, result: 6 } },
  { dob: '01.10.1990', expected: { soul: 1, expression: 2, path: 3, direction: 4, result: 8 } },
];

const FORBIDDEN_LEGACY_TERMS = [
  'Число Ума',
  'Число Действия',
  'Число Реализации',
  'Число Итога',
  'ЧД',
  'ЧВ',
  'ЧП',
  'ЧН',
  'ЧР'
];

describe('Owner Code V2 Vertical Slice Acceptance Suite', () => {
  for (const { dob, expected } of ACCEPTANCE_DOBS) {
    it(`delivers fully compliant V2 payload for DOB ${dob}`, async () => {
      const payload = await calculateCanonicalCodeV2(dob);

      expect(payload).toBeDefined();
      expect(payload.status).toBe('ok');

      // 1. Calculation & Numbers
      expect(payload.calculation.date).toBe(dob);
      expect(payload.calculation.five_numbers).toEqual(expected);
      expect(payload.calculation.compound_routes.soul).toBeDefined();
      expect(payload.calculation.compound_routes.expression).toBeDefined();
      expect(payload.calculation.compound_routes.path).toBeDefined();
      expect(payload.calculation.compound_routes.direction).toBeDefined();
      expect(payload.calculation.compound_routes.result).toBeDefined();

      // Calculation chain
      expect(payload.calculation.calculation_chain).toHaveLength(5);
      for (const step of payload.calculation.calculation_chain) {
        expect(step.position).toBeDefined();
        expect(step.public_name).toBeDefined();
        expect(step.formula_label.length).toBeGreaterThan(0);
        expect(step.calculation.length).toBeGreaterThan(0);
        expect(step.rule.length).toBeGreaterThan(0);
      }

      // 2. Method Orientation
      expect(payload.method_orientation.summary.length).toBeGreaterThan(20);
      expect(payload.method_orientation.epistemic_frame.length).toBeGreaterThan(20);
      expect(payload.method_orientation.core_law.length).toBeGreaterThan(20);
      expect(payload.method_orientation.target_questions).toHaveLength(5);

      // 3. Positions (5 roles)
      expect(payload.positions).toHaveLength(5);
      const expectedRoles = ['Внутренний исток', 'Раскрытие потенциала вовне', 'Осваиваемый способ действия', 'Формат среды', 'Возможный горизонт'];
      for (const pos of payload.positions) {
        expect(expectedRoles).toContain(pos.role);
        expect(pos.role_question.length).toBeGreaterThan(5);
        expect(pos.headline_mechanism.length).toBeGreaterThan(2);
        expect(pos.essence.length).toBeGreaterThan(30);
        expect(pos.strong_form.length).toBeGreaterThan(15);
        expect(pos.shadow.length).toBeGreaterThan(15);
        expect(pos.tension.length).toBeGreaterThan(15);
        expect(pos.life_scenes.length).toBeGreaterThanOrEqual(1);
        expect(pos.verification_question.length).toBeGreaterThan(10);
      }

      // 4. Key Connections (1-3 interactions without debug scores)
      expect(payload.interactions.length).toBeGreaterThanOrEqual(1);
      expect(payload.interactions.length).toBeLessThanOrEqual(3);
      for (const inter of payload.interactions) {
        expect(inter.heading.length).toBeGreaterThan(3);
        expect(inter.category.length).toBeGreaterThan(3);
        expect(inter.meaning.length).toBeGreaterThan(20);
        // Ensure no debug scores or raw enum leaks in headings
        expect(inter.heading).not.toMatch(/TENSION/i);
        expect(inter.heading).not.toMatch(/RESONANCE/i);
        expect(inter.heading).not.toMatch(/\d+\.\d+/); // no floating-point scores like 0.85
      }

      // 5. Synthesis Motif & Environment
      expect(payload.synthesis.strongest_motif.length).toBeGreaterThan(50);
      expect(payload.synthesis.environment.summary.length).toBeGreaterThan(30);
      expect(payload.synthesis.mature_integration.summary.length).toBeGreaterThan(30);

      // 6. Personal Verification
      expect(payload.verification.length).toBeGreaterThanOrEqual(2);
      for (const q of payload.verification) {
        expect(q.length).toBeGreaterThan(10);
      }

      // 7. Contextual Albert Handoff
      expect(payload.albert_context.opening_statement.length).toBeGreaterThan(20);
      expect(payload.albert_context.opening_question.length).toBeGreaterThan(10);
      expect(payload.albert_context.albert_canonical_quote.length).toBeGreaterThan(20);
      expect(payload.albert_context.provenance_status).toBe('V2_ACCEPTED_LIBRARY');

      // 8. Strict Vocabulary Hygiene (No legacy names)
      const payloadString = JSON.stringify(payload);
      for (const forbidden of FORBIDDEN_LEGACY_TERMS) {
        expect(payloadString).not.toContain(forbidden);
      }
    });
  }
});
