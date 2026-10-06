/** Two immutable historical accounting records only. No stories, keys, windows or provider I/O. */
import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';

export const HISTORICAL_DEBITS=[
  {id:'1a0651f1-f37f-4a97-a8cb-2dee14a0baab',pool:'free',order_id:null,model:'deepseek/deepseek-v4.1-flash',cost_micro:4395289,state:'complete',created_at:1791319960838,finished_at:1791319968800,estimate_version:'ca5c92d7188e8f90eb30d976226cf2c9628e4fad2d8441c04ec7e2d5ddc43dc0',policy_version:'request-components-v2',input_tokens:4700,output_tokens:1272,usage_cost:0.171458956149624,usage_currency:'UNKNOWN',duration_ms:7962,outcome:'success'},
  {id:'382ab82e-1cae-490c-b288-85d2d24d415c',pool:'free',order_id:null,model:'deepseek/deepseek-v4.1-flash',cost_micro:2025852,state:'complete',created_at:1791319970755,finished_at:1791319972799,estimate_version:'ca5c92d7188e8f90eb30d976226cf2c9628e4fad2d8441c04ec7e2d5ddc43dc0',policy_version:'request-components-v2',input_tokens:4122,output_tokens:158,usage_cost:0.066039811638372,usage_currency:'UNKNOWN',duration_ms:1987,outcome:null},
] as const;
const SCHEMA=[['id','TEXT',0,1],['pool','TEXT',1,0],['order_id','TEXT',0,0],['model','TEXT',1,0],['cost_micro','INTEGER',1,0],['state','TEXT',1,0],['created_at','INTEGER',1,0],['finished_at','INTEGER',0,0],['estimate_version','TEXT',0,0],['policy_version','TEXT',0,0],['input_tokens','INTEGER',0,0],['output_tokens','INTEGER',0,0],['usage_cost','REAL',0,0],['usage_currency','TEXT',0,0],['duration_ms','INTEGER',0,0],['outcome','TEXT',0,0]];

export function importHistoricalDebits(db:DatabaseSync){
  db.exec('PRAGMA busy_timeout=5000; BEGIN IMMEDIATE');
  try{
    const schema=(db.prepare('PRAGMA table_info(ai_budget_attempts)').all() as any[]).map(r=>[r.name,r.type,r.notnull,r.pk]);
    if(JSON.stringify(schema)!==JSON.stringify(SCHEMA))throw new Error('debit_schema_mismatch');
    const limit=db.prepare("SELECT * FROM ai_budget_limits WHERE pool='free'").get() as any;
    if(limit?.limit_micro!==500000000||limit?.attempt_limit!==100)throw new Error('approved_public_limits_required');
    const columns=SCHEMA.map(r=>r[0] as string),insert=db.prepare('INSERT INTO ai_budget_attempts ('+columns.join(',')+') VALUES ('+columns.map(()=>'?').join(',')+')');
    let inserted=0;
    for(const row of HISTORICAL_DEBITS){
      const saved=db.prepare('SELECT * FROM ai_budget_attempts WHERE id=?').get(row.id) as any;
      if(saved){if(columns.some(c=>saved[c]!==row[c as keyof typeof row]))throw new Error('historical_debit_collision:'+row.id);}
      else{insert.run(...columns.map(c=>row[c as keyof typeof row]));inserted++;}
    }
    const accounting=db.prepare("SELECT COUNT(*) AS attempts,COALESCE(SUM(cost_micro),0) AS spent_micro FROM ai_budget_attempts WHERE pool='free'").get() as any;
    db.exec('COMMIT');
    return {inserted,historical_micro:6421141,total_spent_micro:accounting.spent_micro,remaining_micro:limit.limit_micro-accounting.spent_micro,attempts:accounting.attempts,attempt_limit:limit.attempt_limit,usage_currency:'UNKNOWN',strict_invoice_ceiling_verified:false};
  }catch(e){db.exec('ROLLBACK');throw e;}
}

function main(){
  const args=process.argv.slice(2),filename=args[args.indexOf('--db')+1];
  if(args.length!==3||!args.includes('--confirm-two-historical-debits')||!args.includes('--db')||!filename||!path.isAbsolute(filename)||!fs.lstatSync(filename).isFile())throw new Error('existing_absolute_database_and_explicit_import_required');
  const db=new DatabaseSync(filename);try{console.info(JSON.stringify(importHistoricalDebits(db)));}finally{db.close();}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){try{main();}catch(e){console.error((e as Error).message);process.exitCode=1;}}
