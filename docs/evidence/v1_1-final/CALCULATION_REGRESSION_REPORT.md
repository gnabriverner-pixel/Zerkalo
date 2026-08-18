# Zerkalo V1.1 — Golden 25-Date Calculation Regression Report

Generated: 2026-08-18T10:07:08.856Z  
Target: Protocol Calculation v1 (`docs/canon/PROTOCOL_CALCULATION_V1.md`)  
Implementation: `src/services/calculator.ts`

## Summary
- **Total Tested Dates:** 25
- **CALC_GOLDEN_PARITY:** 25 / 25 (100.0%)
- **MATRIX_PARITY:** 25 / 25 (Base Matrix Exact Equality: 25/25, Detailed Matrix Exact Equality: 25/25)
- **Full Reduction-Chain & Composite Parity:** 25 / 25 (100% exact match on ЧУ, ЧВ, ЧД, ЧР, ЧИ composites)
- **Matrix Shape & Zero Exclusion:** 100% Verified (Strictly keys 1..9 in both `baseMatrix` and `detailedMatrix`, 0 excluded)
- **Strict DOB Validation:** 100% Verified (Leap-year aware Gregorian validation, rejection of 29.02 non-leap, 31.04, malformed, future dates)
- **Knowledge Invariant Guards:** 100% Verified (`getNumberKnowledge` throws on 0, 10, 11, 22, 33, -1, NaN)

## Verification Matrix

| DOB | ЧУ (Soul) | ЧВ (Expression) | ЧД (Path) | ЧР (Direction) | ЧИ (Result) | Matrix Parity | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 06.05.1986 | 6 (`6`) | 2 (`11/2`) | 8 (`35/8`) | 5 (`41/5`) | 1 (`82/10/1`) | ✓ Exact (25/25) | PASS |
| 01.01.2000 | 1 (`1`) | 2 (`2`) | 4 (`4`) | 5 (`5`) | 1 (`10/1`) | ✓ Exact (25/25) | PASS |
| 29.02.2000 | 2 (`29/11/2`) | 4 (`13/4`) | 6 (`15/6`) | 8 (`44/8`) | 7 (`88/16/7`) | ✓ Exact (25/25) | PASS |
| 31.12.1999 | 4 (`31/4`) | 7 (`7`) | 8 (`35/8`) | 3 (`66/12/3`) | 6 (`132/6`) | ✓ Exact (25/25) | PASS |
| 15.08.1990 | 6 (`15/6`) | 5 (`14/5`) | 6 (`33/6`) | 3 (`48/12/3`) | 6 (`96/15/6`) | ✓ Exact (25/25) | PASS |
| 23.09.1985 | 5 (`23/5`) | 5 (`14/5`) | 1 (`37/10/1`) | 6 (`60/6`) | 3 (`120/3`) | ✓ Exact (25/25) | PASS |
| 10.10.1980 | 1 (`10/1`) | 2 (`2`) | 2 (`20/2`) | 3 (`30/3`) | 6 (`60/6`) | ✓ Exact (25/25) | PASS |
| 07.07.1977 | 7 (`7`) | 5 (`14/5`) | 2 (`38/11/2`) | 9 (`45/9`) | 9 (`90/9`) | ✓ Exact (25/25) | PASS |
| 19.04.1995 | 1 (`19/10/1`) | 5 (`14/5`) | 2 (`38/11/2`) | 3 (`57/12/3`) | 6 (`114/6`) | ✓ Exact (25/25) | PASS |
| 28.11.1988 | 1 (`28/10/1`) | 3 (`12/3`) | 2 (`38/11/2`) | 3 (`66/12/3`) | 6 (`132/6`) | ✓ Exact (25/25) | PASS |
| 03.03.1993 | 3 (`3`) | 6 (`6`) | 1 (`28/10/1`) | 4 (`31/4`) | 8 (`62/8`) | ✓ Exact (25/25) | PASS |
| 12.06.1975 | 3 (`12/3`) | 9 (`9`) | 4 (`31/4`) | 7 (`43/7`) | 5 (`86/14/5`) | ✓ Exact (25/25) | PASS |
| 25.12.1982 | 7 (`25/7`) | 1 (`10/1`) | 3 (`30/3`) | 1 (`55/10/1`) | 2 (`110/2`) | ✓ Exact (25/25) | PASS |
| 09.09.1999 | 9 (`9`) | 9 (`18/9`) | 1 (`46/10/1`) | 1 (`55/10/1`) | 2 (`110/2`) | ✓ Exact (25/25) | PASS |
| 14.02.1984 | 5 (`14/5`) | 7 (`7`) | 2 (`29/11/2`) | 7 (`43/7`) | 5 (`86/14/5`) | ✓ Exact (25/25) | PASS |
| 18.07.1991 | 9 (`18/9`) | 7 (`16/7`) | 9 (`36/9`) | 9 (`54/9`) | 9 (`108/9`) | ✓ Exact (25/25) | PASS |
| 22.03.1987 | 4 (`22/4`) | 7 (`7`) | 5 (`32/5`) | 9 (`54/9`) | 9 (`108/9`) | ✓ Exact (25/25) | PASS |
| 11.11.1990 | 2 (`11/2`) | 4 (`4`) | 5 (`23/5`) | 7 (`34/7`) | 5 (`68/14/5`) | ✓ Exact (25/25) | PASS |
| 05.10.1972 | 5 (`5`) | 6 (`6`) | 7 (`25/7`) | 3 (`30/3`) | 6 (`60/6`) | ✓ Exact (25/25) | PASS |
| 27.08.1965 | 9 (`27/9`) | 8 (`17/8`) | 2 (`38/11/2`) | 2 (`65/11/2`) | 4 (`130/4`) | ✓ Exact (25/25) | PASS |
| 16.04.2001 | 7 (`16/7`) | 2 (`11/2`) | 5 (`14/5`) | 3 (`30/3`) | 6 (`60/6`) | ✓ Exact (25/25) | PASS |
| 04.05.1983 | 4 (`4`) | 9 (`9`) | 3 (`30/3`) | 7 (`34/7`) | 5 (`68/14/5`) | ✓ Exact (25/25) | PASS |
| 30.06.1978 | 3 (`30/3`) | 9 (`9`) | 7 (`34/7`) | 1 (`64/10/1`) | 2 (`128/11/2`) | ✓ Exact (25/25) | PASS |
| 21.12.1969 | 3 (`21/3`) | 6 (`6`) | 4 (`31/4`) | 7 (`52/7`) | 5 (`104/5`) | ✓ Exact (25/25) | PASS |
| 08.08.1988 | 8 (`8`) | 7 (`16/7`) | 6 (`42/6`) | 5 (`50/5`) | 1 (`100/1`) | ✓ Exact (25/25) | PASS |

## Conclusion
All calculation invariants, reduction chains, composite strings, and matrix structures strictly conform to Protocol Calculation v1 with exact deep equality across all 25 golden cases.
