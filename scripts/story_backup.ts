import fs from 'node:fs';import path from 'node:path';
import {CommerceStore,CommerceError} from '../server/commerceStore';

export function backupStories(store:CommerceStore,directory:string){
  if(store.filename===':memory:')throw new CommerceError('persistent_store_required');
  fs.mkdirSync(directory,{recursive:true,mode:0o700});
  const target=path.resolve(directory,'stories.sqlite');if(fs.existsSync(target))throw new CommerceError('backup_exists');
  store.db.exec(`VACUUM INTO '${target.replaceAll("'","''")}'`);fs.chmodSync(target,0o600);
  // Synchronous snapshot/copies: the owning Node process cannot interleave deletion.
  for(const suffix of ['.deletions.jsonl','.revocations.jsonl'])fs.writeFileSync(target+suffix,fs.existsSync(store.filename+suffix)?fs.readFileSync(store.filename+suffix):'',{mode:0o600});
  fs.writeFileSync(path.join(directory,'backup.json'),JSON.stringify({captured_at:new Date().toISOString(),schema:'story-backup-v1',encrypted:true,env_or_keys_included:false,requires_current_deletion_and_revocation_journals:true})+'\n',{mode:0o600});
  return target;
}
export function restoreStories(backup:string,target:string,key:string,currentDeletionJournal:string,currentRevocationJournal:string){
  // Never replace a database that may contain newer paid obligations/payments.
  if(fs.existsSync(target))throw new CommerceError('restore_target_exists',503);
  if(!fs.existsSync(currentDeletionJournal)||!fs.existsSync(currentRevocationJournal))throw new CommerceError('current_revocations_required',503);
  const merged=(suffix:string,current:string)=>{
    const sources=[backup+suffix,current];const lines=sources.flatMap(p=>fs.existsSync(p)?fs.readFileSync(p,'utf8').split('\n').filter(Boolean):[]);
    for(const line of lines){const row=JSON.parse(line);if(suffix==='.deletions.jsonl'?!/^[a-f0-9]{64}$/.test(row.account_hash):!/^[a-f0-9-]{36}$/.test(row.order_id))throw new CommerceError('invalid_recovery_journal',503);}
    return [...new Set(lines)].join('\n')+'\n';
  };
  const deletions=merged('.deletions.jsonl',currentDeletionJournal),revocations=merged('.revocations.jsonl',currentRevocationJournal);
  fs.mkdirSync(path.dirname(target),{recursive:true,mode:0o700});fs.copyFileSync(backup,target);fs.chmodSync(target,0o600);
  fs.writeFileSync(target+'.deletions.jsonl',deletions,{mode:0o600});fs.writeFileSync(target+'.revocations.jsonl',revocations,{mode:0o600});
  const store=new CommerceStore(target,key);
  // A backup cannot prove post-snapshot provider spending or merchant state.
  store.db.prepare('INSERT OR REPLACE INTO configuration VALUES (?,?)').run('ai_budget_recovery_locked','1');
  store.close();return {restored:true,financial_reconciliation_required:true,models_and_new_sales_disabled:true};
}
