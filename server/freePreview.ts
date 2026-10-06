import {CommerceError,type CommerceStore} from './commerceStore';

export const PREVIEW_DAYS=5;
export const PREVIEW_FEEDBACK_VERSION='free-preview-feedback-v1';
export function previewSupport(value:string|undefined){
  return value&&/^https:\/\/t\.me\/[A-Za-z][A-Za-z0-9_]{4,31}$/.test(value)?value:null;
}
/** The window belongs to the existing database, never to a process start or cookie. */
export class FreePreview {
  constructor(private store:()=>CommerceStore,private env:NodeJS.ProcessEnv,private clock=Date.now){}
  enabled(){return this.env.FREE_PREVIEW_ENABLED==='true';}
  window(){const row=this.store().db.prepare("SELECT value FROM configuration WHERE key='free_preview_window'").get() as any;return row?JSON.parse(row.value):null;}
  activate(){
    if(!this.enabled()||this.env.COMMERCE_BUDGET_APPROVED!=='true')throw new CommerceError('preview_not_approved',503);
    if(!previewSupport(this.env.FREE_PREVIEW_SUPPORT_URL))throw new CommerceError('preview_support_missing',503);
    if(this.window())throw new CommerceError('preview_already_started');
    const start=this.clock(),window={started_at:start,ends_at:start+PREVIEW_DAYS*86400000,time_zone:'Europe/Moscow',days:PREVIEW_DAYS};
    this.store().db.prepare("INSERT INTO configuration VALUES ('free_preview_window',?)").run(JSON.stringify(window));return window;
  }
  stop(){this.store().db.prepare("INSERT OR REPLACE INTO configuration VALUES ('free_preview_stopped','true')").run();}
  status(){
    if(!this.enabled())return {enabled:false,phase:'disabled',active:false,support_url:null,started_at:null,ends_at:null};
    const db=this.store(),window=this.window(),stopped=Boolean(db.db.prepare("SELECT 1 FROM configuration WHERE key='free_preview_stopped'").get());
    const active=Boolean(window&&!stopped&&this.clock()>=window.started_at&&this.clock()<window.ends_at);
    return {enabled:true,phase:active?'open':stopped?'stopped':window?'ended':'not_started',active,
      started_at:window?.started_at??null,ends_at:window?.ends_at??null,support_url:previewSupport(this.env.FREE_PREVIEW_SUPPORT_URL||(db.db.prepare("SELECT value FROM configuration WHERE key='free_preview_support_url'").get() as any)?.value)};
  }
  mark(orderId:string){if(this.status().active)this.store().db.prepare('INSERT OR IGNORE INTO preview_access VALUES (?)').run(orderId);}
  temporary(orderId:string){return Boolean(this.store().db.prepare('SELECT 1 FROM preview_access WHERE order_id=?').get(orderId));}
  requireContinuation(orderId:string){if(this.enabled()&&this.temporary(orderId)&&!this.status().active)throw new CommerceError('preview_ended',503);}
  aggregate(){
    const db=this.store().db,window=this.window();
    return {window:this.status(),measurement:'recoverable accesses/orders, not unique people; no visitor tracking before consent',
      accesses_created:window?(db.prepare('SELECT COUNT(*) AS count FROM accounts WHERE created_at>=? AND created_at<?').get(window.started_at,window.ends_at) as any).count:0,
      events:db.prepare('SELECT name,COUNT(*) AS orders FROM events WHERE order_id IN (SELECT order_id FROM preview_access) GROUP BY name').all(),
      operations:db.prepare('SELECT kind,state,COUNT(*) AS attempts FROM operations WHERE order_id IN (SELECT order_id FROM preview_access) GROUP BY kind,state').all(),
      feedback_count:(db.prepare('SELECT COUNT(*) AS count FROM preview_feedback').get() as any).count,
      budget:this.store().budgetSummary(),pdf_measurement:'server exports; client disk save is not observable'};
  }
}
