// Operator metadata only by default. No generator, payment, dotenv or provider calls.
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {DatabaseSync} from 'node:sqlite';
import {FreePreview,previewSupport} from '../server/freePreview';
import type {CommerceStore} from '../server/commerceStore';
const args=process.argv.slice(2),value=(name:string)=>args[args.indexOf(name)+1];
const filename=value('--db');if(!args.includes('--db')||!path.isAbsolute(filename)||!fs.existsSync(filename))throw new Error('existing_absolute_database_required');
const modifying=args.some(a=>['--activate','--end-trial','--pause-generations'].includes(a));
const db=new DatabaseSync(filename,{readOnly:!modifying});
const limits=()=>db.prepare('SELECT * FROM ai_budget_limits').all();
const attempts=()=>db.prepare('SELECT pool,state,COUNT(*) AS attempts,SUM(cost_micro) AS estimated_micro FROM ai_budget_attempts GROUP BY pool,state').all();
const budgetSummary=()=>({limits:limits(),attempts:attempts(),reported_usage:db.prepare('SELECT usage_currency,COUNT(*) AS attempts,SUM(usage_cost) AS reported_cost,SUM(input_tokens) AS input_tokens,SUM(output_tokens) AS output_tokens FROM ai_budget_attempts WHERE usage_cost IS NOT NULL OR input_tokens IS NOT NULL OR output_tokens IS NOT NULL GROUP BY usage_currency').all(),incidents:db.prepare('SELECT order_id,reason,created_at,state FROM ai_budget_incidents').all()});
try{
  const env:NodeJS.ProcessEnv={...process.env,FREE_PREVIEW_ENABLED:'true'};
  const p=new FreePreview(()=>({db,budgetSummary} as unknown as CommerceStore),env);
  if(args.includes('--feedback')){
    if(!args.includes('--private-consented-feedback'))throw new Error('explicit_private_feedback_export_required');
    const secret=process.env.COMMERCE_DATA_KEY;if(!secret||!/^[a-f0-9]{64}$/i.test(secret))throw new Error('configured_data_key_required');
    const rows=db.prepare("SELECT f.order_id,f.created_at,f.consent_version,f.text_encrypted FROM preview_feedback f JOIN accounts a ON a.id=f.account_id WHERE a.deleted=0 AND f.consent_version='free-preview-feedback-v1'").all() as any[];
    const feedback=rows.map(({text_encrypted,...metadata})=>{const [iv,tag,body]=text_encrypted.split('.'),d=crypto.createDecipheriv('aes-256-gcm',Buffer.from(secret,'hex'),Buffer.from(iv,'base64url'));d.setAuthTag(Buffer.from(tag,'base64url'));return {...metadata,text:JSON.parse(Buffer.concat([d.update(Buffer.from(body,'base64url')),d.final()]).toString('utf8')).text};});
    console.info(JSON.stringify({scope:'private_separately_consented_feedback_only',feedback},null,2));
  }else if(args.includes('--activate')){
    const support=value('--support-url'),amount=Number(value('--confirmed-budget-rub'));
    if(!args.includes('--confirm-public-opening')||!previewSupport(support)||![500,1000].includes(amount))throw new Error('explicit_opening_budget_and_contact_required');
    const free=db.prepare("SELECT limit_micro FROM ai_budget_limits WHERE pool='free'").get() as any;
    if(free?.limit_micro!==amount*1e6||process.env.COMMERCE_BUDGET_APPROVED!=='true')throw new Error('persisted_budget_not_matching_approval');
    db.exec('BEGIN IMMEDIATE');try{env.FREE_PREVIEW_SUPPORT_URL=support;const window=p.activate();db.prepare("INSERT OR REPLACE INTO configuration VALUES ('free_preview_support_url',?)").run(support);db.exec('COMMIT');console.info(JSON.stringify({activated:window}));}catch(e){db.exec('ROLLBACK');throw e;}
  }else if(args.includes('--end-trial')){p.stop();console.info(JSON.stringify({trial:p.status(),baseline_and_archive:'preserved'}));}
  else if(args.includes('--pause-generations')){db.prepare("INSERT OR REPLACE INTO configuration VALUES ('free_preview_pause_generations','true')").run();console.info('{"new_generations":"paused","archive":"preserved"}');}
  else console.info(JSON.stringify({...p.aggregate(),support_queue:db.prepare('SELECT order_id,reason,created_at FROM support_requests ORDER BY created_at').all(),notes:['No user answers/DOB/chats/feedback text in this export.','Sessions/accesses are not unique people.','Reported usage currency may be UNKNOWN; estimates are not a guaranteed provider invoice.','Server PDF export does not prove a client disk save.']},null,2));
}finally{db.close();}
