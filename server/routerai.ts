import type { DeepSeekRequestOptions } from './deepseek';

export const ROUTERAI_URL = 'https://routerai.ru/api/v1';
export const PRIMARY_MODEL = 'deepseek/deepseek-v4.1-flash';
export const FALLBACK_MODEL = 'anthropic/claude-sonnet-5';
export const MEETING_FALLBACK_MODEL = 'openai/gpt-5.4-mini';
export interface ProviderEvent {
  gateway: 'routerai'; model: string; upstream: string | null;
  responseModel: string | null;
  outcome: string; latencyMs: number; costRub: number | null;
  inputTokens: number | null; outputTokens: number | null;
}
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
  return /^(provider_(?:http_(?:408|429|5\d\d)|call_timeout|unavailable|empty_output|invalid_json|truncated)|meeting_(?:timeout|malformed_response)|personal_myth_quality_failed:repair_parse_error)(?::|$)/.test(code);
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
    if (![PRIMARY_MODEL, FALLBACK_MODEL, MEETING_FALLBACK_MODEL].includes(defaultModel)) throw new Error('routerai_model_not_allowed');
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
  async call(options: DeepSeekRequestOptions): Promise<string> {
    if (!this.isReady()) throw new Error('routerai_not_ready');
    const started = Date.now();
    const remaining = options.retryContext ? options.retryContext.deadlineMs - started : Infinity;
    const timeout = Math.min(options.timeoutMs ?? 45_000, remaining);
    if (timeout <= 0) throw new Error('provider_call_timeout');
    const secondary = this.defaultModel !== PRIMARY_MODEL;
    const providerPolicy = !secondary
      ? {thinking:{type:'disabled'},provider:{only:['deepseek'],allow_fallbacks:false}}
      : this.defaultModel === MEETING_FALLBACK_MODEL
        ? {reasoning:{effort:'low'},provider:{only:['openai'],allow_fallbacks:false}}
        : {reasoning:{effort:'low'},provider:{order:['claude-on-aws'],allow_fallbacks:false}};
    const event: ProviderEvent = {gateway:'routerai',model:this.defaultModel,upstream:null,responseModel:null,
      outcome:'provider_unavailable',latencyMs:0,costRub:null,inputTokens:null,outputTokens:null};
    try {
      const response = await this.transport(`${ROUTERAI_URL}/chat/completions`, {
        method:'POST', headers:{Authorization:`Bearer ${this.env.ROUTERAI_API_KEY!.trim()}`,'Content-Type':'application/json'},
        signal:AbortSignal.timeout(timeout),
        body:JSON.stringify({model:this.defaultModel,messages:options.messages,
          temperature:options.temperature ?? 0.7,max_tokens:options.max_tokens ?? 4000,
          ...(options.response_format ? {response_format:options.response_format} : {}),
          include_reasoning:false,
          ...providerPolicy,
        }),
      });
      if (!response.ok) throw new Error(`provider_http_${response.status}`);
      let payload: any;
      try { payload = await response.json(); } catch { throw new Error('provider_invalid_json'); }
      const usage = payload?.usage;
      event.costRub = typeof usage?.cost === 'number' ? usage.cost : null;
      event.inputTokens = typeof usage?.prompt_tokens === 'number' ? usage.prompt_tokens : null;
      event.outputTokens = typeof usage?.completion_tokens === 'number' ? usage.completion_tokens : null;
      // Only bounded metadata, never raw responses, prompts, keys or reasoning.
      const upstream = String(payload?.provider ?? payload?.provider_name ?? '').toLowerCase();
      event.upstream = /^[a-z][a-z0-9 -]{0,40}$/.test(upstream) ? upstream : null;
      if (!secondary && event.upstream !== 'deepseek') throw new Error('provider_upstream_mismatch');
      if (this.defaultModel === FALLBACK_MODEL && !['anthropic', 'claude-on-aws', 'aws'].includes(event.upstream ?? '')) throw new Error('provider_upstream_mismatch');
      if (this.defaultModel === MEETING_FALLBACK_MODEL && event.upstream !== 'openai') throw new Error('provider_upstream_mismatch');
      // Official DeepSeek returns upstream alias deepseek-flash in the proven transport.
      const validModels = !secondary ? [PRIMARY_MODEL, 'deepseek-flash'] : [this.defaultModel];
      if (!validModels.includes(payload?.model)) throw new Error('provider_model_mismatch');
      event.responseModel = validModels.includes(payload?.model) ? payload.model : null;
      if(payload?.choices?.[0]?.finish_reason==='length')throw new Error('provider_truncated');
      const content = payload?.choices?.[0]?.message?.content;
      if (typeof content !== 'string' || !content.trim()) throw new Error('provider_empty_output');
      event.outcome = 'success';
      return content;
    } catch (error) {
      const raw = error instanceof Error ? error : new Error('provider_unavailable');
      const code = /^(provider_|routerai_)[a-z0-9_]+$/.test(raw.message) ? raw.message
        : /timeout|abort/i.test(raw.name) ? 'provider_call_timeout' : 'provider_unavailable';
      event.outcome = code;
      throw new Error(code);
    } finally {
      event.latencyMs = Date.now() - started;
      this.observe(event);
    }
  }
}
