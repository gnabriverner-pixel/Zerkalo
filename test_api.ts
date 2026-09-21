// Ad-hoc canonical API check — synthetic fixture only.
//
// DO NOT USE REAL USER DOB. The date below is the documented synthetic smoke
// fixture (see server/production_smoke_fixture.test.ts for its enforced
// properties). Prefer scripts/production_smoke.sh for the full structural
// production smoke; this file stays as a minimal one-shot canonical check.
const SYNTHETIC_SMOKE_DOB = '01.07.1990';

async function test() {
  const consent = await fetch('http://localhost:3000/api/consent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3000' },
    body: JSON.stringify({ accepted: true, adult: true, version: 'zerkalo-2026-09-v1', scope: 'core' }),
  });
  const cookie = consent.headers.get('set-cookie')?.split(';')[0] || '';

  const res = await fetch('http://localhost:3000/api/calculate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ dob: SYNTHETIC_SMOKE_DOB }),
  });
  const data = await res.json();
  console.log(data);
}
test();
