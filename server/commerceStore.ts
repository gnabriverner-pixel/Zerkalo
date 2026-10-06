import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const STORY_PRICE = 79000;
export const STORY_CURRENCY = 'RUB';
export const ALBERT_ALLOWANCE = 5;
export class CommerceError extends Error {
  constructor(public code: string, public status = 409) { super(code); }
}
export interface SavedStory {
  provenance?:'browser_import'|'server_issued';
  answers?: {q1:string;q2:string;q3:string;q4:string};
  question?: string;
  receipt_email?: string;
  myth?: any;
  messages: {role:'user'|'assistant'; content:string}[];
  note: string;
}
export interface StoryOrder {
  id:string; account_id:string; kind:'free'|'paid'; state:string;
  payment_id:string|null; checkout_url:string|null; payment_started:number|null;
  created_at:number; test:number; issued_at:number|null;
  data:SavedStory; remaining:number; pending:number;
}
const digest = (value:string) => crypto.createHash('sha256').update(value).digest('hex');
const token = () => crypto.randomBytes(32).toString('base64url');

/** All rights are server owned. Tokens are random capabilities, never browser fingerprints. */
export class CommerceStore {
  readonly db:DatabaseSync;
  private key:Buffer;
  private purgeTimer:ReturnType<typeof setInterval>;
  private processLock:string|null=null;
  private tombstones=new Set<string>();
  private accountHash(id:string){return crypto.createHmac('sha256',this.key).update('deleted-account:'+id).digest('hex');}
  private unlock(){if(this.processLock){fs.unlinkSync(this.processLock);this.processLock=null;}}
  constructor(public filename:string, keyHex:string) {
    if (!/^[a-f0-9]{64}$/i.test(keyHex)) throw new CommerceError('commerce_key_missing',503);
    this.key=Buffer.from(keyHex,'hex');
    if (filename!==':memory:') {
      fs.mkdirSync(path.dirname(filename),{recursive:true,mode:0o700});
      if (!fs.existsSync(filename)) fs.closeSync(fs.openSync(filename,'wx',0o600));
      fs.chmodSync(filename,0o600);
      const lock=filename+'.process.lock';
      if(fs.existsSync(lock)){
        const pid=Number(fs.readFileSync(lock,'utf8'));let alive=false;
        try{process.kill(pid,0);alive=true;}catch(error:any){if(error.code!=='ESRCH')throw error;}
        if(alive)throw new CommerceError('commerce_process_already_running',503);
        fs.unlinkSync(lock);
      }
      fs.writeFileSync(lock,String(process.pid),{flag:'wx',mode:0o600});this.processLock=lock;
      if(fs.existsSync(filename+'.deletions.jsonl')){
        for(const line of fs.readFileSync(filename+'.deletions.jsonl','utf8').trim().split('\n').filter(Boolean)){
          const record=JSON.parse(line);if(!/^[a-f0-9]{64}$/.test(record.account_hash))throw new Error('invalid_deletion_journal');
          this.tombstones.add(record.account_hash);
        }
      }
    }
    this.db=new DatabaseSync(filename);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON; PRAGMA secure_delete=ON; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS configuration(key TEXT PRIMARY KEY,value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS ai_budget_limits(pool TEXT PRIMARY KEY,limit_micro INTEGER NOT NULL,attempt_limit INTEGER NOT NULL,order_limit INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS ai_budget_commitments(order_id TEXT PRIMARY KEY,capacity_micro INTEGER NOT NULL,attempt_limit INTEGER NOT NULL,spent_micro INTEGER NOT NULL DEFAULT 0,attempts INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS ai_budget_attempts(id TEXT PRIMARY KEY,pool TEXT NOT NULL,order_id TEXT,model TEXT NOT NULL,cost_micro INTEGER NOT NULL,state TEXT NOT NULL,created_at INTEGER NOT NULL,finished_at INTEGER);
      UPDATE ai_budget_attempts SET state='uncertain' WHERE state='reserved';
      CREATE TABLE IF NOT EXISTS accounts(id TEXT PRIMARY KEY, access_hash TEXT UNIQUE, recovery_hash TEXT UNIQUE, deleted INTEGER NOT NULL DEFAULT 0, storage_accepted INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS orders(id TEXT PRIMARY KEY,account_id TEXT NOT NULL REFERENCES accounts(id),request_key TEXT NOT NULL,kind TEXT NOT NULL,state TEXT NOT NULL,test INTEGER NOT NULL,created_at INTEGER NOT NULL,issued_at INTEGER,payment_started INTEGER,payment_id TEXT UNIQUE,checkout_url TEXT,payload TEXT,payload_expires INTEGER,UNIQUE(account_id,request_key));
      CREATE UNIQUE INDEX IF NOT EXISTS one_free ON orders(account_id) WHERE kind='free';
      CREATE TABLE IF NOT EXISTS operations(order_id TEXT NOT NULL REFERENCES orders(id),request_key TEXT NOT NULL,kind TEXT NOT NULL,input_hash TEXT NOT NULL,state TEXT NOT NULL,charged INTEGER NOT NULL DEFAULT 0,result TEXT,created_at INTEGER NOT NULL,finished_at INTEGER,PRIMARY KEY(order_id,request_key));
      CREATE TABLE IF NOT EXISTS events(id TEXT PRIMARY KEY,name TEXT NOT NULL,order_id TEXT,created_at INTEGER NOT NULL,test INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS support_requests(order_id TEXT PRIMARY KEY REFERENCES orders(id),reason TEXT NOT NULL,created_at INTEGER NOT NULL,test INTEGER NOT NULL);
      UPDATE operations SET state='uncertain' WHERE state='running';`);
    const accountColumns=new Set((this.db.prepare('PRAGMA table_info(accounts)').all() as any[]).map(row=>row.name));
    if(!accountColumns.has('storage_version'))this.db.exec('ALTER TABLE accounts ADD COLUMN storage_version TEXT');
    if(!accountColumns.has('storage_accepted_at'))this.db.exec('ALTER TABLE accounts ADD COLUMN storage_accepted_at INTEGER');
    const fingerprint=digest('commerce-key:'+keyHex);
    const saved=this.db.prepare('SELECT value FROM configuration WHERE key=?').get('encryption_key') as any;
    if (saved && saved.value!==fingerprint) { this.db.close();this.unlock(); throw new CommerceError('commerce_key_changed',503); }
    this.db.prepare('INSERT OR IGNORE INTO configuration VALUES (?,?)').run('encryption_key',fingerprint);
    for(const account of this.db.prepare('SELECT id FROM accounts WHERE deleted=0').all() as any[]){
      if(this.tombstones.has(this.accountHash(account.id)))this.eraseRows(account.id);
    }
    if(filename!==':memory:'&&fs.existsSync(filename+'.revocations.jsonl')){
      for(const line of fs.readFileSync(filename+'.revocations.jsonl','utf8').split('\n').filter(Boolean)){
        const record=JSON.parse(line);if(!/^[a-f0-9-]{36}$/.test(record.order_id))throw new CommerceError('invalid_revocation_journal',503);
        this.db.prepare("UPDATE orders SET state='refunded' WHERE id=? AND state!='deleted'").run(record.order_id);
      }
    }
    this.purgeTemporary();this.purgeTimer=setInterval(()=>this.purgeTemporary(),10000);this.purgeTimer.unref?.();
  }
  close(){clearInterval(this.purgeTimer);this.db.close();this.unlock();}
  purgeTemporary(){
    const ids=this.db.prepare('SELECT id FROM orders WHERE payload_expires IS NOT NULL AND payload_expires<=?').all(Date.now()) as any[];
    for(const row of ids){
      this.db.prepare('UPDATE orders SET payload=?,payload_expires=NULL WHERE id=?').run(this.encrypt({messages:[],note:''}),row.id);
      this.db.prepare('UPDATE operations SET result=NULL WHERE order_id=?').run(row.id);
    }
    if(ids.length)this.db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
  }
  private encrypt(value:unknown):string {
    const iv=crypto.randomBytes(12), cipher=crypto.createCipheriv('aes-256-gcm',this.key,iv);
    const body=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);
    return [iv.toString('base64url'),cipher.getAuthTag().toString('base64url'),body.toString('base64url')].join('.');
  }
  private decrypt(value:string):any {
    const [iv,tag,body]=value.split('.'), decipher=crypto.createDecipheriv('aes-256-gcm',this.key,Buffer.from(iv,'base64url'));
    decipher.setAuthTag(Buffer.from(tag,'base64url'));
    return JSON.parse(Buffer.concat([decipher.update(Buffer.from(body,'base64url')),decipher.final()]).toString('utf8'));
  }
  private tx<T>(action:()=>T):T {
    this.db.exec('BEGIN IMMEDIATE');
    try { const result=action(); this.db.exec('COMMIT'); return result; }
    catch(error){this.db.exec('ROLLBACK');throw error;}
  }
  configureAIBudget(policy:{free:{limit_micro:number;attempt_limit:number};paid:{limit_micro:number;attempt_limit:number;order_limit:number}}){
    for(const p of [policy.free,policy.paid])if(!Number.isSafeInteger(p.limit_micro)||p.limit_micro<=0||!Number.isSafeInteger(p.attempt_limit)||p.attempt_limit<=0)throw new CommerceError('ai_budget_unconfigured',503);
    if(!Number.isSafeInteger(policy.paid.order_limit)||policy.paid.order_limit<=0)throw new CommerceError('ai_budget_unconfigured',503);
    this.tx(()=>{
      for(const pool of ['free','paid'] as const){
        const p=policy[pool],order_limit=pool==='paid'?policy.paid.order_limit:0;
        const old=this.db.prepare('SELECT * FROM ai_budget_limits WHERE pool=?').get(pool) as any;
        if(old&&(old.limit_micro!==p.limit_micro||old.attempt_limit!==p.attempt_limit||old.order_limit!==order_limit))throw new CommerceError('ai_budget_policy_changed_needs_review',503);
        this.db.prepare('INSERT OR IGNORE INTO ai_budget_limits VALUES (?,?,?,?)').run(pool,p.limit_micro,p.attempt_limit,order_limit);
      }
    });
  }
  aiBudgetOpen(){if(this.db.prepare("SELECT 1 FROM configuration WHERE key='ai_budget_recovery_locked'").get())throw new CommerceError('ai_budget_recovery_waiting',503);}
  aiCapacity(cost:number,attempts:number){
    this.aiBudgetOpen();const limit=this.db.prepare("SELECT * FROM ai_budget_limits WHERE pool='paid'").get() as any;
    if(!limit)throw new CommerceError('ai_budget_unconfigured',503);
    const held=this.db.prepare('SELECT COALESCE(SUM(capacity_micro),0) AS cost,COALESCE(SUM(attempt_limit),0) AS attempts,COUNT(*) AS orders FROM ai_budget_commitments').get() as any;
    return held.cost+cost<=limit.limit_micro&&held.attempts+attempts<=limit.attempt_limit&&held.orders<limit.order_limit;
  }
  holdAIBudget(account:string,id:string,cost:number,attempts:number){
    return this.tx(()=>{
      this.aiBudgetOpen();const order=this.order(account,id);if(order.kind!=='paid')throw new CommerceError('paid_order_required');
      if(this.db.prepare('SELECT 1 FROM ai_budget_commitments WHERE order_id=?').get(id))return;
      if(!this.aiCapacity(cost,attempts))throw new CommerceError('new_sales_paused',503);
      this.db.prepare('INSERT INTO ai_budget_commitments(order_id,capacity_micro,attempt_limit) VALUES (?,?,?)').run(id,cost,attempts);
    });
  }
  reserveAI(pool:'free'|'paid',orderId:string|undefined,model:string,cost:number){
    return this.tx(()=>{
      this.aiBudgetOpen();if(!Number.isSafeInteger(cost)||cost<=0)throw new CommerceError('ai_price_bound_unknown',503);
      if(pool==='paid'){
        const order=this.db.prepare('SELECT kind,state FROM orders WHERE id=?').get(orderId||'') as any;
        if(order?.kind!=='paid'||!['paid','answers_saved','generating','generation_failed','ready'].includes(order.state))throw new CommerceError('paid_order_not_available',503);
        const p=this.db.prepare('SELECT * FROM ai_budget_commitments WHERE order_id=?').get(orderId||'') as any;
        if(!p||p.spent_micro+cost>p.capacity_micro||p.attempts>=p.attempt_limit)throw new CommerceError('paid_service_waiting',503);
        this.db.prepare('UPDATE ai_budget_commitments SET spent_micro=spent_micro+?,attempts=attempts+1 WHERE order_id=?').run(cost,orderId!);
      }else{
        const p=this.db.prepare("SELECT * FROM ai_budget_limits WHERE pool='free'").get() as any;
        const used=this.db.prepare("SELECT COUNT(*) AS attempts,COALESCE(SUM(cost_micro),0) AS cost FROM ai_budget_attempts WHERE pool='free'").get() as any;
        if(!p||used.attempts>=p.attempt_limit||used.cost+cost>p.limit_micro)throw new CommerceError('free_budget_exhausted',429);
      }
      const id=crypto.randomUUID();this.db.prepare("INSERT INTO ai_budget_attempts VALUES (?,?,?,?,?,'reserved',?,NULL)").run(id,pool,orderId||null,model,cost,Date.now());return id;
    });
  }
  finishAI(id:string,success:boolean){this.db.prepare("UPDATE ai_budget_attempts SET state=?,finished_at=? WHERE id=? AND state='reserved'").run(success?'complete':'uncertain',Date.now(),id);}
  budgetSummary(){return {limits:this.db.prepare('SELECT * FROM ai_budget_limits').all(),attempts:this.db.prepare('SELECT pool,state,COUNT(*) AS count,SUM(cost_micro) AS reserved_micro FROM ai_budget_attempts GROUP BY pool,state').all(),commitments:this.db.prepare('SELECT order_id,capacity_micro,spent_micro,attempt_limit,attempts FROM ai_budget_commitments').all()};}
  createAccount(storageAccepted=false){
    const id=crypto.randomUUID(), access=token(), recovery=token();
    this.db.prepare('INSERT INTO accounts(id,access_hash,recovery_hash,storage_accepted,created_at,storage_version,storage_accepted_at) VALUES (?,?,?,?,?,?,?)').run(id,digest(access),digest(recovery),+storageAccepted,Date.now(),storageAccepted?'personal-history-storage-v1':null,storageAccepted?Date.now():null);
    return {id,access,recovery};
  }
  account(access:string|undefined):string|null {
    if(!access || access.length>100)return null;
    return (this.db.prepare('SELECT id FROM accounts WHERE access_hash=? AND deleted=0').get(digest(access)) as any)?.id || null;
  }
  restore(recovery:string){
    if(!/^[\w-]{43}$/.test(recovery))throw new CommerceError('recovery_invalid',403);
    const account=this.db.prepare('SELECT id FROM accounts WHERE recovery_hash=? AND deleted=0').get(digest(recovery)) as any;
    if(!account)throw new CommerceError('recovery_invalid',403);
    this.assertAccount(account.id);
    const access=token(); this.db.prepare('UPDATE accounts SET access_hash=? WHERE id=?').run(digest(access),account.id);
    return {id:account.id,access};
  }
  recovery(account:string){
    this.assertAccount(account);if(!this.storageAccepted(account))throw new CommerceError('storage_consent_required',403);const value=token();
    this.db.prepare('UPDATE accounts SET recovery_hash=? WHERE id=?').run(digest(value),account);
    return value;
  }
  storageAccepted(account:string){return (this.db.prepare('SELECT storage_accepted FROM accounts WHERE id=? AND deleted=0').get(account) as any)?.storage_accepted===1;}
  acceptStorage(account:string){
    this.assertAccount(account);this.list(account);
    this.db.prepare('UPDATE accounts SET storage_accepted=1,storage_version=?,storage_accepted_at=? WHERE id=?').run('personal-history-storage-v1',Date.now(),account);
    this.db.prepare('UPDATE orders SET payload_expires=NULL WHERE account_id=?').run(account);
  }
  createOrder(account:string, requestKey:string, kind:'free'|'paid', test:boolean):StoryOrder {
    return this.tx(()=>{
      this.assertAccount(account);
      if(kind==='paid'&&!this.storageAccepted(account))throw new CommerceError('storage_consent_required',403);
      const existing=this.db.prepare("SELECT id FROM orders WHERE account_id=? AND (request_key=? OR (kind='free' AND ?='free') OR (?='paid' AND kind='paid' AND state='pending_payment'))").get(account,requestKey,kind,kind) as any;
      if(existing)return this.order(account,existing.id);
      if(kind==='paid' && !this.db.prepare("SELECT id FROM orders WHERE account_id=? AND kind='free' AND state='ready'").get(account))throw new CommerceError('complete_free_first');
      const id=crypto.randomUUID();
      this.db.prepare('INSERT INTO orders(id,account_id,request_key,kind,state,test,created_at,payload,payload_expires) VALUES (?,?,?,?,?,?,?,?,?)').run(id,account,requestKey,kind,kind==='free'?'paid':'pending_payment',+test,Date.now(),this.encrypt({messages:[],note:''}),this.storageAccepted(account)?null:Date.now()+300000);
      return this.order(account,id);
    });
  }
  private assertAccount(id:string){
    if(this.tombstones.has(this.accountHash(id))||!this.db.prepare('SELECT id FROM accounts WHERE id=? AND deleted=0').get(id))throw new CommerceError('account_deleted',401);
  }
  order(account:string,id:string):StoryOrder {
    this.assertAccount(account);
    const row=this.db.prepare('SELECT * FROM orders WHERE id=? AND account_id=?').get(id,account) as any;
    if(!row || row.state==='deleted')throw new CommerceError('story_not_found',404);
    if(row.payload_expires!==null&&row.payload_expires<=Date.now()){
      row.payload=this.encrypt({messages:[],note:''});
      this.db.prepare('UPDATE orders SET payload=? WHERE id=?').run(row.payload,id);
      this.db.prepare('UPDATE operations SET result=NULL WHERE order_id=?').run(id);
    }
    const used=this.db.prepare("SELECT SUM(charged) AS used,SUM(CASE WHEN state='running' AND kind='albert' THEN 1 ELSE 0 END) AS pending FROM operations WHERE order_id=?").get(id) as any;
    return {...row,data:this.decrypt(row.payload),remaining:ALBERT_ALLOWANCE-(used.used||0),pending:used.pending||0};
  }
  list(account:string){
    this.assertAccount(account);
    return (this.db.prepare("SELECT id FROM orders WHERE account_id=? AND state!='deleted' ORDER BY created_at DESC").all(account) as any[]).map(row=>this.order(account,row.id));
  }
  saveAnswers(account:string,id:string,answers:SavedStory['answers'],question:string){
    return this.tx(()=>{
      const order=this.order(account,id);
      if(!['paid','answers_saved','generation_failed'].includes(order.state))throw new CommerceError('answers_locked');
      if(this.db.prepare("SELECT 1 FROM operations WHERE order_id=? AND kind='myth'").get(id))throw new CommerceError('answers_locked');
      const old=this.list(account).filter(o=>o.id!==id && o.data.answers && o.data.myth);
      if(order.kind==='paid' && old.some(o=>JSON.stringify(o.data.answers)===JSON.stringify(answers)))throw new CommerceError('new_answers_required',400);
      this.db.prepare("UPDATE orders SET state='answers_saved',payload=? WHERE id=?").run(this.encrypt({...order.data,answers,question}),id);
      return this.order(account,id);
    });
  }
  importFree(account:string,answers:SavedStory['answers'],myth:any){
    if(!this.storageAccepted(account))throw new CommerceError('storage_consent_required',403);
    const order=this.createOrder(account,'legacy-import','free',true);
    if(order.data.myth)return order;
    if(!['paid','ready'].includes(order.state))throw new CommerceError('free_import_not_available');
    this.db.prepare("UPDATE orders SET state='ready',payload=?,issued_at=? WHERE id=?").run(this.encrypt({answers,myth,messages:[],note:'',provenance:'browser_import'}),Date.now(),order.id);
    // Not a server generation or verified completion event.
    return this.order(account,order.id);
  }
  event(name:string,order:StoryOrder){
    if(!['first_completed','offer_shown','checkout_started','server_confirmed','issued','delivery_error'].includes(name))throw new Error('unknown_event');
    // One occurrence per order/event: replay is not another customer or sale.
    this.db.prepare('INSERT OR IGNORE INTO events VALUES (?,?,?,?,?)').run(`${order.id}:${name}`,name,order.id,Date.now(),order.test);
  }
  paymentStarted(account:string,id:string){
    const order=this.order(account,id);
    if(order.kind!=='paid' || order.state!=='pending_payment')throw new CommerceError('payment_not_pending');
    this.db.prepare('UPDATE orders SET payment_started=COALESCE(payment_started,?) WHERE id=?').run(Date.now(),id);
    this.event('checkout_started',order);
  }
  attachPayment(account:string,id:string,paymentId:string,url:string){
    const order=this.order(account,id);
    if(order.state!=='pending_payment')return;
    if(order.payment_id && order.payment_id!==paymentId)throw new CommerceError('payment_identity_conflict');
    this.db.prepare('UPDATE orders SET payment_id=?,checkout_url=? WHERE id=?').run(paymentId,url,id);
  }
  paymentOrder(paymentId:string):{id:string;account:string}|null {
    const row=this.db.prepare('SELECT id,account_id FROM orders WHERE payment_id=?').get(paymentId) as any;
    return row?{id:row.id,account:row.account_id}:null;
  }
  confirmPayment(account:string,id:string,payment:{id:string;status:string;paid:boolean;test:boolean;amount:{value:string;currency:string};metadata?:{order_id?:string}}){
    return this.tx(()=>{
      const order=this.order(account,id);
      if(order.kind!=='paid'||payment.id!==order.payment_id||payment.metadata?.order_id!==id||payment.amount?.value!=='790.00'||payment.amount?.currency!==STORY_CURRENCY||payment.test!==Boolean(order.test))throw new CommerceError('payment_mismatch',422);
      if(payment.status==='canceled' && order.state==='pending_payment')this.db.prepare("UPDATE orders SET state='canceled' WHERE id=?").run(id);
      if(payment.status==='succeeded' && payment.paid===true && order.state==='pending_payment'){
        this.db.prepare("UPDATE orders SET state='paid' WHERE id=?").run(id);this.event('server_confirmed',order);
      }
      return this.order(account,id);
    });
  }
  markRefunded(account:string,id:string){
    // A verified merchant refund may arrive after the person deleted the archive. Never revive its payload.
    if(!this.db.prepare('SELECT id FROM orders WHERE id=? AND account_id=?').get(id,account))throw new CommerceError('story_not_found',404);
    if(this.filename!==':memory:'){
      const fd=fs.openSync(this.filename+'.revocations.jsonl','a',0o600);
      try{fs.writeSync(fd,JSON.stringify({order_id:id,revoked_at:Date.now()})+'\n');fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
    }
    this.db.prepare("UPDATE orders SET state='refunded' WHERE id=?").run(id);
  }
  reserve(account:string,id:string,key:string,kind:'myth'|'albert',input:unknown):{state:string;result?:any} {
    return this.tx(()=>{
      const order=this.order(account,id);
      const inputHash=crypto.createHmac('sha256',this.key).update(JSON.stringify(input)).digest('hex');
      const previous=this.db.prepare('SELECT * FROM operations WHERE order_id=? AND request_key=?').get(id,key) as any;
      if(previous){
        if(previous.input_hash!==inputHash || previous.kind!==kind)throw new CommerceError('request_key_conflict');
        return {state:previous.state,result:previous.result?this.decrypt(previous.result):undefined};
      }
      if(kind==='myth' && !['answers_saved','generation_failed'].includes(order.state))throw new CommerceError('myth_not_available');
      if(kind==='albert' && order.state!=='ready')throw new CommerceError('story_not_ready');
      if(kind==='albert' && order.remaining-order.pending<=0)throw new CommerceError('albert_limit');
      if(this.db.prepare("SELECT 1 FROM operations WHERE order_id=? AND state IN ('running','uncertain')").get(id))throw new CommerceError('operation_in_progress');
      const attempts=(this.db.prepare('SELECT COUNT(*) AS n FROM operations WHERE order_id=? AND kind=?').get(id,kind) as any).n;
      if(attempts>=(kind==='myth'?3:10))throw new CommerceError('delivery_needs_support',503);
      const day=Math.floor(Date.now()/86400000)*86400000;
      const maximum=Number(process.env.COMMERCE_DAILY_OPERATION_MAX)||50;
      const daily=(this.db.prepare("SELECT COUNT(*) AS n FROM operations p JOIN orders o ON o.id=p.order_id WHERE p.created_at>=? AND o.kind='free'").get(day) as any).n;
      if(order.kind==='free'&&daily>=maximum)throw new CommerceError('daily_budget_reached',429);
      this.db.prepare("INSERT INTO operations(order_id,request_key,kind,input_hash,state,created_at) VALUES (?,?,?,?,'running',?)").run(id,key,kind,inputHash,Date.now());
      if(kind==='myth')this.db.prepare("UPDATE orders SET state='generating' WHERE id=?").run(id);
      return {state:'reserved'};
    });
  }
  complete(account:string,id:string,key:string,result:any,userMessage?:string){
    return this.tx(()=>{
      const order=this.order(account,id);
      if(['refunded','deleted'].includes(order.state))throw new CommerceError('order_revoked');
      const op=this.db.prepare("SELECT kind,state FROM operations WHERE order_id=? AND request_key=?").get(id,key) as any;
      if(!op || op.state!=='running')throw new CommerceError('operation_not_running');
      const success=result.status==='ok';
      let data=order.data;
      if(success && op.kind==='myth')data={...data,myth:result.story_result,provenance:'server_issued'};
      if(success && op.kind==='albert')data={...data,messages:[...data.messages,{role:'user',content:userMessage!},{role:'assistant',content:result.reply}]};
      this.db.prepare("UPDATE operations SET state='complete',charged=?,result=?,finished_at=? WHERE order_id=? AND request_key=?").run(+(success&&op.kind==='albert'),this.encrypt(result),Date.now(),id,key);
      this.db.prepare('UPDATE orders SET state=?,payload=?,issued_at=CASE WHEN ? THEN COALESCE(issued_at,?) ELSE issued_at END WHERE id=?').run(op.kind==='myth'?(success?'ready':'generation_failed'):order.state,this.encrypt(data),+(success&&op.kind==='myth'),Date.now(),id);
      if(success&&op.kind==='myth'){this.event('issued',order);if(order.kind==='free')this.event('first_completed',order);}
      return this.order(account,id);
    });
  }
  fail(account:string,id:string,key:string){
    return this.tx(()=>{
      const order=this.order(account,id);
      const op=this.db.prepare('SELECT kind,state FROM operations WHERE order_id=? AND request_key=?').get(id,key) as any;
      if(op?.state!=='running')return;
      this.db.prepare("UPDATE operations SET state='failed',finished_at=? WHERE order_id=? AND request_key=?").run(Date.now(),id,key);
      if(op.kind==='myth')this.db.prepare("UPDATE orders SET state='generation_failed' WHERE id=?").run(id);
      this.event('delivery_error',order);
    });
  }
  acknowledgeUncertain(account:string,id:string){
    return this.tx(()=>{
      this.order(account,id);
      // A human explicitly accepts another finite attempt after an interrupted server process.
      this.db.prepare("UPDATE operations SET state='failed' WHERE order_id=? AND state='uncertain'").run(id);
      this.db.prepare("UPDATE orders SET state='generation_failed' WHERE id=? AND state='generating'").run(id);
    });
  }
  note(account:string,id:string,note:string){
    const order=this.order(account,id);
    this.db.prepare('UPDATE orders SET payload=? WHERE id=?').run(this.encrypt({...order.data,note}),id);
  }
  receiptContact(account:string,id:string,email:string){
    const order=this.order(account,id);
    if(order.state!=='pending_payment')throw new CommerceError('payment_already_started');
    if(order.data?.receipt_email&&order.data.receipt_email!==email)throw new CommerceError('receipt_contact_conflict');
    this.db.prepare('UPDATE orders SET payload=? WHERE id=?').run(this.encrypt({...order.data,receipt_email:email}),id);
  }
  support(account:string,id:string,reason:'delivery'|'refund'){
    const order=this.order(account,id);
    if(order.kind!=='paid')throw new CommerceError('paid_order_required');
    this.db.prepare('INSERT INTO support_requests VALUES (?,?,?,?) ON CONFLICT(order_id) DO UPDATE SET reason=excluded.reason').run(id,reason,Date.now(),order.test);
  }
  private eraseRows(account:string){
    this.tx(()=>{
      this.db.prepare('UPDATE operations SET result=NULL,state=\'deleted\' WHERE order_id IN (SELECT id FROM orders WHERE account_id=?)').run(account);
      this.db.prepare("UPDATE orders SET payload=NULL,checkout_url=NULL,state='deleted' WHERE account_id=?").run(account);
      this.db.prepare('UPDATE accounts SET access_hash=NULL,recovery_hash=NULL,deleted=1 WHERE id=?').run(account);
    });
    this.db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
  }
  deleteAccount(account:string){
    this.assertAccount(account);const hash=this.accountHash(account);
    if(this.filename!==':memory:'){
      const fd=fs.openSync(this.filename+'.deletions.jsonl','a',0o600);
      try{fs.writeSync(fd,JSON.stringify({account_hash:hash,deleted_at:Date.now()})+'\n');fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
    }
    this.tombstones.add(hash);this.eraseRows(account);
  }
}
