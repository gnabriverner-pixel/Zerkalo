import {describe,it,expect,vi} from 'vitest';
import fs from 'node:fs';
import {RouterAIClient,PRIMARY_MODEL,FALLBACK_MODEL,MEETING_FALLBACK_MODEL,fallbackEligible,type ProviderEvent} from './routerai';
import {createRouterAIMythProvider,generatePersonalMyth,parsePersonalMythRequest} from './myth';
import {generateMeetingOfMirrors} from './meeting';
import {strictFormat,MEETING_SCHEMA} from './structuredOutput';

const saved = JSON.parse(fs.readFileSync('docs/evidence/quality-2026-09/final-18/synthetic_career.json','utf8'));
const stripContrasts = (s: any): any => typeof s === 'string' ? s.replace(/(?:^|[\s«"(])не\s+[^.!?\n]{1,100}?,?\s+а\s+([а-яё])/giu, ' $1') : s;
const r = saved.myth.result;
const cleanedMythResult = {
  ...r,
  story: stripContrasts(r.story),
  mirror: {
    ...Object.fromEntries(Object.entries(r.mirror).map(([k, v]) => [k, stripContrasts(v)])),
    hiddenResource: 'После малого жеста в сцене становится возможным выбрать следующий шаг, не объявляя его единственно верным.',
  },
  meaning: r.meaning.map(stripContrasts),
  one_step: stripContrasts(r.one_step),
  journal_question: stripContrasts(r.journal_question),
};
const myth = JSON.stringify({mode:'story',status:'ok',writer_version:'fixture',story_result:cleanedMythResult});
const meetingFixture = structuredClone(saved.meeting);
meetingFixture.result.possibleSupport = 'Опорой может стать уже названное внимание к конкретной ситуации; можно проверить его в одном небольшом действии.';
const meeting = JSON.stringify(meetingFixture);
const jsonReply = (content:string, model=PRIMARY_MODEL, extra={}) => new Response(JSON.stringify({
  model,provider:model === PRIMARY_MODEL ? 'DeepSeek' : model === MEETING_FALLBACK_MODEL ? 'OpenAI' : 'Anthropic',choices:[{finish_reason:'stop',message:{content}}],usage:{cost:0.01,prompt_tokens:10,completion_tokens:10},...extra,
}),{status:200});
const request = () => parsePersonalMythRequest({request_id:'synthetic_routerai_test',answers:saved.answers});
function fixture(replies: Array<() => Response | Promise<Response>>) {
  const bodies:any[]=[];const events:ProviderEvent[]=[];
  const transport=vi.fn(async (_url:any,options:any)=>{bodies.push(JSON.parse(options.body));const next=replies.shift();if(!next)throw new Error('unexpected_call');return next();});
  return {bodies,events,transport,client:new RouterAIClient({ROUTERAI_API_KEY:'fixture-key-not-real'},PRIMARY_MODEL,transport as any,e=>events.push(e))};
}
const runMyth = (client:RouterAIClient)=>generatePersonalMyth(request(),createRouterAIMythProvider(client),1000);
const runMeeting = (client:RouterAIClient)=>generateMeetingOfMirrors({client:client.withFallback(MEETING_FALLBACK_MODEL),codeData:saved.code,storyData:{storyInputs:saved.answers,storyResult:saved.myth.result},totalBudgetMs:1000});

describe('RouterAI frozen release policy',()=>{
  it('one primary call, json_object transport under the local strict contract, safe cost/model evidence',async()=>{
    const f=fixture([()=>jsonReply(myth)]);const result=await runMyth(f.client);
    expect(result.model).toBe(PRIMARY_MODEL);expect(f.bodies).toHaveLength(1);
    expect(f.bodies[0]).toMatchObject({model:PRIMARY_MODEL,include_reasoning:false,thinking:{type:'disabled'},provider:{only:['deepseek'],allow_fallbacks:false},response_format:{type:'json_object'},max_tokens:8000});
    expect(JSON.stringify(f.events)).not.toContain('fixture-key');expect(f.events[0]).toMatchObject({costRub:0.01,model:PRIMARY_MODEL,outcome:'success'});
  });
  it.each([408,429,500,502,503])('falls back once on HTTP %s, official upstream and no hidden reasoning',async status=>{
    const f=fixture([()=>new Response('',{status}),()=>jsonReply(myth,FALLBACK_MODEL,{provider:'Anthropic'})]);
    const result=await runMyth(f.client);expect(result.model).toBe(FALLBACK_MODEL);expect(f.bodies).toHaveLength(2);
    expect(f.bodies[1]).toMatchObject({model:FALLBACK_MODEL,provider:{order:['claude-on-aws'],allow_fallbacks:false},reasoning:{effort:'low'},include_reasoning:false,response_format:{type:'json_schema'}});
    expect(f.bodies[1].thinking).toBeUndefined();
  });
  it.each([400,401,402,403,404])('does not mask permanent HTTP %s',async status=>{
    const f=fixture([()=>new Response('',{status})]);await expect(runMyth(f.client)).rejects.toThrow(`provider_http_${status}`);expect(f.bodies).toHaveLength(1);
  });
  it('uses fallback for timeout and empty output, without double success',async()=>{
    for(const failure of [()=>{throw new DOMException('timeout','TimeoutError');},()=>jsonReply('')]){
      const f=fixture([failure,()=>jsonReply(myth,FALLBACK_MODEL,{provider:'Anthropic'})]);
      await runMyth(f.client);expect(f.bodies).toHaveLength(2);expect(f.events.filter(e=>e.outcome==='success')).toHaveLength(1);
    }
  });
  it('exhausts primary parse repair before structural fallback',async()=>{
    const f=fixture([()=>jsonReply('{'),()=>jsonReply('{'),()=>jsonReply(myth,FALLBACK_MODEL,{provider:'Anthropic'})]);
    const result=await runMyth(f.client);expect(result.model).toBe(FALLBACK_MODEL);
    expect(f.bodies.map(b=>b.model)).toEqual([PRIMARY_MODEL,PRIMARY_MODEL,FALLBACK_MODEL]);
  });
  it('does not fall back because editorial output is disliked or a safety check fails',async()=>{
    const bad=JSON.parse(myth);bad.story_result.mirror.newView='В детстве ты всегда прятался.';
    const f=fixture([()=>jsonReply(JSON.stringify(bad)),()=>jsonReply(JSON.stringify(bad))]);
    await expect(runMyth(f.client)).rejects.toThrow('invented_biography_risk');expect(f.bodies).toHaveLength(2);
    expect(fallbackEligible(new Error('personal_myth_quality_failed:unsupported_certainty'))).toBe(false);
  });
  it('allows exhausted measured structural contract but not mixed semantic failures',()=>{
    expect(fallbackEligible(new Error('personal_myth_quality_failed:story_word_count_out_of_contract_300_to_800|title_length'))).toBe(true);
    expect(fallbackEligible(new Error('personal_myth_quality_failed:story_word_count_out_of_contract_300_to_800|invented_biography_risk'))).toBe(false);
  });
  it('does not cycle back to primary when fallback fails',async()=>{
    const f=fixture([()=>new Response('',{status:503}),()=>new Response('',{status:503})]);
    await expect(runMyth(f.client)).rejects.toThrow('provider_http_503');expect(f.bodies).toHaveLength(2);
  });
  it('rejects unexpected fallback upstream or model',async()=>{
    for(const extra of [{provider:'Novita'},{model:'unapproved/model'}]){
      const f=fixture([()=>new Response('',{status:503}),()=>jsonReply(myth,FALLBACK_MODEL,extra)]);
      await expect(runMyth(f.client)).rejects.toThrow(/provider_(upstream|model)_mismatch/);expect(f.bodies).toHaveLength(2);
    }
  });
  it('meeting uses strict contract and 6000 budget without changing prompt',async()=>{
    const f=fixture([()=>jsonReply(meeting)]);const result=await runMeeting(f.client);
    expect(result.model).toBe(PRIMARY_MODEL);expect(f.bodies[0].max_tokens).toBe(6000);
    expect(f.bodies[0].response_format).toEqual({type:'json_object'});
    expect(strictFormat('meeting',MEETING_SCHEMA).json_schema.name).toBe('meeting');
  });
  it('unwraps only the observed redundant meeting envelope then validates',async()=>{
    const wrapped=JSON.stringify({result:JSON.parse(meeting)});
    const f=fixture([()=>jsonReply(wrapped)]);expect((await runMeeting(f.client)).result.summary).toBe(saved.meeting.result.summary);
    expect(f.bodies).toHaveLength(1);
  });
  it('meeting structural failure reaches fallback before delivery',async()=>{
    const f=fixture([()=>jsonReply('{'),()=>jsonReply(meeting,MEETING_FALLBACK_MODEL,{provider:'OpenAI'})]);
    expect((await runMeeting(f.client)).model).toBe(MEETING_FALLBACK_MODEL);expect(f.bodies).toHaveLength(2);
    expect(f.bodies[1]).toMatchObject({model:MEETING_FALLBACK_MODEL,provider:{only:['openai'],allow_fallbacks:false}});
  });
  it('truncated Web output is never a successful delivery and repair remains bounded',async()=>{
    const truncated=()=>new Response(JSON.stringify({model:PRIMARY_MODEL,provider:'DeepSeek',choices:[{finish_reason:'length',message:{content:myth}}]}));
    const f=fixture([truncated,truncated,()=>jsonReply(myth,FALLBACK_MODEL)]);
    expect((await runMyth(f.client)).model).toBe(FALLBACK_MODEL);
    expect(f.bodies.map(b=>b.model)).toEqual([PRIMARY_MODEL,PRIMARY_MODEL,FALLBACK_MODEL]);
    expect(f.events.slice(0,2).every(e=>e.outcome==='provider_truncated')).toBe(true);
  });
  it('RouterAI bare Meeting result cannot bypass strict envelope',async()=>{
    const f=fixture([()=>jsonReply(JSON.stringify(saved.meeting.result)),()=>jsonReply(meeting,MEETING_FALLBACK_MODEL,{provider:'OpenAI'})]);
    expect((await runMeeting(f.client)).model).toBe(MEETING_FALLBACK_MODEL);expect(f.bodies).toHaveLength(2);
  });
  it('request policy cannot change model via call options',async()=>{
    const f=fixture([()=>jsonReply('answer')]);await f.client.call({model:'other/model',messages:[]});expect(f.bodies[0].model).toBe(PRIMARY_MODEL);
  });
});
