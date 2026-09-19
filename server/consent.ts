import crypto from 'node:crypto';
import type {Express, Request} from 'express';
import {CONSENT_VERSION, CONSENT_MAX_AGE_MS, type ConsentScope} from '../src/services/consent';

const COOKIE = 'zerkalo_consent';
interface Receipt {version:string; recordedAt:number; expiresAt:number; scopes:ConsentScope[]; adult:true; eventId:string}
const localKey = crypto.randomBytes(32).toString('hex');
function key(): string {
  const value = process.env.CONTINUATION_CLAIM_SECRET || process.env.DELETION_LOOKUP_SECRET;
  if (value && value.length >= 16) return value;
  if (process.env.NODE_ENV === 'production') throw new Error('consent_signing_not_configured');
  return localKey;
}
function sign(payload:string) {return crypto.createHmac('sha256',key()).update(`consent:${payload}`).digest('base64url');}
export function issueConsent(scope:ConsentScope, previous?:Receipt|null, now=Date.now()): string {
  const scopes:ConsentScope[] = ['core'];
  if(scope==='telegram_transfer' || previous?.scopes.includes('telegram_transfer')) scopes.push('telegram_transfer');
  const receipt:Receipt = {version:CONSENT_VERSION, recordedAt:now, expiresAt:now+CONSENT_MAX_AGE_MS,
    scopes,adult:true,eventId:crypto.randomUUID()};
  const payload=Buffer.from(JSON.stringify(receipt)).toString('base64url');
  return `${payload}.${sign(payload)}`;
}
export function verifyConsent(token:string, now=Date.now()): Receipt|null {
  try {
    if(token.length>2048) return null;
    const [payload,signature,...rest]=token.split('.');
    if(rest.length || !payload || !signature) return null;
    const expected=sign(payload);
    if(signature.length!==expected.length || !crypto.timingSafeEqual(Buffer.from(signature),Buffer.from(expected))) return null;
    const r=JSON.parse(Buffer.from(payload,'base64url').toString('utf8'));
    return r.version===CONSENT_VERSION && r.adult===true && Number.isFinite(r.recordedAt) &&
      r.recordedAt<=now && r.expiresAt>now && r.expiresAt-r.recordedAt<=CONSENT_MAX_AGE_MS &&
      Array.isArray(r.scopes) && r.scopes.includes('core') && r.scopes.every((s:string)=>['core','telegram_transfer'].includes(s)) &&
      typeof r.eventId==='string' ? r : null;
  } catch {return null;}
}
function receipt(req:Request):Receipt|null {
  const token=(req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith(`${COOKIE}=`))?.slice(COOKIE.length+1);
  return token ? verifyConsent(token) : null;
}
export function installConsentRoutes(app:Express) {
  app.get('/api/consent',(req,res)=>{const r=receipt(req);res.set('Cache-Control','no-store').json({accepted:Boolean(r),version:CONSENT_VERSION,recordedAt:r?.recordedAt,scopes:r?.scopes||[]});});
  app.post('/api/consent',(req,res)=>{
    const origin=req.get('origin');
    try {if(!origin || new URL(origin).host!==req.get('host')) return res.status(403).json({code:'consent_origin_rejected'});} catch{return res.status(403).json({code:'consent_origin_rejected'});}
    const b=req.body;
    if(b?.accepted!==true || b?.adult!==true || b?.version!==CONSENT_VERSION || !['core','telegram_transfer'].includes(b?.scope)) return res.status(400).json({code:'explicit_consent_required'});
    const previous=receipt(req);
    if(b.scope==='telegram_transfer' && !previous) return res.status(403).json({code:'core_consent_required'});
    try {
      const token=issueConsent(b.scope,previous);
      res.cookie(COOKIE,token,{httpOnly:true,sameSite:'strict',secure:process.env.NODE_ENV==='production',maxAge:CONSENT_MAX_AGE_MS,path:'/'});
      return res.set('Cache-Control','no-store').json({accepted:true,version:CONSENT_VERSION});
    }catch{return res.status(503).json({code:'consent_unavailable'});}
  });
  app.delete('/api/consent',(_req,res)=>{res.clearCookie(COOKIE,{path:'/'});res.json({accepted:false});});
  const protectedPaths=new Set(['/api/calculate','/api/code-v2','/api/preview/code-v2','/api/personal-myth','/api/meeting-of-mirrors',
    '/api/albert/dialogue','/api/handoff/create-claim','/api/generate','/api/feedback']);
  app.use((req,res,next)=>{
    if(req.method!=='POST'||!protectedPaths.has(req.path))return next();
    const r=receipt(req);
    if(!r || (req.path==='/api/handoff/create-claim'&&!r.scopes.includes('telegram_transfer'))) return res.status(403).json({status:'error',code:'consent_required',ui:{safe_message:'Подтвердите условия обработки данных перед продолжением.'}});
    res.locals.consent=r;next();
  });
}
