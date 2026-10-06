// @vitest-environment node
import {describe,it,expect,vi,afterEach} from 'vitest';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {CommerceStore} from './commerceStore';
afterEach(()=>vi.unstubAllEnvs());
describe('explicit shared SQLite opt-in',()=>{
  it('keeps ordinary database and process lock private after reopen',()=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'private-commerce-')),filename=path.join(dir,'stories.sqlite');try{for(let i=0;i<2;i++){const s=new CommerceStore(filename,'a'.repeat(64));expect(fs.statSync(filename).mode&0o777).toBe(0o600);expect(fs.statSync(filename+'.process.lock').mode&0o777).toBe(0o600);s.close();}}finally{fs.rmSync(dir,{recursive:true,force:true});}});
  it('fails closed for an unapproved local identity instead of widening its data',()=>{if([997,999].includes(process.getuid?.()??-1))return;vi.stubEnv('COMMERCE_SHARED_SQLITE','true');const dir=fs.mkdtempSync(path.join(os.tmpdir(),'shared-commerce-')),filename=path.join(dir,'stories.sqlite');try{expect(()=>new CommerceStore(filename,'a'.repeat(64))).toThrow('commerce_shared_identity_invalid');expect(fs.existsSync(filename)).toBe(false);}finally{fs.rmSync(dir,{recursive:true,force:true});}});
});
