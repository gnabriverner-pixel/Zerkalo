import type {Express,Request} from 'express';
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';

const permitted=(req:Request)=>process.env.LOCAL_STORY_SETUP==='true' && process.env.NODE_ENV!=='production' &&
  ['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress||'') && /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(req.get('host')||'');
const fields=['ROUTERAI_API_KEY','YOOKASSA_SHOP_ID','YOOKASSA_SECRET_KEY','COMMERCE_PUBLIC_ORIGIN','COMMERCE_SELLER_NAME','COMMERCE_SELLER_STATUS','COMMERCE_SUPPORT_EMAIL','COMMERCE_SUPPORT_OWNER','COMMERCE_SUPPORT_SLA_HOURS','COMMERCE_FREE_BUDGET_RUB','COMMERCE_FREE_ATTEMPT_MAX','COMMERCE_PAID_BUDGET_RUB','COMMERCE_PAID_ATTEMPT_MAX','COMMERCE_PAID_ORDER_MAX'] as const;
export function installLocalStorySetup(app:Express){
  app.get('/local-story-setup',(req,res)=>{
    if(!permitted(req))return res.sendStatus(404);
    res.set({'Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'"});
    res.sendFile(path.resolve('public/local-story-setup.html'));
  });
  app.get('/api/local-story-setup',(req,res)=>{
    if(!permitted(req))return res.sendStatus(404);
    res.set('Cache-Control','no-store').json({configured:Object.fromEntries(fields.map(key=>[key,Boolean(process.env[key])])),storage_ready:Boolean(process.env.COMMERCE_DATA_KEY),live_checkout:false});
  });
  app.post('/api/local-story-setup',(req,res)=>{
    if(!permitted(req))return res.sendStatus(404);
    try{if(new URL(req.get('origin')||'').host!==req.get('host'))return res.sendStatus(403);}catch{return res.sendStatus(403);}
    if(req.body?.confirmed!==true)return res.status(400).json({error:'Подтвердите сохранение настроек этого локального кандидата.'});
    const additions:Record<string,string>={};
    for(const field of fields){
      const value=req.body?.[field];
      if(value===undefined||value==='')continue;
      if(typeof value!=='string'||value.length>1024||/[\r\n\0]/.test(value))return res.status(400).json({error:'Некорректное значение настройки.'});
      additions[field]=value.trim();
    }
    if(additions.COMMERCE_PUBLIC_ORIGIN){try{const url=new URL(additions.COMMERCE_PUBLIC_ORIGIN);if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/')throw new Error();}catch{return res.status(400).json({error:'Адрес возврата должен быть отдельным HTTPS-адресом без пути и пароля.'});}}
    if(additions.COMMERCE_SUPPORT_EMAIL&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(additions.COMMERCE_SUPPORT_EMAIL))return res.status(400).json({error:'Укажите корректную почту поддержки.'});
    for(const field of ['COMMERCE_SUPPORT_SLA_HOURS','COMMERCE_FREE_BUDGET_RUB','COMMERCE_FREE_ATTEMPT_MAX','COMMERCE_PAID_BUDGET_RUB','COMMERCE_PAID_ATTEMPT_MAX','COMMERCE_PAID_ORDER_MAX'])if(additions[field]&&!/^[1-9][0-9]{0,5}$/.test(additions[field]))return res.status(400).json({error:'Финансовые пределы и срок ответа должны быть положительными целыми числами.'});
    if(req.body?.financial_confirmed===true){
      if(['COMMERCE_FREE_BUDGET_RUB','COMMERCE_FREE_ATTEMPT_MAX','COMMERCE_PAID_BUDGET_RUB','COMMERCE_PAID_ATTEMPT_MAX','COMMERCE_PAID_ORDER_MAX'].some(field=>!additions[field]))return res.status(400).json({error:'Для отдельного утверждения финансового предела заполните все пять полей бюджета.'});
      additions.COMMERCE_BUDGET_APPROVED='true';
    }
    else if(Object.keys(additions).some(field=>/^COMMERCE_(FREE|PAID)_/.test(field)))additions.COMMERCE_BUDGET_APPROVED='false';
    const filename=path.resolve('.env');
    try{
      let text=fs.existsSync(filename)?fs.readFileSync(filename,'utf8'):'';
      for(const field of ['DELETION_LOOKUP_SECRET','COMMERCE_DATA_KEY']){
        if(process.env[field])continue;
        if(new RegExp(`^${field}\\s*=`, 'm').test(text))return res.status(409).json({error:'Существующая настройка не загружена. Остановите настройку; секрет автоматически не заменяется.'});
        if(fs.existsSync(path.resolve(field==='COMMERCE_DATA_KEY'?'data/commerce/stories.sqlite':'data/deletion_scopes.json')))return res.status(409).json({error:'Есть сохранённые данные без загруженного ключа. Нужна проверка конфигурации, автоматическая замена запрещена.'});
        additions[field]=crypto.randomBytes(32).toString('hex');
      }
      additions.COMMERCE_ENABLED='true';
      // This form cannot open live payments; test store and mock are separate modes.
      additions.COMMERCE_PAYMENT_MODE=process.env.COMMERCE_PAYMENT_MODE==='mock'?'mock':((additions.YOOKASSA_SHOP_ID||process.env.YOOKASSA_SHOP_ID)&&(additions.YOOKASSA_SECRET_KEY||process.env.YOOKASSA_SECRET_KEY)?'test':'disabled');
      for(const [field,value]of Object.entries(additions)){
        const line=`${field}=${JSON.stringify(value)}`;
        const pattern=new RegExp(`^${field}\\s*=.*$`,'m');
        text=pattern.test(text)?text.replace(pattern,()=>line):text+(text.endsWith('\n')||!text?'':'\n')+line+'\n';
      }
      const temp=filename+'.'+crypto.randomUUID()+'.tmp';
      fs.writeFileSync(temp,text,{mode:0o600,flag:'wx'});fs.renameSync(temp,filename);fs.chmodSync(filename,0o600);
      Object.assign(process.env,additions);
      res.set('Cache-Control','no-store').json({saved:true,payment_mode:additions.COMMERCE_PAYMENT_MODE,live_checkout:false});
    }catch{res.status(503).json({error:'Настройки не удалось сохранить. Значения не выводятся; проверьте права на локальную папку.'});}
  });
}
