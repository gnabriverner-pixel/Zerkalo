/** Acceptance-only fail-closed spend ledger. No runtime routing or user data. */
export type Rates = {input:number; output:number};
export type SpendState = {limitRub:300; chargedRub:number; pending:Record<string,number>; blocked:boolean};
export class SpendGuard {
  readonly state:SpendState;
  constructor(state?:SpendState) {
    this.state=state ?? {limitRub:300,chargedRub:0,pending:{},blocked:false};
    if(this.state.limitRub !== 300 || !Number.isFinite(this.state.chargedRub) || this.state.chargedRub < 0
       || Object.values(this.state.pending).some(x=>!Number.isFinite(x)||x<0)) throw new Error('spend_ledger_invalid');
  }
  get reservedRub() {return Object.values(this.state.pending).reduce((a,b)=>a+b,0);}
  get accountedRub() {return this.state.chargedRub+this.reservedRub;}
  reserve(id:string,body:unknown,maxTokens:number,rates:Rates):number {
    if(this.state.blocked) throw new Error('spend_guard_blocked');
    if(this.state.pending[id] !== undefined || !Number.isInteger(maxTokens) || maxTokens <= 0
       || !Number.isFinite(rates.input) || rates.input <= 0 || !Number.isFinite(rates.output) || rates.output <= 0)
      throw new Error('spend_reservation_invalid');
    // UTF-8 bytes bound text tokens; extra 4096 covers chat/schema framing.
    // 2x reserve covers cache-write and tariff variance. Reject rather than guess rates.
    const upper=(Buffer.byteLength(JSON.stringify(body),'utf8')+4096)*rates.input*2 + maxTokens*rates.output*2;
    if(this.accountedRub+upper > this.state.limitRub) throw new Error('spend_guard_limit');
    this.state.pending[id]=upper;
    return upper;
  }
  settle(id:string,cost:number|null) {
    const reserved=this.state.pending[id];
    if(reserved === undefined) throw new Error('spend_reservation_missing');
    if(cost === null || !Number.isFinite(cost) || cost < 0) {
      // Ambiguous/uncosted outcome stays reserved across restart. Do not continue.
      this.state.blocked=true;return;
    }
    delete this.state.pending[id];this.state.chargedRub+=cost;
    if(cost > reserved || this.accountedRub > this.state.limitRub) this.state.blocked=true;
  }
  reconcileBalance(delta:number) {
    if(!Number.isFinite(delta)||delta<0) {this.state.blocked=true;return;}
    // Concurrent account usage only makes the guard more conservative.
    this.state.chargedRub=Math.max(this.state.chargedRub,delta);
    if(this.accountedRub >= this.state.limitRub) this.state.blocked=true;
  }
}
