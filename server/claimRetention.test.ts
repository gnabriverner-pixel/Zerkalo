import {it,expect} from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {signClaim,sweepExpiredClaims} from './handoff';

process.env.CONTINUATION_CLAIM_SECRET = 'unit-test-continuation-secret-32-characters-minimum';

it('removes only authenticated expired payloads; preserves active claims and foreign files',async()=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'zerkalo-retention-'));
  const expired='a'.repeat(43), active='b'.repeat(43),invalid='c'.repeat(43);
  for(const [id,expiresAt,valid] of [[expired,'2026-01-01T00:00:00Z',true],[active,'2030-01-01T00:00:00Z',true],[invalid,'2026-01-01T00:00:00Z',false]] as const){
    await fs.writeFile(path.join(dir,id+'.json'),JSON.stringify({claimId:id,expiresAt,signature:valid?signClaim(id,expiresAt):'bad',envelope:{synthetic:true}}));
  }
  await fs.writeFile(path.join(dir,'unrelated.json'),'{}');
  expect(await sweepExpiredClaims(dir,Date.parse('2026-09-09T00:00:00Z'))).toBe(1);
  expect((await fs.readdir(dir)).sort()).toEqual([active+'.json',invalid+'.json','unrelated.json'].sort());
  expect((await fs.stat(path.join(dir,active+'.json'))).mode & 0o777).toBe(0o660);
  expect(await sweepExpiredClaims(dir,Date.parse('2026-09-09T00:00:00Z'))).toBe(0);
  await fs.rm(dir,{recursive:true});
});
