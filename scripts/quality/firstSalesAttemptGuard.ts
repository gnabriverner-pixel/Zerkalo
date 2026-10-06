import fs from 'node:fs';
import path from 'node:path';

type Attempt={number:number;started_at:string;duration_ms:number|null;status:number|null;state:'reserved'|'complete'|'uncertain';model:string|null;usage:unknown|null};
/** Experimental shared I/O guard. Budget belongs to the experiment, not a process or SHA. */
export class FirstSalesAttemptGuard {
  private lock:number;private closed=false;
  private state:{experiment:'first-sales-2026-10-06';limit:8;attempts:Attempt[]};
  constructor(private file:string,private stopAt=8){
    if(!Number.isInteger(stopAt)||stopAt<1||stopAt>8)throw new Error('attempt_stop_invalid');
    fs.mkdirSync(path.dirname(file),{recursive:true});
    this.lock=fs.openSync(file+'.lock','wx',0o600);
    try{
      this.state=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{experiment:'first-sales-2026-10-06',limit:8,attempts:[]};
      if(this.state.experiment!=='first-sales-2026-10-06'||this.state.limit!==8||!Array.isArray(this.state.attempts)||this.state.attempts.length>8)throw new Error('attempt_ledger_invalid');
      if(this.state.attempts.some(a=>a.state!=='complete'))throw new Error('attempt_ledger_uncertain_STOP');
      this.save();
    }catch(e){this.close();throw e;}
  }
  private save(){
    const temp=this.file+'.next';const fd=fs.openSync(temp,'w',0o600);
    try{fs.writeFileSync(fd,JSON.stringify(this.state,null,2)+'\n');fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
    fs.renameSync(temp,this.file);
  }
  async call(body:string,send:()=>Promise<Response>):Promise<Response>{
    if(this.closed||this.state.attempts.some(a=>a.state==='uncertain'))throw new Error('attempt_guard_STOP');
    if(this.state.attempts.length>=this.stopAt)throw new Error('attempt_budget_exhausted');
    const request=JSON.parse(body);
    const a:Attempt={number:this.state.attempts.length+1,started_at:new Date().toISOString(),duration_ms:null,status:null,state:'reserved',model:typeof request.model==='string'?request.model:null,usage:null};
    this.state.attempts.push(a);this.save(); // durable reservation BEFORE network I/O, including retries/fallback
    const start=performance.now();
    try{
      const response=await send();const text=await response.text();
      a.duration_ms=Math.round(performance.now()-start);a.status=response.status;
      try{const parsed=JSON.parse(text);a.usage=parsed.usage??null;}catch{/* unknown remains null */}
      a.state='complete';this.save();
      return new Response(text,{status:response.status,headers:response.headers});
    }catch{a.duration_ms=Math.round(performance.now()-start);a.state='uncertain';this.save();throw new Error('provider_attempt_uncertain_STOP');}
  }
  snapshot(){return structuredClone(this.state);}
  close(){if(this.closed)return;this.closed=true;fs.closeSync(this.lock);fs.unlinkSync(this.file+'.lock');}
}
