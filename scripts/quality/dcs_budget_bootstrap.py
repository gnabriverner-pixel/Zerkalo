"""Local candidate accounting seam. The paired DCS checkout is never edited.

Every native _bounded_post (including retry/fallback) reserves before transport.
No keys/prompts/provider bodies are written to accounting records.
"""
import base64, contextvars, hashlib, hmac, json, math, os, runpy, sqlite3, subprocess, sys, time, uuid
from pathlib import Path
sys.path.insert(0, os.getcwd())
from telegram_v2.albert import routerai
from integration import dcs_service

WEB_ROOT=Path(__file__).resolve().parents[2]
POLICY=json.loads((WEB_ROOT/'server/aiBudgetPolicy.json').read_text())
SCOPE=contextvars.ContextVar('ai_scope',default=None)
DB=os.environ.get('COMMERCE_DB_PATH','')
if not DB or not os.path.isabs(DB):raise RuntimeError('absolute_commerce_db_required')
if os.environ.get('FIRST_SALES_PROXY_URL'):
    from urllib.parse import urlparse
    proxy=urlparse(os.environ['FIRST_SALES_PROXY_URL'])
    if proxy.scheme!='http' or proxy.hostname!='127.0.0.1':raise RuntimeError('bounded_proxy_required')
    routerai.URL=os.environ['FIRST_SALES_PROXY_URL'].rstrip('/')+'/api/v1'

def current_tariffs():
    with sqlite3.connect(DB,timeout=5) as db:
        try:row=db.execute("SELECT snapshot FROM ai_tariff_versions WHERE version=(SELECT value FROM configuration WHERE key='ai_tariff_current')").fetchone()
        except sqlite3.OperationalError:row=None
    return json.loads(row[0]) if row else None

def estimate(snapshot,body,now):
    captured=int(__import__('datetime').datetime.fromisoformat(snapshot['captured_at'].replace('Z','+00:00')).timestamp()*1000)
    if not captured<=now<=captured+snapshot['valid_for_ms']:raise RuntimeError('ai_tariffs_stale')
    row=next((r for r in snapshot['rows'] if r['model']==body.get('model')),None)
    if not row:raise RuntimeError('ai_price_bound_unknown')
    messages=body.get('messages');maximum=body.get('max_tokens')
    if not isinstance(messages,list) or not 1<=len(messages)<=POLICY['max_messages'] or any(not isinstance(m,dict) or set(m)-{'role','content'} or not isinstance(m.get('content'),str) or m.get('role') not in ('system','user','assistant') for m in messages) or type(maximum)!=int or not 1<=maximum<=POLICY['max_output_tokens'] or any(k in body for k in ['tools','plugins','web_search','input','images']):raise RuntimeError('ai_input_bound_exceeded')
    value={'messages':messages}
    if body.get('response_format'):value['response_format']=body['response_format']
    try:size=len(json.dumps(value,ensure_ascii=False,separators=(',',':')).encode('utf8'))
    except UnicodeEncodeError:raise RuntimeError('ai_input_bound_exceeded')
    if size>POLICY['max_input_bytes']:raise RuntimeError('ai_input_bound_exceeded')
    cost=math.ceil((size*row['input_rate']+maximum*row['output_rate'])*POLICY['margin_numerator']/POLICY['margin_denominator']*1e6)
    maximum_cost=max(math.ceil((POLICY['max_input_bytes']*r['input_rate']+POLICY['max_output_tokens']*r['output_rate'])*POLICY['margin_numerator']/POLICY['margin_denominator']*1e6) for r in snapshot['rows'] if r['model']!='anthropic/claude-opus-5.5' or os.environ.get('PERSONAL_MYTH_WRITER')=='v41')
    return cost,size,maximum_cost

def reserve(body, scope):
    now=int(time.time()*1000)
    if os.environ.get('COMMERCE_BUDGET_APPROVED')!='true':raise RuntimeError('ai_budget_unconfigured')
    snapshot=current_tariffs()
    captured=int(__import__('datetime').datetime.fromisoformat(snapshot['captured_at'].replace('Z','+00:00')).timestamp()*1000) if snapshot else 0
    if not snapshot or now-captured>=43200000 or captured>now:
        try:subprocess.run([os.environ.get('AI_TARIFF_NODE_BIN','node'),str(WEB_ROOT/'scripts/capture_ai_tariffs.mjs'),'--runtime',DB],cwd=WEB_ROOT,check=True,capture_output=True,timeout=20)
        except Exception:
            if not snapshot or now<captured or now-captured>86400000:
                with sqlite3.connect(DB,timeout=5) as db:db.execute("INSERT INTO ai_budget_incidents VALUES (?,'ai_tariffs_stale',?,?,'open') ON CONFLICT(order_id,reason) DO UPDATE SET state='open'",(scope.get('orderId') or 'service',snapshot.get('version') if snapshot else None,now))
                raise RuntimeError('ai_tariffs_stale')
        snapshot=current_tariffs()
    # Capture can accept a snapshot newer than the time sampled before I/O.
    # Validate the version actually read against the current wall clock.
    now=int(time.time()*1000)
    cost,size,maximum_cost=estimate(snapshot,body,now)
    pool=scope.get('pool','free');order_id=scope.get('orderId')
    db=sqlite3.connect(DB,timeout=5,isolation_level=None);db.row_factory=sqlite3.Row
    try:
        db.execute('BEGIN IMMEDIATE')
        if db.execute("SELECT 1 FROM configuration WHERE key='ai_budget_recovery_locked'").fetchone():raise RuntimeError('ai_budget_recovery_waiting')
        if db.execute("SELECT 1 FROM configuration WHERE key='free_preview_pause_generations'").fetchone():raise RuntimeError('free_budget_exhausted')
        if os.environ.get('FREE_PREVIEW_ENABLED')=='true' and db.execute("SELECT COUNT(*) FROM ai_budget_attempts WHERE state='reserved'").fetchone()[0]>=2:raise RuntimeError('ai_concurrency_limit')
        if pool=='paid':
            order=db.execute('SELECT kind,state FROM orders WHERE id=?',(order_id,)).fetchone()
            if not order or order['kind']!='paid' or order['state'] not in ('paid','answers_saved','generating','generation_failed','ready'):raise RuntimeError('paid_order_not_available')
            held=db.execute('SELECT * FROM ai_budget_commitments WHERE order_id=?',(order_id,)).fetchone()
            if not held or held['spent_micro']+cost>held['capacity_micro'] or held['attempts']>=held['attempt_limit']:raise RuntimeError('paid_service_waiting')
            if held['spent_micro']+cost+max(0,held['attempt_limit']-held['attempts']-1)*maximum_cost>held['capacity_micro']:raise RuntimeError('paid_service_waiting')
            db.execute('UPDATE ai_budget_commitments SET spent_micro=spent_micro+?,attempts=attempts+1 WHERE order_id=?',(cost,order_id))
        else:
            pool='free';order_id=None
            limit=db.execute("SELECT * FROM ai_budget_limits WHERE pool='free'").fetchone()
            used=db.execute("SELECT COUNT(*) AS attempts,COALESCE(SUM(cost_micro),0) AS cost FROM ai_budget_attempts WHERE pool='free'").fetchone()
            if not limit or used['attempts']>=limit['attempt_limit'] or used['cost']+cost>limit['limit_micro']:raise RuntimeError('free_budget_exhausted')
        ident=str(uuid.uuid4());db.execute("INSERT INTO ai_budget_attempts(id,pool,order_id,model,cost_micro,state,created_at,finished_at,estimate_version,policy_version) VALUES (?,?,?,?,?,'reserved',?,NULL,?,?)",(ident,pool,order_id,body['model'],cost,now,snapshot['version'],POLICY['version']));db.execute("UPDATE ai_budget_incidents SET state='resolved' WHERE order_id=?",(order_id or 'service',));db.execute('COMMIT');return ident
    except Exception as error:
        db.execute('ROLLBACK')
        if pool=='paid':db.execute("INSERT INTO ai_budget_incidents VALUES (?,?,?,?, 'open') ON CONFLICT(order_id,reason) DO UPDATE SET estimate_version=excluded.estimate_version,state='open'",(order_id,str(error) if str(error).startswith(('paid_','ai_')) else 'ai_budget_unavailable',snapshot['version'],now))
        raise
    finally:db.close()

native_post=routerai._bounded_post
def accounted_post(body,key,timeout,transport):
    scope=SCOPE.get() or {'pool':'free'}
    try:ident=reserve(body,scope)
    except Exception as error:
        scope['budget_error']=str(error) if str(error).startswith(('ai_','paid_','free_')) else 'ai_budget_unavailable'
        raise
    successful=False;usage={};started=time.monotonic()
    try:
        response=native_post(body,key,timeout,transport);successful=response.status_code==200
        try:
            payload=response.json();candidate=payload.get('usage') if isinstance(payload,dict) else None
            usage=candidate if isinstance(candidate,dict) else {}
        except Exception:pass
        return response
    finally:
        number=lambda value:value if type(value) in (int,float) and math.isfinite(value) and value>=0 else None
        with sqlite3.connect(DB,timeout=5) as db:db.execute("UPDATE ai_budget_attempts SET state=?,finished_at=?,input_tokens=?,output_tokens=?,usage_cost=?,usage_currency='UNKNOWN',duration_ms=? WHERE id=? AND state='reserved'",('complete' if successful else 'uncertain',int(time.time()*1000),number(usage.get('prompt_tokens')),number(usage.get('completion_tokens')),number(usage.get('cost')),round((time.monotonic()-started)*1000),ident))
routerai._bounded_post=accounted_post
native_init=routerai.RouterAIProvider.__init__
def budget_provider_init(self,settings,*,transport=None,observe=None):
    def observe_unknown_currency(event):
        clean=dict(event)
        if 'usageCost' not in clean:clean['usageCost']=clean.get('costRub')
        clean['costRub']=None;clean['usageCostCurrency']='UNKNOWN'
        (observe or (lambda item:routerai.LOGGER.info('provider_completion %s',item)))(clean)
    native_init(self,settings,transport=transport,observe=observe_unknown_currency)
routerai.RouterAIProvider.__init__=budget_provider_init

native_turn=dcs_service.DCSRequestHandler._handle_albert_turn
def scoped_turn(self,body):
    scope={'pool':'free'};header=self.headers.get('X-AI-Budget-Scope','')
    if header:
        try:
            data,signature=header.split('.',1)
            expected=hmac.new(os.environ.get('COMMERCE_DATA_KEY','').encode(),data.encode(),hashlib.sha256).hexdigest()
            if not hmac.compare_digest(expected,signature):raise ValueError()
            value=json.loads(base64.urlsafe_b64decode(data+'='*(-len(data)%4)))
            if value.get('pool') not in ('free','paid') or abs(int(time.time()*1000)-value['at'])>120000:raise ValueError()
            scope=value
        except Exception:return self._send_json(403,{'error':'budget_scope_invalid'})
    token=SCOPE.set(scope)
    try:return native_turn(self,body)
    finally:SCOPE.reset(token)
dcs_service.DCSRequestHandler._handle_albert_turn=scoped_turn
native_json=dcs_service.DCSRequestHandler._send_json
def budget_json(self,status,data):
    scope=SCOPE.get()
    if scope and scope.get('budget_error'):return native_json(self,503,{'error':scope['budget_error']})
    return native_json(self,status,data)
dcs_service.DCSRequestHandler._send_json=budget_json
native_end=dcs_service.DCSRequestHandler.end_headers
def budget_headers(self):
    self.send_header('X-AI-Budget-Schema','1')
    self.send_header('X-AI-Budget-Policy',POLICY['version'])
    self.send_header('X-AI-Budget-Fingerprint',hmac.new(os.environ.get('COMMERCE_DATA_KEY','').encode(),('budget-db:'+DB).encode(),hashlib.sha256).hexdigest())
    return native_end(self)
dcs_service.DCSRequestHandler.end_headers=budget_headers

if __name__=='__main__':dcs_service.main()
