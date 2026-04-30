# 01_INPUT_SCHEMA — Big Research Prompt Pack

This file defines the expected input for Big Research generation.

## Required input

```json
{
  "client": {
    "name": "string",
    "birth_date": "DD.MM.YYYY",
    "birth_place": "optional string",
    "request": "optional string"
  },
  "calculation": {
    "formula": "string",
    "mind_number": {
      "root": "number",
      "compound": "number | null",
      "planet": "string"
    },
    "action_number": {
      "root": "number",
      "compound": "number | null",
      "planet": "string"
    },
    "expression_number": {
      "root": "number | null",
      "compound": "number | null",
      "planet": "string | null"
    },
    "realization_number": {
      "root": "number",
      "compound": "number | null",
      "planet": "string"
    },
    "outcome_number": {
      "root": "number",
      "compound": "number | null",
      "planet": "string"
    },
    "personal_year": {
      "year": "number | null",
      "root": "number | null",
      "planet": "string | null"
    },
    "matrix": {
      "base_digits": "array",
      "detailed_digits": "array",
      "lines": "object"
    }
  },
  "optional_context": {
    "personal_myth_answers": "optional object",
    "user_notes": "optional string",
    "operator_notes": "optional string"
  }
}
```

## Rules

- If a value is missing, do not invent it.
- If `expression_number` is not used by current product logic, omit that section or mark it as not included.
- If `personal_year` is missing, do not write current-period interpretation.
- If user context is provided, use it as a lens, not as a replacement for calculation.

## Output expectation

The generated report should preserve calculation traceability. Every major claim should be clearly linked to one of:

- a number position;
- a compound number;
- matrix structure;
- current period;
- user-provided context;
- interpretive synthesis across these elements.
