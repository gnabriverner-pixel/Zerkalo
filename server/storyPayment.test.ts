import {describe,it,expect,vi} from 'vitest';
import {YooTestPayment,liveCheckoutConfigured} from './storyPayment';
const testEnv={YOOKASSA_SHOP_ID:'synthetic-shop',YOOKASSA_SECRET_KEY:'synthetic-key',COMMERCE_PUBLIC_ORIGIN:'https://example.test'};
const liveEnv={...testEnv,COMMERCE_ENABLED:'true',COMMERCE_PAYMENT_MODE:'live',COMMERCE_LIVE_ENABLED:'true',COMMERCE_FISCAL_APPROVED:'true',COMMERCE_SELLER_NAME:'Вымышленный продавец',COMMERCE_SUPPORT_EMAIL:'support@example.test',COMMERCE_RECEIPT_VAT_CODE:'1',COMMERCE_RECEIPT_TAX_SYSTEM_CODE:'2',COMMERCE_RECEIPT_PAYMENT_MODE:'full_payment'};
const order=(test:boolean)=>({id:'synthetic-order',test:Number(test),payment_started:Date.now(),data:{receipt_email:'buyer@example.test'}} as any);
describe('merchant modes, synthetic transport only',()=>{
  it.each([{test:false,status:'enabled',account_id:'synthetic-shop'},{test:true,status:'disabled',account_id:'synthetic-shop'},{test:true,status:'enabled',account_id:'another-shop'}])('rejects wrong shop before payment POST: %j',async shop=>{
    const transport=vi.fn(async(_url:string,_init?:RequestInit)=>Response.json(shop));const a=new YooTestPayment(testEnv,transport as any);
    await expect(a.create(order(true))).rejects.toThrow('payment_shop_mismatch');expect(transport).toHaveBeenCalledTimes(1);expect(transport.mock.calls[0][0]).toBe('https://api.yookassa.ru/v3/me');expect(transport.mock.calls[0][1]?.method).toBe('GET');
  });
  it('live is closed by default, including read/refund paths; no provider I/O',async()=>{
    const transport=vi.fn();const a=new YooTestPayment(testEnv,transport,'live');expect(liveCheckoutConfigured(testEnv)).toBe(false);
    await expect(a.create(order(false))).rejects.toThrow('live_checkout_closed');await expect(a.get('payment-1')).rejects.toThrow('live_checkout_closed');await expect(a.refund('refund-1')).rejects.toThrow('live_checkout_closed');expect(transport).not.toHaveBeenCalled();
  });
  it('explicit live mode sends merchant-configured receipt and accepts only test=false',async()=>{
    const transport=vi.fn(async(url:string,init?:RequestInit)=>Response.json(url.endsWith('/me')?{account_id:'synthetic-shop',test:false,status:'enabled',fiscalization:{enabled:true}}:{id:'synthetic-payment',test:false}));
    const a=new YooTestPayment(liveEnv,transport as any,'live');expect((await a.create(order(false))).test).toBe(false);
    const init=transport.mock.calls[1][1]!;const body=JSON.parse(init.body as string);
    expect(body.receipt).toMatchObject({customer:{email:'buyer@example.test'},tax_system_code:2,items:[{vat_code:1,payment_subject:'service',payment_mode:'full_payment'}]});
    expect(body).not.toHaveProperty('save_payment_method');expect(init.headers).toMatchObject({'Idempotence-Key':'synthetic-order'});
  });
  it('rejects missing fiscal approval or parameters before I/O, and wrong fiscal shop before POST',async()=>{
    for(const field of ['COMMERCE_FISCAL_APPROVED','COMMERCE_RECEIPT_VAT_CODE','COMMERCE_RECEIPT_TAX_SYSTEM_CODE','COMMERCE_SELLER_NAME','COMMERCE_SUPPORT_EMAIL','COMMERCE_RECEIPT_PAYMENT_MODE'])expect(liveCheckoutConfigured({...liveEnv,[field]:''})).toBe(false);
    const transport=vi.fn(async()=>Response.json({account_id:'synthetic-shop',test:false,status:'enabled',fiscalization:{enabled:false}}));
    await expect(new YooTestPayment(liveEnv,transport as any,'live').create(order(false))).rejects.toThrow('receipt_shop_required');expect(transport).toHaveBeenCalledTimes(1);
  });
  it('test refund verifies payment then uses durable idempotency; live operation denied',async()=>{
    const transport=vi.fn(async(url:string,init?:RequestInit)=>Response.json(url.endsWith('/me')?{account_id:'synthetic-shop',test:true,status:'enabled'}:url.endsWith('/refunds')?{id:'refund-1',payment_id:'payment-1',status:'succeeded'}:{id:'payment-1',test:true,status:'succeeded',paid:true,amount:{value:'790.00',currency:'RUB'}}));
    const a=new YooTestPayment(testEnv,transport as any);expect((await a.createTestRefund('payment-1','synthetic-refund-1')).id).toBe('refund-1');
    expect(transport.mock.calls[2][1]?.headers).toMatchObject({'Idempotence-Key':'synthetic-refund-1'});
    await expect(new YooTestPayment(liveEnv,transport as any,'live').createTestRefund('payment-1','synthetic-refund-1')).rejects.toThrow('test_refund_only');expect(transport).toHaveBeenCalledTimes(3);
  });
});
