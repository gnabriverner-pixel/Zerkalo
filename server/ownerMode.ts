import crypto from 'node:crypto';
import type {Request,Response} from 'express';

/** Service mode for the owner's own checks. Off (route 404) unless OWNER_TEST_KEY_SHA256 holds a sha256 hex digest.
 * The key itself is never stored, logged or put in a URL; the cookie is HMAC-signed, httpOnly, 7 days. */
export const OWNER_COOKIE='zerkalo_owner';
export const OWNER_TTL_MS=7*86400000;
const HEX64=/^[a-f0-9]{64}$/i;

export const ownerConfigured=(env:NodeJS.ProcessEnv=process.env)=>HEX64.test(String(env.OWNER_TEST_KEY_SHA256||'').trim());
const secret=(env:NodeJS.ProcessEnv)=>'owner-cookie-v1:'+String(env.OWNER_TEST_KEY_SHA256||'').trim().toLowerCase()+':'+String(env.COMMERCE_DATA_KEY||'');
const sign=(exp:number,env:NodeJS.ProcessEnv)=>crypto.createHmac('sha256',secret(env)).update('owner:'+exp).digest('hex');

export function keyMatches(key:unknown,env:NodeJS.ProcessEnv=process.env){
  if(!ownerConfigured(env)||typeof key!=='string'||!key||key.length>512)return false;
  const given=crypto.createHash('sha256').update(key,'utf8').digest();
  const wanted=Buffer.from(String(env.OWNER_TEST_KEY_SHA256).trim(),'hex');
  return crypto.timingSafeEqual(given,wanted);
}
export function ownerCookieValue(env:NodeJS.ProcessEnv=process.env,now=Date.now()){const exp=now+OWNER_TTL_MS;return `${exp}.${sign(exp,env)}`;}
export function ownerCookieValid(value:string|undefined,env:NodeJS.ProcessEnv=process.env,now=Date.now()){
  if(!ownerConfigured(env)||!value)return false;
  const [expText,mac,...rest]=value.split('.');
  if(rest.length||!/^\d{10,16}$/.test(expText||'')||!/^[a-f0-9]{64}$/.test(mac||''))return false;
  const exp=Number(expText);if(exp<=now||exp>now+OWNER_TTL_MS+60000)return false;
  return crypto.timingSafeEqual(Buffer.from(mac,'hex'),Buffer.from(sign(exp,env),'hex'));
}
export const isOwner=(req:Request,readCookie:(req:Request,name:string)=>string|undefined,env:NodeJS.ProcessEnv=process.env)=>ownerCookieValid(readCookie(req,OWNER_COOKIE),env);
export const setOwnerCookie=(res:Response,env:NodeJS.ProcessEnv=process.env)=>res.cookie(OWNER_COOKIE,ownerCookieValue(env),{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production'||process.env.COMMERCE_PUBLIC_ORIGIN?.startsWith('https://'),path:'/',maxAge:OWNER_TTL_MS});

export const OWNER_PAGE=`<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="robots" content="noindex,nofollow"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Служебный вход</title></head><body style="font-family:system-ui;background:#111;color:#eee;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0"><form id="f" style="display:grid;gap:12px;width:min(320px,90vw)"><label for="k">Служебный ключ</label><input id="k" name="key" type="password" autocomplete="off" required style="padding:10px"><button style="padding:10px">Войти</button><p id="r" role="status"></p></form><script>document.getElementById('f').onsubmit=async function(e){e.preventDefault();var r=await fetch('/api/owner/unlock',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key:document.getElementById('k').value})});document.getElementById('k').value='';document.getElementById('r').textContent=r.ok?'Служебный режим включён на 7 дней.':(r.status===429?'Слишком много попыток.':'Ключ не принят.');};</script></body></html>`;
