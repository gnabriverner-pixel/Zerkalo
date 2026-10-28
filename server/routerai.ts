import type { DeepSeekRequestOptions } from './deepseek';
import {reserveProviderAttempt} from './aiBudget';

export const ROUTERAI_URL = 'https://routerai.ru/api/v1';
export const PRIMARY_MODEL = 'deepseek/deepseek-v4.1-flash';
export const FALLBACK_MODEL = 'anthropic/claude-sonnet-5';
export const MEETING_FALLBACK_MODEL = 'openai/gpt-5.4-mini';
/** Myth writers only (v2a default, v4.1 rollback via PERSONAL_MYTH_WRITER=v41); never a fallback of another path. */
export const WRITER_V41_MODEL = 'anthropic/claude-opus-5.5';
/** Statuses meaning "refused, nothing generated" (402 no balance, 404 no such model/endpoint): the reserve is released
 * instead of staying uncertain. Other 4xx (400/401/422/429) deliberately stay uncertain, see mythWriterV41.test.ts. */
export const DEFINITE_REJECT_STATUSES = new Set([402, 404]);
export interface ProviderEvent {
  gateway: 'routerai'; model: string; upstream: string | null;
  responseModel: string | null;
  outcome: string; latencyMs: number; costRub: number | null;
  usageCost: number | null; usageCostCurrency:'UNKNOWN';
  inputTokens: number | null; outputTokens: number | null;
  /** Bounded gateway error code when the transport refused without an upstream answer. */
  gatewayCode: number | null;
  /** Failure diagnostics, never user content: error name, undici/node cause code, stage reached, provider response id. */
  errorName?: string | null;
  causeCode?: string | null;
  stage?: 'before_headers' | 'reading_body' | 'complete';
  responseId?: string | null;
}
const safeToken = (value: unknown): string | null => typeof value === 'string' && /^[A-Za-z0-9_.:-]{1,80}$/.test(value) ? value : null;
export interface ChatClient {
  readonly name?: string;
  readonly defaultModel?: string;
  isReady(): boolean;
  call(options: DeepSeekRequestOptions): Promise<string>;
  fallback?(): ChatClient | undefined;
}

// No prose taste/quality failures: only transport or exhausted structural contract.
export function fallbackEligible(error: unknown): boolean {
  const code = error instanceof Error ? error.message : '';
  if(code.startsWith('personal_myth_quality_failed:')) {
    const structural=new Set(['repair_parse_error','title_length','story_word_count_out_of_contract_300_to_800',
      'paragraph_count_out_of_contract_3_to_6','one_step_contract','journal_question_contract','mirror_contract']);
    return code.slice('personal_myth_quality_failed:'.length).split('|').every(reason=>structural.has(reason));
  }
  return /^(provider_(?:http_(?:408|429|5\d\d)|call_timeout|unavailable|empty_output|invalid_json|truncated|gateway_error)|meeting_(?:timeout|malformed_response)|personal_myth_quality_failed:repair_parse_error)(?::|$)/.test(code);
}

/** Thrown (by our own checks or an injected transport) when it is PROVEN that nothing was handed to the network.
 * Such an attempt is released from the budget; it is never 'uncertain'. */
export class LocalSendRefusal extends Error {
  constructor(message = 'provider_local_refusal') { super(message); this.name = 'LocalSendRefusal'; }
}

type RequestedResponseFormat = NonNullable<DeepSeekRequestOptions['response_format']>;

// RouterAI reports the routed provider as a human-readable label. Only the confirmed aliases of
// the approved routes are normalized; every other value stays fail-closed (no wildcards, no
// prefixes): RouterAI distinguishes "Claude Platform on AWS" from Amazon Bedrock, so a generic
// AWS-like label must never satisfy the Anthropic fallback route.
const CONFIRMED_UPSTREAM_ALIASES: Record<string, string> = {
  'claude platform on aws': 'claude-on-aws',
  'claude-on-aws': 'claude-on-aws',
};
export function normalizeUpstreamLabel(label: string): string {
  return CONFIRMED_UPSTREAM_ALIASES[label] ?? label;
}

/** Transport compatibility, not a product contract change. The frozen DeepSeek model is reached
 * through /chat/completions, whose current official contract accepts response_format text|json_object
 * only (json_schema belongs to a different transport, the Responses API). The structured product
 * contract remains enforced locally by the existing parser, normalization and quality/safety gates
 * (parsePersonalMythResult() is deliberately tolerant — root/nested shapes, aliases, a safe default
 * for a missing field — it is NOT a literal MYTH_SCHEMA validator), while the primary transport
 * requests json_object; strictFormat() stays the canonical transport schema for providers that
 * support it. Approved secondary fallbacks keep the caller's requested strict format until evidence
 * shows incompatibility. */
export function transportResponseFormat(
  format: RequestedResponseFormat | undefined,
  model: string = PRIMARY_MODEL,
): RequestedResponseFormat | undefined {
  if (!format) return undefined;
  if (model !== PRIMARY_MODEL) return format;
  return format.type === 'json_schema' ? { type: 'json_object' } : format;
}

/** One gateway, two frozen models. Fallback is owned by the validated operation,
 * not by fetch retries; a successful answer is never regenerated for selection. */
export class RouterAIClient implements ChatClient {
  readonly name = 'routerai';
  constructor(
    private readonly env: NodeJS.ProcessEnv = process.env,
    readonly defaultModel: string = PRIMARY_MODEL,
    private readonly transport: typeof fetch = fetch,
    private readonly observe: (event: ProviderEvent) => void = event => console.info('provider_completion', JSON.stringify(event)),
    private readonly fallbackModel: string = FALLBACK_MODEL,
  ) {
    if (![PRIMARY_MODEL, FALLBACK_MODEL, MEETING_FALLBACK_MODEL, WRITER_V41_MODEL].includes(defaultModel)) throw new Error('routerai_model_not_allowed');
    if (![FALLBACK_MODEL, MEETING_FALLBACK_MODEL].includes(fallbackModel)) throw new Error('routerai_fallback_model_not_allowed');
  }
  isReady(): boolean { return Boolean(this.env.ROUTERAI_API_KEY?.trim()); }
  withFallback(model: string): RouterAIClient {
    return new RouterAIClient(this.env, this.defaultModel, this.transport, this.observe, model);
  }
  fallback(): RouterAIClient | undefined {
    return this.defaultModel === PRIMARY_MODEL
      ? new RouterAIClient(this.env, this.fallbackModel, this.transport, this.observe, this.fallbackModel) : undefined;
  }
  /** Writer v2a: the Opus writer client falls back to the primary DeepSeek model with the same prompt (same env/transport/observer). */
  writerFallbackClient(): RouterAIClient | undefined {
    return this.defaultModel === WRITER_V41_MODEL
      ? new RouterAIClient(this.env, PRIMARY_MODEL, this.transport, this.observe, this.fallbackModel) : undefined;
  }
  async call(options: DeepSeekRequestOptions): Promise<string> {
    if (!this.isReady()) throw new Error('routerai_not_ready');
    const started = Date.now();
    const remaining = options.retryContext ? options.retryContext.deadlineMs - started : Infinity;
    const timeout = Math.min(options.timeoutMs ?? 45_000, remaining);
    if (timeout <= 0) throw new Error('provider_call_timeout');
    const secondary = this.defaultModel !== PRIMARY_MODEL;
    // Writer v4.1 defaults reproduce the accepted control call: no reasoning effort, low verbosity, Anthropic only.
    const writer = this.defaultModel === WRITER_V41_MODEL;
    const providerPolicy = !secondary
      ? {thinking:{type:'disabled'},provider:{only:['deepseek'],allow_fallbacks:false}}
      : writer
      ? {verbosity:'low',provider:{only:['anthropic'],allow_fallbacks:false}}
      : this.defaultModel === MEETING_FALLBACK_MODEL
        ? {reasoning:{effort:'low'},provider:{only:['openai'],allow_fallbacks:false}}
        : {reasoning:{effort:'low'},provider:{order:['claude-on-aws'],allow_fallbacks:false}};
    const event: ProviderEvent = {gateway:'routerai',model:this.defaultModel,upstream:null,responseModel:null,
      outcome:'provider_unavailable',latencyMs:0,costRub:null,usageCost:null,usageCostCurrency:'UNKNOWN',inputTokens:null,outputTokens:null,gatewayCode:null};
    const responseFormat = transportResponseFormat(options.response_format, this.defaultModel);
    // The final body is built and checked BEFORE the budget reservation: a refusal here costs nothing and sends nothing.
    const requestBody:Record<string,unknown>={model:this.defaultModel,messages:options.messages,
      ...(writer && options.temperature === undefined ? {} : {temperature:options.temperature ?? 0.7}),
      max_tokens:options.max_tokens ?? 4000,
      ...(writer ? {stream:false} : {}),
      ...(responseFormat ? {response_format:responseFormat} : {}),
      include_reasoning:false,
      ...providerPolicy,
      ...(options.routing?.verbosity ? {verbosity:options.routing.verbosity} : {}),
      ...(options.routing?.provider_only?.length ? {provider:{only:options.routing.provider_only,allow_fallbacks:false}} : {}),
    };
    if (writer) {
      const p:any = requestBody.provider;
      const ok = p?.only?.length===1 && p.only[0]==='anthropic' && p.allow_fallbacks===false && requestBody.stream===false
        && requestBody.include_reasoning===false && requestBody.verbosity==='low' && !('temperature' in requestBody)
        && !('response_format' in requestBody) && !('reasoning' in requestBody) && !('thinking' in requestBody)
        && typeof requestBody.max_tokens==='number' && requestBody.max_tokens>=5000;
      if (!ok) throw new Error('provider_local_refusal');
    }
    const budget=await reserveProviderAttempt(this.defaultModel,{...options,response_format:responseFormat});
    let transportComplete=false, handedToTransport=false, localRefusal=false, rejectedStatus:number|null=null;
    event.stage='before_headers';
    try {
      const serialized = JSON.stringify(requestBody);
      const init = {method:'POST', headers:{Authorization:`Bearer ${this.env.ROUTERAI_API_KEY!.trim()}`,'Content-Type':'application/json'},
        signal:AbortSignal.timeout(timeout), body:serialized};
      // From here on the request may have left the process: nothing below proves otherwise except LocalSendRefusal.
      handedToTransport=true;
      const response = await this.transport(`${ROUTERAI_URL}/chat/completions`, init);
      event.stage='reading_body';event.responseId=safeToken(response.headers?.get?.('x-generation-id'));
      if (!response.ok) { if (DEFINITE_REJECT_STATUSES.has(response.status)) rejectedStatus = response.status; throw new Error(`provider_http_${response.status}`); }
      let payload: any;
      try { payload = await response.json(); } catch { throw new Error('provider_invalid_json'); }
      event.stage='complete';event.responseId=event.responseId??safeToken(payload?.id);
      const usage = payload?.usage;
      event.usageCost = typeof usage?.cost === 'number' ? usage.cost : null;
      event.inputTokens = typeof usage?.prompt_tokens === 'number' ? usage.prompt_tokens : null;
      event.outputTokens = typeof usage?.completion_tokens === 'number' ? usage.completion_tokens : null;
      // RouterAI can answer HTTP 200 with a payload-level error envelope instead of an upstream
      // completion. That is an explicit gateway/provider error, never routing drift.
      if (payload?.error) {
        const gatewayCode = Number((payload.error as any)?.code);
        event.gatewayCode = Number.isFinite(gatewayCode) ? gatewayCode : null;
        throw new Error('provider_gateway_error');
      }
      // A complete provider answer exists (it may have been billed): from here the attempt is a finished one, whatever
      // its content turns out to be; its reservation is replaced by the recorded usage.
      transportComplete=true;
      // Only bounded metadata, never raw responses, prompts, keys or reasoning.
      const upstream = String(payload?.provider ?? payload?.provider_name ?? '').toLowerCase();
      event.upstream = /^[a-z][a-z0-9 -]{0,40}$/.test(upstream) ? upstream : null;
      const routedUpstream = normalizeUpstreamLabel(event.upstream ?? '');
      if (!secondary && routedUpstream !== 'deepseek') throw new Error('provider_upstream_mismatch');
      if (this.defaultModel === FALLBACK_MODEL && !['anthropic', 'claude-on-aws'].includes(routedUpstream)) throw new Error('provider_upstream_mismatch');
      if (writer && routedUpstream !== 'anthropic') throw new Error('provider_upstream_mismatch');
      if (this.defaultModel === MEETING_FALLBACK_MODEL && routedUpstream !== 'openai') throw new Error('provider_upstream_mismatch');
      // Official DeepSeek returns upstream alias deepseek-flash in the proven transport.
      const validModels = !secondary ? [PRIMARY_MODEL, 'deepseek-flash'] : [this.defaultModel];
      if (!validModels.includes(payload?.model)) throw new Error('provider_model_mismatch');
      event.responseModel = validModels.includes(payload?.model) ? payload.model : null;
      if(payload?.choices?.[0]?.finish_reason==='length')throw new Error('provider_truncated');
      // Opt-in strict path (Myth writer v4.1): only a clean stop is a finished story. The call was billed.
      if(options.routing?.strict_finish && payload?.choices?.[0]?.finish_reason!=='stop'){transportComplete=true;throw new Error('provider_not_finished');}
      const content = payload?.choices?.[0]?.message?.content;
      if (typeof content !== 'string' || !content.trim()) throw new Error('provider_empty_output');
      event.outcome = 'success';
      transportComplete=true;
      return content;
    } catch (error) {
      const raw = error instanceof Error ? error : new Error('provider_unavailable');
      localRefusal = raw instanceof LocalSendRefusal || !handedToTransport;
      const code = localRefusal ? 'provider_local_refusal' : /^(provider_|routerai_)[a-z0-9_]+$/.test(raw.message) ? raw.message
        : /timeout|abort/i.test(raw.name) ? 'provider_call_timeout' : 'provider_unavailable';
      event.outcome = code;
      event.errorName = safeToken(raw.name);event.causeCode = safeToken((raw as any).cause?.code);
      throw new Error(code);
    } finally {
      event.latencyMs = Date.now() - started;
      this.observe(event);
      if(budget){
        if(localRefusal&&!transportComplete)budget.db.releaseUnsentAI(budget.id);
        else if(rejectedStatus!==null&&!transportComplete)budget.db.releaseRejectedAI(budget.id,rejectedStatus);
        else budget.db.finishAI(budget.id,transportComplete,event);
      }
    }
  }
}
