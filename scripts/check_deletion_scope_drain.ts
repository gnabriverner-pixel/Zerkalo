// Proves the final-copy-after-drain procedure locally; never opens production scopes.
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import crypto from 'node:crypto';import {execFileSync} from 'node:child_process';
const root=fs.mkdtempSync(path.join(os.tmpdir(),'scope-drain-'));fs.chmodSync(root,0o700);
const old=path.join(root,'old.json'),target=path.join(root,'new.json'),stale=path.join(root,'stale.json');
const secret=crypto.randomBytes(32).toString('hex'),repo=process.cwd(),entry=new URL('../server/deletion.ts',import.meta.url).href;
const run=(file:string,code:string)=>execFileSync(process.execPath,['--import',path.join(repo,'node_modules/tsx/dist/loader.mjs'),'--input-type=module','-e',code],{cwd:root,env:{...process.env,DELETION_SCOPES_FILE:file,DELETION_LOOKUP_SECRET:secret},encoding:'utf8'});
const prelude=`import fs from 'node:fs';import {registerDeletionScope,executeDataDeletion,verifyDeletionSecretStability} from ${JSON.stringify(entry)};`;
run(old,prelude+`registerDeletionScope('synthetic-delete-A',{cacheKey:'opaque_A'});registerDeletionScope('synthetic-keep-B',{cacheKey:'opaque_B'});fs.copyFileSync(process.env.DELETION_SCOPES_FILE,${JSON.stringify(stale)});if((await executeDataDeletion('synthetic-delete-A')).status!=='ok')throw Error('delete_failed');registerDeletionScope('synthetic-final-C',{cacheKey:'opaque_C'});`);
// The old writer has exited. No stale union/merge is performed; the final source is authoritative.
const final=fs.readFileSync(old),envelope=JSON.parse(final.toString());if(envelope.scopes.length!==2)throw Error('final_scope_count');
const temporary=target+'.new',fd=fs.openSync(temporary,'wx',0o600);fs.writeFileSync(fd,final);fs.fsyncSync(fd);fs.closeSync(fd);fs.renameSync(temporary,target);
const dir=fs.openSync(root,'r');fs.fsyncSync(dir);fs.closeSync(dir);const transferMode=(fs.statSync(target).mode&0o777).toString(8);
const check=JSON.parse(run(target,prelude+`verifyDeletionSecretStability();const deleted=await executeDataDeletion('synthetic-delete-A'),b=await executeDataDeletion('synthetic-keep-B'),c=await executeDataDeletion('synthetic-final-C');if(deleted.code!=='deletion_scope_not_found'||b.status!=='ok'||c.status!=='ok')throw Error('resurrection_or_lost_scope');console.log(JSON.stringify({deleted:deleted.code,b:b.status,c:c.status}));`));
const proof={status:'PASS',synthetic:true,old_writer_drained:true,preliminary_scope_count:JSON.parse(fs.readFileSync(stale,'utf8')).scopes.length,final_scope_count:envelope.scopes.length,final_copy_sha256:crypto.createHash('sha256').update(final).digest('hex'),transfer_mode:transferMode,mode_after_existing_writer_rewrite:(fs.statSync(target).mode&0o777).toString(8),parent_mode:(fs.statSync(root).mode&0o777).toString(8),same_secret_verified:true,checks:check,scope_data_or_secrets_exported:false};
if(process.env.STORY_EVIDENCE_DIR){fs.mkdirSync(process.env.STORY_EVIDENCE_DIR,{recursive:true});fs.writeFileSync(path.join(process.env.STORY_EVIDENCE_DIR,'deletion-scope-drain-proof.json'),JSON.stringify(proof,null,2));}
console.log(JSON.stringify(proof));
