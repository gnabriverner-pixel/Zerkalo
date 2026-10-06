"""Local candidate accounting seam. The paired DCS checkout is never edited.

Every native _bounded_post (including retry/fallback) reserves before transport.
No keys/prompts/provider bodies are written to accounting records.
"""
import base64, contextvars, hashlib, hmac, json, os, runpy, sqlite3, sys, time, uuid
from pathlib import Path
sys.path.insert(0, os.getcwd())
from telegram_v2.albert import routerai
from integration import dcs_service

TARIFFS=json.loads((Path(__file__).resolve().parents[2]/'server/aiTariffs.json').read_text())
SCOPE=contextvars.ContextVar('ai_scope',default=None)
DB=os.environ.get('COMMERCE_DB_PATH','')
if not DB or not os.path.isabs(DB):raise RuntimeError('absolute_commerce_db_required')
if os.environ.get('FIRST_SALES_PROXY_URL'):
    from urllib.parse import urlparse
    proxy=urlparse(os.environ['FIRST_SALES_PROXY_URL'])
    if proxy.scheme!='http' or proxy.hostname!='127.0.0.1':raise RuntimeError('bounded_proxy_required')
    routerai.URL=os.environ['FIRST_SALES_PROXY_URL'].rstrip('/')+'/api/v1'

def reserve(body, scope):
    now=int(time.time()*1000)
    captured=int(__import__('datetime').datetime.fromisoformat(TARIFFS['captured_at'].replace('Z','+00:00')).timestamp()*1000)
    if not captured<=now<=captured+TARIFFS['valid_for_ms']:raise RuntimeError('ai_tariffs_stale')
    row=next((r for r in TARIFFS['rows'] if r['model']==body.get('model')),None)
    if not row:raise RuntimeError('ai_price_bound_unknown')
    messages=body.get('messages');maximum=body.get('max_tokens')
    if not isinstance(messages,list) or not 1<=len(messages)<=100 or any(not isinstance(m.get('content'),str) or m.get('role') not in ('system','user','assistant') for m in messages) or len(json.dumps(messages,ensure_ascii=False).encode())>65536 or not isinstance(maximum,int) or not 1<=maximum<=8000:raise RuntimeError('ai_input_bound_exceeded')
    if os.environ.get('COMMERCE_BUDGET_APPROVED')!='true':raise RuntimeError('ai_budget_unconfigured')
    pool=scope.get('pool','free');order_id=scope.get('orderId');cost=row['reserve_micro_rub']
    db=sqlite3.connect(DB,timeout=5,isolation_level=None);db.row_factory=sqlite3.Row
    try:
        db.execute('BEGIN IMMEDIATE')
        if db.execute("SELECT 1 FROM configuration WHERE key='ai_budget_recovery_locked'").fetchone():raise RuntimeError('ai_budget_recovery_waiting')
        if pool=='paid':
            order=db.execute('SELECT kind,state FROM orders WHERE id=?',(order_id,)).fetchone()
            if not order or order['kind']!='paid' or order['state'] not in ('paid','answers_saved','generating','generation_failed','ready'):raise RuntimeError('paid_order_not_available')
            held=db.execute('SELECT * FROM ai_budget_commitments WHERE order_id=?',(order_id,)).fetchone()
            if not held or held['spent_micro']+cost>held['capacity_micro'] or held['attempts']>=held['attempt_limit']:raise RuntimeError('paid_service_waiting')
            db.execute('UPDATE ai_budget_commitments SET spent_micro=spent_micro+?,attempts=attempts+1 WHERE order_id=?',(cost,order_id))
        else:
            pool='free';order_id=None
            limit=db.execute("SELECT * FROM ai_budget_limits WHERE pool='free'").fetchone()
            used=db.execute("SELECT COUNT(*) AS attempts,COALESCE(SUM(cost_micro),0) AS cost FROM ai_budget_attempts WHERE pool='free'").fetchone()
            if not limit or used['attempts']>=limit['attempt_limit'] or used['cost']+cost>limit['limit_micro']:raise RuntimeError('free_budget_exhausted')
        ident=str(uuid.uuid4());db.execute("INSERT INTO ai_budget_attempts VALUES (?,?,?,?,?,'reserved',?,NULL)",(ident,pool,order_id,body['model'],cost,now));db.execute('COMMIT');return ident
    except:
        db.execute('ROLLBACK');raise
    finally:db.close()

native_post=routerai._bounded_post
def accounted_post(body,key,timeout,transport):
    scope=SCOPE.get() or {'pool':'free'}
    try:ident=reserve(body,scope)
    except Exception as error:
        scope['budget_error']=str(error) if str(error).startswith(('ai_','paid_','free_')) else 'ai_budget_unavailable'
        raise
    successful=False
    try:
        response=native_post(body,key,timeout,transport);successful=response.status_code==200;return response
    finally:
        with sqlite3.connect(DB,timeout=5) as db:db.execute("UPDATE ai_budget_attempts SET state=?,finished_at=? WHERE id=? AND state='reserved'",('complete' if successful else 'uncertain',int(time.time()*1000),ident))
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
    self.send_header('X-AI-Budget-Fingerprint',hmac.new(os.environ.get('COMMERCE_DATA_KEY','').encode(),('budget-db:'+DB).encode(),hashlib.sha256).hexdigest())
    return native_end(self)
dcs_service.DCSRequestHandler.end_headers=budget_headers

if __name__=='__main__':dcs_service.main()
