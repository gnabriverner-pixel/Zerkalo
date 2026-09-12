/** ONE release acceptance, not a bake-off. Existing 18 personas, fresh exact SHAs. */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFile,spawn} from 'node:child_process';
import {promisify} from 'node:util';
import {personas} from './personas';
import {RouterAIClient,PRIMARY_MODEL,FALLBACK_MODEL,type ProviderEvent} from '../../server/routerai';
import {createRouterAIMythProvider,generatePersonalMyth,parsePersonalMythRequest} from '../../server/myth';
import {generateMeetingOfMirrors} from '../../server/meeting';
import {generateFirstMirror} from '../../src/services/interpretation';
import {buildCanonicalEnvelopeFromWebContext} from '../../server/albert';
import {startBudgetProxy} from './routeraiBudgetProxy';

const exec=promisify(execFile);
if(process.env.QUALITY_LIVE!=='1')throw new Error('explicit_quality_live_required');
if(!process.env.ROUTERAI_API_KEY?.trim())throw new Error('routerai_not_ready');
const root=process.env.DCS_ROOT || path.resolve('../digital-code-product-journey');
const python=path.join(root,'.venv312/bin/python');
const out=path.resolve(process.env.QUALITY_OUTPUT || '../routerai-release-acceptance-2026-09');
const sha=async(cwd:string)=>(await exec('git',['rev-parse','HEAD'],{cwd})).stdout.trim();
for(const cwd of [process.cwd(),root]) {
  if((await exec('git',['diff','HEAD','--name-only'],{cwd})).stdout.trim())throw new Error('acceptance_requires_frozen_clean_candidate');
  const untracked=(await exec('git',['ls-files','--others','--exclude-standard'],{cwd})).stdout.split('\n');
  if(untracked.some(p=>/\.(?:py|ts|tsx|js|cjs|mjs)$/.test(p)))throw new Error('acceptance_untracked_source');
}
fs.mkdirSync(out,{recursive:true});
const manifest={synthetic:true,webSha:await sha(process.cwd()),dcsSha:await sha(root),primary:PRIMARY_MODEL,fallback:FALLBACK_MODEL,
  personaIds:personas.map(p=>p.id),limitRub:300,channelProof:'canonical WEB/TELEGRAM core; no public transport'};
const manifestFile=path.join(out,'manifest.json');
if(fs.existsSync(manifestFile)&&JSON.stringify(JSON.parse(fs.readFileSync(manifestFile,'utf8')))!==JSON.stringify(manifest))
  throw new Error('acceptance_manifest_mismatch');
fs.writeFileSync(manifestFile,JSON.stringify(manifest,null,2));
// Evidence output can move; the allowance cannot. All runs from this source tree
// share one ledger, in addition to the host-wide singleton lock.
const ledgerDir=path.resolve(import.meta.dirname,'../../../routerai-release-acceptance-2026-09');
fs.mkdirSync(ledgerDir,{recursive:true});
const proxy=await startBudgetProxy(process.env.ROUTERAI_API_KEY!,path.join(ledgerDir,'spend.json'));
const childEnv={...process.env,ROUTERAI_API_KEY:'synthetic-proxy-placeholder',PYTHONPATH:root,
  ROUTERAI_ACCEPTANCE_PROXY:proxy.url,ROUTERAI_ACCEPTANCE_TOKEN:proxy.nonce,
  CONTINUATION_CLAIM_SECRET:crypto.randomBytes(32).toString('hex')};

async function run(p:typeof personas[number],forced:boolean) {
  const file=path.join(out,`${p.id}${forced?'__fallback':''}.json`);
  // Never silently rerun a successful (or failed) recorded scenario.
  if(fs.existsSync(file))return;
  const record:any={id:p.id,synthetic:true,forcedPrimaryFailure:forced,stages:{},events:[],startedAt:new Date().toISOString()};
  const events:ProviderEvent[]=record.events;
  const transport:typeof fetch=async(url,options)=>{
    const body=JSON.parse(String(options?.body));
    if(forced&&body.model===PRIMARY_MODEL)return new Response('{}',{status:503});
    return proxy.transport(url,options);
  };
  const client=new RouterAIClient({ROUTERAI_API_KEY:'synthetic-proxy-placeholder'},PRIMARY_MODEL,transport,e=>events.push(e));
  let stage='code';let start=Date.now();
  try {
    const raw=await exec(python,[path.join(root,'integration/zerkalo_bridge.py'),'calculate','--dob',p.dob],{cwd:root,env:childEnv,maxBuffer:2_000_000});
    const calc=JSON.parse(raw.stdout);if(calc.error||!calc.soul)throw new Error('canonical_calculation_failed');
    const firstMirror=generateFirstMirror(calc);record.code={calc,firstMirror};record.stages.code={status:'ok',ms:Date.now()-start};
    stage='myth';start=Date.now();
    const myth=await generatePersonalMyth(parsePersonalMythRequest({request_id:`routerai_${p.id}`,answers:p.answers}),createRouterAIMythProvider(client),75_000);
    record.answers=p.answers;record.myth=myth;record.stages.myth={status:'ok',ms:Date.now()-start};
    stage='meeting';start=Date.now();
    const meeting=await generateMeetingOfMirrors({codeData:{calc,firstMirror},storyData:{storyInputs:p.answers,storyResult:myth.result},client});
    record.meeting=meeting;record.stages.meeting={status:'ok',ms:Date.now()-start};
    const m=meeting.result;
    const envelope=buildCanonicalEnvelopeFromWebContext({meetingSummary:m.summary,centralQuestion:m.reflectiveQuestion,
      resonances:m.parallels,divergences:m.divergences,codeAnchors:{numbers:calc,keyInsight:firstMirror.keyInsight},
      mythAnchors:{title:myth.result.title,...myth.result.mirror}});
    const messages=[`Мой вопрос: ${p.answers.q1} Что нового даёт встреча этих двух зеркал для моего вопроса? Не повторяй весь разбор.`,p.correction,p.request,p.followup];
    stage='albert';start=Date.now();
    record.albert=await new Promise<any>((resolve,reject)=>{
      const child=spawn(python,[path.join(root,'scripts/quality_routerai_albert.py')],{cwd:root,env:childEnv,stdio:['pipe','pipe','pipe']});
      let stdout='';const timer=setTimeout(()=>{child.kill();reject(new Error('albert_harness_deadline'));},200_000);
      child.stdout.on('data',b=>stdout+=b);child.stderr.on('data',()=>{});
      child.on('error',()=>{clearTimeout(timer);reject(new Error('albert_harness_start_failed'));});
      child.on('close',code=>{clearTimeout(timer);if(code!==0)return reject(new Error('albert_harness_failed'));try{resolve(JSON.parse(stdout));}catch{reject(new Error('albert_harness_json'));}});
      child.stdin.end(JSON.stringify({synthetic:true,envelope,messages,force_primary_failure:forced}));
    });
    record.stages.albert={status:'ok',ms:Date.now()-start};
    const turns=record.albert.turns;
    const expectedModel=forced?FALLBACK_MODEL:PRIMARY_MODEL;
    const served=[myth.model,meeting.model,...turns.map((t:any)=>t.provider_events.at(-1)?.model)];
    const details=(text:string)=>[/Лид/iu,/Синий трамвай/iu,/библиотек/iu,/суббот/iu].every(rx=>rx.test(text));
    record.checks={completion:turns.length===4&&turns.every((t:any)=>t.safety==='nominal'),
      modelPolicy:served.every(m=>m===expectedModel),
      invitation:details(turns[2]?.reply||''),memory:details(turns[3]?.reply||''),
      noClosingQuestion:turns.length===4&&[turns[2],turns[3]].every(t=>!/[?？]\s*[»”"']*\s*$/.test(t.reply)),
      mythQuality:myth.quality.passed,semanticReview:'REQUIRED_NOT_AUTOMATICALLY_PASSED'};
    record.status=Object.values(record.checks).some(v=>v===false)?'failed':'mechanically_complete_review_required';
  } catch(error) {
    const message=error instanceof Error?error.message:'unknown';
    record.status='incomplete';record.stages[stage]={status:'error',ms:Date.now()-start,code:message.split(':')[0].replace(/[^a-zA-Z0-9_-]/g,'').slice(0,100)};
  }
  fs.writeFileSync(file,JSON.stringify(record,null,2),{mode:0o600});
  console.log(`${p.id}${forced?' fallback':''}: ${record.status}; spend=${proxy.guard.state.chargedRub.toFixed(2)} RUB`);
}
try {
  for(const p of personas) {if(proxy.guard.state.blocked)break;await run(p,false);}
  for(const id of ['synthetic_strong_rejection','synthetic_relationship','synthetic_no_image']) {
    if(proxy.guard.state.blocked)break;await run(personas.find(p=>p.id===id)!,true);
  }
} finally {await proxy.close();}
const main=personas.map(p=>path.join(out,`${p.id}.json`));
const secondary=['synthetic_strong_rejection','synthetic_relationship','synthetic_no_image'].map(id=>path.join(out,`${id}__fallback.json`));
const read=(file:string)=>fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):null;
const complete=(files:string[])=>files.map(read).filter(r=>r?.status==='mechanically_complete_review_required').length;
const summary={journeys:complete(main),requiredJourneys:18,fallbackJourneys:complete(secondary),requiredFallbackJourneys:3,
  chargedRub:proxy.guard.state.chargedRub,reservedRub:proxy.guard.reservedRub,budgetBlocked:proxy.guard.state.blocked,
  semanticReview:'REQUIRED',releaseAcceptance:'NOT_GRANTED'};
fs.writeFileSync(path.join(out,'mechanical_summary.json'),JSON.stringify(summary,null,2));
console.log(JSON.stringify(summary));
// A mechanical pass still requires independent semantic review; never exit as accepted.
process.exitCode=summary.journeys===18&&summary.fallbackJourneys===3&&!summary.budgetBlocked?2:1;
