/** Offline only. Exact technical counts; these are not human/semantic acceptance scores. */
import fs from 'node:fs';
import path from 'node:path';
import {parsePersonalMythResult,validatePersonalMythResult} from '../../server/myth';
const root=process.argv[2]||'docs/evidence/quality-2026-09';
const summary:any={generatedAt:new Date().toISOString(),synthetic:true,runs:{}};
for(const run of ['baseline-18','candidate-18','final-18']){
  const dir=path.join(root,run);
  const cases=fs.readdirSync(dir).filter(f=>f.startsWith('synthetic_')).map(f=>JSON.parse(fs.readFileSync(path.join(dir,f),'utf8')));
  const counts:any={cases:cases.length,complete:0,degraded:0,incomplete:0,code:0,myth:0,meeting:0,turns:0,nominalTurns:0,recoveryTurns:0,mythRepairs:0,failures:{},caseChecks:[]};
  for(const c of cases){
    counts[c.status]=(counts[c.status]||0)+1;
    for(const stage of ['code','myth','meeting'])if(c.stages?.[stage]?.status==='ok')counts[stage]++;
    if(c.myth?.repaired)counts.mythRepairs++;
    for(const [stage,s] of Object.entries(c.stages||{}) as any)if(s.status==='error'){
      const key=stage+':'+s.code;counts.failures[key]=(counts.failures[key]||0)+1;
    }
    const turns=c.albert?.turns||[];
    counts.turns+=turns.length;counts.nominalTurns+=turns.filter((t:any)=>t.safety==='nominal').length;
    counts.recoveryTurns+=turns.filter((t:any)=>t.safety!=='nominal').length;
    let currentMythQA:any=null;
    try{
      const result=c.myth?.result || parsePersonalMythResult(c.mythAttempts.at(-1));
      currentMythQA=validatePersonalMythResult(result);
    }catch{}
    const invitation=turns[2]?.reply||'',followup=turns[3]?.reply||'';
    const details=(text:string)=>[/Лид/iu,/Синий трамвай/iu,/библиотек/iu,/суббот/iu].every(re=>re.test(text));
    counts.caseChecks.push({id:c.id,status:c.status,currentMythQA,
      deliveryChecks:turns.length===4?{invitationDetails:details(invitation),followupDetails:details(followup),
        requestedNoQuestion:!/[?？]/u.test(invitation+followup),allTurnsNominal:turns.every((t:any)=>t.safety==='nominal')}:null,
      failures:turns.flatMap((t:any)=>t.provider_failures||[])});
  }
  summary.runs[run]=counts;
}
fs.writeFileSync(path.join(root,'TECHNICAL_RESULTS.json'),JSON.stringify(summary,null,2));
console.log(JSON.stringify(Object.fromEntries(Object.entries(summary.runs).map(([k,v]:any)=>[k,{...v,caseChecks:undefined}])),null,2));
