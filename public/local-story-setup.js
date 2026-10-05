const status=document.getElementById('status'),form=document.getElementById('setup');
fetch('/api/local-story-setup',{cache:'no-store'}).then(r=>r.json()).then(d=>{status.textContent=`Хранилище: ${d.storage_ready?'настроено':'не настроено'}. RouterAI: ${d.configured.ROUTERAI_API_KEY?'ключ установлен':'ключ не установлен'}. Тестовый магазин: ${d.configured.YOOKASSA_SHOP_ID&&d.configured.YOOKASSA_SECRET_KEY?'ключи установлены':'не подключён'}. Это не проверка доступности провайдеров.`;}).catch(()=>{status.textContent='Не удалось прочитать состояние.';});
form.addEventListener('submit',async event=>{
 event.preventDefault();const button=form.querySelector('button');button.disabled=true;
 try{const values=Object.fromEntries(new FormData(form));values.confirmed=document.getElementById('confirm').checked;
 const response=await fetch('/api/local-story-setup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(values)}),result=await response.json();
 status.textContent=response.ok?'Сохранено. Настоящая оплата закрыта. Перейдите в «Зеркало».':result.error;
 if(response.ok)form.reset();
 }catch{status.textContent='Не удалось сохранить. Не отправляйте ключи в чат.';}finally{button.disabled=false;}
});
