/** Explicitly opt-in synthetic offline benchmark. Never calls Telegram/sendMessage. */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { personas } from './personas';
import { DeepSeekClient } from '../../server/deepseek';
import { DeepSeekMythProvider, generatePersonalMyth, parsePersonalMythRequest } from '../../server/myth';
import { generateMeetingOfMirrors } from '../../server/meeting';
import { generateFirstMirror } from '../../src/services/interpretation';
import { buildCanonicalEnvelopeFromWebContext } from '../../server/albert';

const exec = promisify(execFile);
if (process.env.QUALITY_LIVE !== '1') throw new Error('Set QUALITY_LIVE=1 to authorize synthetic provider calls');
const root = process.env.DCS_ROOT || '/Users/artemkrysin/Documents/New project/digital-code-product-journey';
const python = process.env.PYTHON_BIN || path.join(root, '.venv312/bin/python');
const out = process.env.QUALITY_OUTPUT || 'docs/evidence/quality-2026-09/baseline';
const limit = Math.min(18, Number(process.env.QUALITY_LIMIT || 18));
const selected = personas.filter(p=>!process.env.QUALITY_CASES || process.env.QUALITY_CASES.split(',').includes(p.id)).slice(0,limit);
fs.mkdirSync(out, {recursive:true});
const client = new DeepSeekClient(process.env);
if (!client.isReady()) throw new Error('provider_not_configured');
const provider = new DeepSeekMythProvider(process.env, client);
// Isolated ephemeral test key: never reused for production, never printed or saved.
const childEnv = {...process.env, PYTHONPATH:root, CONTINUATION_CLAIM_SECRET:crypto.randomBytes(32).toString('hex')};
const sha = async(cwd:string) => (await exec('git',['rev-parse','HEAD'],{cwd})).stdout.trim();
const sourceDigest = async(cwd:string) => {
  const tracked=(await exec('git',['ls-files','-z'],{cwd})).stdout.split('\0').filter(Boolean);
  const digest=crypto.createHash('sha256');
  for(const name of tracked.sort()) {
    if(!/\.(ts|tsx|py|json|html)$/.test(name) || /(^|\/)(data|docs|node_modules)\//.test(name)) continue;
    const file=path.join(cwd,name);
    if(fs.existsSync(file)) digest.update(name+'\0').update(fs.readFileSync(file));
  }
  return digest.digest('hex');
};
const manifest = {synthetic:true, startedAt:new Date().toISOString(), webSha:await sha(process.cwd()),dcsSha:await sha(root),
  webTrackedSourceDigest:await sourceDigest(process.cwd()),dcsTrackedSourceDigest:await sourceDigest(root),
  model:client.defaultModel, requested:selected.length, channelValidation:'actual core with WEB/TELEGRAM contracts; NOT real Telegram transport'};
fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2));
let terminalProviderBlock:string|undefined;
async function runCase(p:typeof personas[number]) {
  const dest = path.join(out,`${p.id}.json`);
  if (fs.existsSync(dest)) {console.log(`${p.id} existing; not regenerating`);return;}
  if(terminalProviderBlock) {
    fs.writeFileSync(dest,JSON.stringify({synthetic:true,id:p.id,status:'not_attempted',blocker:terminalProviderBlock},null,2));
    console.log(`${p.id} not_attempted provider blocked`);return;
  }
  const record:any = {synthetic:true,id:p.id,answers:p.answers,stages:{}, startedAt:new Date().toISOString()};
  let stage='code'; let start=Date.now();
  try {
    const calculation = await exec(python,[path.join(root,'integration/zerkalo_bridge.py'),'calculate','--dob',p.dob],{cwd:root,env:childEnv,maxBuffer:2_000_000});
    const calc=JSON.parse(calculation.stdout); if(calc.error || !calc.soul) throw new Error('canonical_calculation_failed');
    const firstMirror=generateFirstMirror(calc);record.code={calc,firstMirror};record.stages.code={status:'ok',ms:Date.now()-start};
    stage='myth';start=Date.now();
    record.mythAttempts=[];
    const observedProvider={name:provider.name,model:provider.model,isReady:()=>provider.isReady(),generate:async(prompt:string,ms:number)=>{
      const raw=await provider.generate(prompt,ms);record.mythAttempts.push(raw);return raw;
    }};
    const myth=await generatePersonalMyth(parsePersonalMythRequest({request_id:`quality_${p.id}`,answers:p.answers}),observedProvider,45_000);
    record.myth=myth;record.stages.myth={status:'ok',ms:Date.now()-start};
    stage='meeting';start=Date.now();
    const meeting=await generateMeetingOfMirrors({codeData:{calc,firstMirror},storyData:{storyInputs:p.answers,storyResult:myth.result},client});
    record.meeting=meeting;record.stages.meeting={status:'ok',ms:Date.now()-start};
    stage='albert';start=Date.now();
    const m:any=meeting.result || meeting;
    const envelope=buildCanonicalEnvelopeFromWebContext({meetingSummary:m.summary,centralQuestion:m.reflectiveQuestion || m.centralQuestion,
      resonances:m.parallels || m.resonances,divergences:m.divergences,
      codeAnchors:{numbers:calc,keyInsight:firstMirror.keyInsight},mythAnchors:{title:myth.result.title,...myth.result.mirror}});
    const messages=[`Мой вопрос: ${p.answers.q1} Что нового даёт встреча этих двух зеркал для моего вопроса? Не повторяй весь разбор.`,p.correction,p.request,p.followup];
    const {spawn}=await import('node:child_process');
    const dialogue:any=await new Promise((resolve,reject)=>{
      const proc=spawn(python,[path.join(root,'scripts/quality_albert_journey.py')],{cwd:root,env:childEnv,stdio:['pipe','pipe','pipe']});
      let stdout='',stderr='';const timer=setTimeout(()=>{proc.kill();reject(new Error('albert_journey_deadline'));},240_000);
      proc.stdout.on('data',b=>stdout+=b);proc.stderr.on('data',b=>stderr+=b);
      proc.on('error',reject);proc.on('close',code=>{clearTimeout(timer);if(code!==0)reject(new Error(`albert_harness_exit_${code}`));else{try{resolve(JSON.parse(stdout));}catch{reject(new Error('albert_harness_json'));}}});
      proc.stdin.end(JSON.stringify({synthetic:true,envelope,messages}));
    });
    record.albert=dialogue;record.stages.albert={status:'ok',ms:Date.now()-start};
    record.status=dialogue.turns.every((t:any)=>t.safety==='nominal')?'complete':'degraded';
  } catch(error:any) {
    // Only bounded error identifiers, never raw provider bodies/credentials.
    record.status='incomplete';record.stages[stage]={status:'error',ms:Date.now()-start,code:String(error?.message||'unknown').split(':')[0].replace(/[^a-zA-Z0-9_-]/g,'').slice(0,100)};
    if(['provider_http_401','provider_http_402','provider_http_403','deepseek_not_ready'].includes(record.stages[stage].code)) terminalProviderBlock=record.stages[stage].code;
  }
  fs.writeFileSync(dest,JSON.stringify(record,null,2));console.log(`${p.id} ${record.status} ${JSON.stringify(record.stages)}`);
}
for(let i=0;i<selected.length;i+=2) await Promise.all(selected.slice(i,i+2).map(runCase));
