const proxy=new URL(process.env.FIRST_SALES_PROXY_URL||'');
if(proxy.protocol!=='http:'||proxy.hostname!=='127.0.0.1'||proxy.pathname!=='/')throw new Error('bounded_proxy_required');
if(process.env.NODE_ENV==='production')throw new Error('bounded_smoke_local_only');
const original=globalThis.fetch;
globalThis.fetch=((input:Parameters<typeof fetch>[0],init:Parameters<typeof fetch>[1])=>{
  const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
  if(url.hostname==='routerai.ru'){
    if(url.href!=='https://routerai.ru/api/v1/chat/completions')throw new Error('bounded_provider_endpoint_denied');
    return original(new URL('/api/v1/chat/completions',proxy),init);
  }
  return original(input,init);
}) as typeof fetch;
// Dynamic import guarantees client constructors capture the guarded transport.
const {createApp}=await import('../../server');
const {app}=await createApp();
app.listen(Number(process.env.PORT)||39791,'127.0.0.1',()=>console.info('Bounded Web smoke listening on loopback'));
