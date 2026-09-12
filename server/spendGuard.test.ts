import {describe,it,expect} from 'vitest';
import {SpendGuard} from '../scripts/quality/spendGuard';
describe('300 RUB hard acceptance guard',()=>{
  const rates={input:0.0003,output:0.0015};
  it('reserves before a request and counts simultaneous in-flight calls',()=>{
    const g=new SpendGuard();const x=g.reserve('a',{text:'тест'},6000,rates);
    expect(g.accountedRub).toBe(x);g.reserve('b',{},6000,rates);expect(g.reservedRub).toBeGreaterThan(x);
    g.settle('a',5);expect(g.state.chargedRub).toBe(5);
  });
  it('refuses before crossing the hard cap',()=>{
    const g=new SpendGuard({limitRub:300,chargedRub:299,pending:{},blocked:false});
    expect(()=>g.reserve('a',{},6000,rates)).toThrow('spend_guard_limit');expect(g.reservedRub).toBe(0);
  });
  it('crash/timeout cannot reset an uncertain reservation',()=>{
    const g=new SpendGuard();g.reserve('a',{},6000,rates);g.settle('a',null);
    const resumed=new SpendGuard(JSON.parse(JSON.stringify(g.state)));
    expect(resumed.reservedRub).toBeGreaterThan(0);expect(()=>resumed.reserve('b',{},6000,rates)).toThrow('spend_guard_blocked');
  });
  it('reconciles account drift conservatively',()=>{
    const g=new SpendGuard();g.reconcileBalance(300);expect(g.state.blocked).toBe(true);
  });
  it('unknown tariffs fail closed',()=>{
    const g=new SpendGuard();expect(()=>g.reserve('a',{},6000,{input:NaN,output:1})).toThrow('spend_reservation_invalid');
  });
});
