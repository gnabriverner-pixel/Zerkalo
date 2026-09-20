import {describe,it,expect,vi} from 'vitest';
import fs from 'node:fs';
import {RouterAIClient,PRIMARY_MODEL,FALLBACK_MODEL,MEETING_FALLBACK_MODEL,transportResponseFormat,fallbackEligible,type ProviderEvent} from './routerai';
import {strictFormat,MYTH_SCHEMA,MEETING_SCHEMA} from './structuredOutput';
import {createRouterAIMythProvider,generatePersonalMyth,parsePersonalMythRequest} from './myth';
import {generateMeetingOfMirrors} from './meeting';

// Same proven fixture preparation as server/routerai.test.ts: the product quality gate is strict,
// so transport-compatibility tests reuse the recorded synthetic acceptance pair.
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
// The observed 2026-09-20 gateway refusal: HTTP 200, payload-level error envelope, no upstream answer.
const envelope = (code=400) => new Response(JSON.stringify({error:{message:'Provider returned error',code,
  metadata:{raw:'{"error":{"message":"This response_format type is unavailable now","type":"invalid_request_error"}}'}}}),{status:200});
const request = () => parsePersonalMythRequest({request_id:'synthetic_transport_compat',answers:saved.answers});
function fixture(replies: Array<() => Response | Promise<Response>>) {
  const bodies:any[]=[];const events:ProviderEvent[]=[];
  const transport=vi.fn(async (_url:any,options:any)=>{bodies.push(JSON.parse(options.body));const next=replies.shift();if(!next)throw new Error('unexpected_call');return next();});
  return {bodies,events,transport,client:new RouterAIClient({ROUTERAI_API_KEY:'fixture-key-not-real'},PRIMARY_MODEL,transport as any,e=>events.push(e))};
}
const runMyth = (client:RouterAIClient)=>generatePersonalMyth(request(),createRouterAIMythProvider(client),1000);
const runMeeting = (client:RouterAIClient)=>generateMeetingOfMirrors({client:client.withFallback(MEETING_FALLBACK_MODEL),codeData:saved.code,storyData:{storyInputs:saved.answers,storyResult:saved.myth.result},totalBudgetMs:1000});

describe('DeepSeek chat-completions transport compatibility',()=>{
  it('downgrades the frozen primary transport only, keeping the strict schema as a local contract',()=>{
    expect(transportResponseFormat(strictFormat('personal_myth',MYTH_SCHEMA),PRIMARY_MODEL)).toEqual({type:'json_object'});
    expect(transportResponseFormat(strictFormat('meeting',MEETING_SCHEMA),PRIMARY_MODEL)).toEqual({type:'json_object'});
    expect(transportResponseFormat({type:'json_object'},PRIMARY_MODEL)).toEqual({type:'json_object'});
    expect(transportResponseFormat(undefined,PRIMARY_MODEL)).toBeUndefined();
    expect(strictFormat('personal_myth',MYTH_SCHEMA).json_schema).toMatchObject({name:'personal_myth',strict:true});
  });
  it('keeps the requested strict schema for approved secondary fallbacks',()=>{
    for(const model of [FALLBACK_MODEL,MEETING_FALLBACK_MODEL]){
      expect(transportResponseFormat(strictFormat('personal_myth',MYTH_SCHEMA),model))
        .toMatchObject({type:'json_schema',json_schema:{name:'personal_myth',strict:true}});
    }
  });
  it('Myth primary sends json_object and the local contract still delivers a validated payload',async()=>{
    const f=fixture([()=>jsonReply(myth)]);const result=await runMyth(f.client);
    expect(f.bodies).toHaveLength(1);
    expect(f.bodies[0].response_format).toEqual({type:'json_object'});
    expect(f.bodies[0].provider).toEqual({only:['deepseek'],allow_fallbacks:false});
    expect(result.model).toBe(PRIMARY_MODEL);
    expect(f.events[0]).toMatchObject({outcome:'success',upstream:'deepseek',responseModel:PRIMARY_MODEL});
  });
  it('Meeting primary sends json_object and the local contract still delivers a validated payload',async()=>{
    const f=fixture([()=>jsonReply(meeting)]);const result=await runMeeting(f.client);
    expect(f.bodies[0].response_format).toEqual({type:'json_object'});
    expect(f.bodies[0].max_tokens).toBe(6000);
    expect(result.model).toBe(PRIMARY_MODEL);expect(result.result.summary).toBe(saved.meeting.result.summary);
  });
  it('still rejects a well-formed json_object answer with missing product fields',async()=>{
    const incomplete=()=>jsonReply(JSON.stringify({mode:'story',status:'ok',writer_version:'fixture'}));
    const f=fixture([incomplete,incomplete,incomplete]);
    const err:any=await runMyth(f.client).catch(e=>e);
    // The local product contract, not the transport, decides what counts as a delivered payload.
    expect(String(err?.message)).toMatch(/^personal_myth_quality_failed:(title_length|story_word_count_out_of_contract_300_to_800)/);
    expect(err?.result).toBeUndefined();
    expect(f.bodies.length).toBeLessThanOrEqual(3);
  });
  it('reports an HTTP-200 payload error envelope as a gateway error, never as routing drift',async()=>{
    const f=fixture([()=>envelope(400),()=>envelope(400)]);
    const err:any=await runMyth(f.client).catch(e=>e);
    expect(String(err?.message)).toBe('provider_gateway_error');
    expect(String(err?.message)).not.toMatch(/upstream_mismatch|model_mismatch/);
    // bounded single fallback only, which keeps its strict format
    expect(f.bodies.map(b=>b.model)).toEqual([PRIMARY_MODEL,FALLBACK_MODEL]);
    expect(f.bodies[0].response_format).toEqual({type:'json_object'});
    expect(f.bodies[1].response_format).toMatchObject({type:'json_schema'});
    expect(f.events.map(e=>e.outcome)).toEqual(['provider_gateway_error','provider_gateway_error']);
    expect(f.events[0]).toMatchObject({gatewayCode:400,upstream:null,responseModel:null});
    expect(fallbackEligible(new Error('provider_gateway_error'))).toBe(true);
  });
  it('still rejects actual routing drift on the primary transport',async()=>{
    for(const extra of [{provider:'Novita'},{model:'unapproved/model'}]){
      const f=fixture([()=>jsonReply(myth,PRIMARY_MODEL,extra)]);
      const err:any=await runMyth(f.client).catch(e=>e);
      expect(String(err?.message)).toMatch(/provider_(upstream|model)_mismatch/);
      expect(f.bodies).toHaveLength(1);
      expect(f.events[0].outcome).toMatch(/provider_(upstream|model)_mismatch/);
      expect(fallbackEligible(err)).toBe(false);
    }
  });
});
