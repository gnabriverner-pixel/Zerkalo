import { CommerceError, type StoryOrder } from './commerceStore';

export interface Payment {
  id:string;status:string;paid:boolean;test:boolean;
  amount:{value:string;currency:string};metadata:{order_id:string};
  confirmation?:{confirmation_url:string};
}
export interface StoryPayment {
  readonly mode:'mock'|'test'|'disabled';
  create(order:StoryOrder):Promise<Payment>;
  get(id:string):Promise<Payment>;
  refund?(id:string):Promise<{id:string;payment_id:string;status:string;amount:{value:string;currency:string}}>;
}

/** No live-money mode in this unapproved candidate. Test credentials are supplied by its owner. */
export class YooTestPayment implements StoryPayment {
  readonly mode='test' as const;
  constructor(private env:NodeJS.ProcessEnv,private transport:typeof fetch=fetch){}
  private async api(resource:string,body?:unknown,key?:string){
    const {YOOKASSA_SHOP_ID:shop,YOOKASSA_SECRET_KEY:secret}=this.env;
    if(!shop||!secret)throw new CommerceError('payment_configuration_missing',503);
    const response=await this.transport(`https://api.yookassa.ru/v3/${resource}`,{
      method:body?'POST':'GET',signal:AbortSignal.timeout(35000),
      headers:{Authorization:`Basic ${Buffer.from(`${shop}:${secret}`).toString('base64')}`,'Content-Type':'application/json',...(key?{'Idempotence-Key':key}:{})},
      ...(body?{body:JSON.stringify(body)}:{}),
    });
    if(!response.ok)throw new CommerceError('payment_provider_error',503);
    return response.json();
  }
  async create(order:StoryOrder):Promise<Payment>{
    if(!order.test)throw new CommerceError('live_checkout_closed',503);
    if(order.payment_started && Date.now()-order.payment_started>23*3600000)throw new CommerceError('payment_uncertain_needs_support',503);
    const origin=this.env.COMMERCE_PUBLIC_ORIGIN;
    if(!origin || !/^https:\/\//.test(origin))throw new CommerceError('payment_return_origin_missing',503);
    // Fiscal details are merchant specific. Real receipts/live money require a separate release gate.
    const payment=await this.api('payments',{
      amount:{value:'790.00',currency:'RUB'},capture:true,
      description:'Новая личная история',metadata:{order_id:order.id},
      confirmation:{type:'redirect',return_url:new URL('/?stories=1',origin).href},
    },order.id);
    if(payment.test!==true)throw new CommerceError('test_shop_required',422);
    return payment;
  }
  async get(id:string):Promise<Payment>{
    if(!/^[\w-]{1,80}$/.test(id))throw new CommerceError('payment_id_invalid',400);
    const payment=await this.api(`payments/${encodeURIComponent(id)}`);
    if(payment.test!==true)throw new CommerceError('test_shop_required',422);
    if(payment.id!==id)throw new CommerceError('payment_id_mismatch',422);
    return payment;
  }
  async refund(id:string){
    if(!/^[\w-]{1,80}$/.test(id))throw new CommerceError('refund_id_invalid',400);
    return this.api(`refunds/${encodeURIComponent(id)}`);
  }
}

/** Explicit simulation, never a merchant sandbox or evidence of actual payment. */
export class MockStoryPayment implements StoryPayment {
  readonly mode='mock' as const;
  private values=new Map<string,Payment>();
  async create(order:StoryOrder){
    const id=`mock-${order.id}`;
    if(!this.values.has(id))this.values.set(id,{id,status:'pending',paid:false,test:true,amount:{value:'790.00',currency:'RUB'},metadata:{order_id:order.id},confirmation:{confirmation_url:`/api/stories/mock-checkout/${id}`}});
    return this.get(id);
  }
  async get(id:string){
    const value=this.values.get(id);if(!value)throw new CommerceError('mock_payment_unknown',404);
    return structuredClone(value);
  }
  decide(id:string,success:boolean){
    const value=this.values.get(id);if(!value)throw new CommerceError('mock_payment_unknown',404);
    value.status=success?'succeeded':'canceled';value.paid=success;
  }
}
