import { CommerceError, type StoryOrder } from './commerceStore';

export interface Payment {
  id:string;status:string;paid:boolean;test:boolean;
  amount:{value:string;currency:string};metadata:{order_id:string};
  confirmation?:{confirmation_url:string};
}
export interface StoryPayment {
  readonly mode:'mock'|'test'|'live'|'disabled';
  create(order:StoryOrder):Promise<Payment>;
  get(id:string):Promise<Payment>;
  refund?(id:string):Promise<{id:string;payment_id:string;status:string;amount:{value:string;currency:string}}>;
}

/** Live is a separate, explicitly gated mode. Local setup never enables it. */
export class YooTestPayment implements StoryPayment {
  constructor(private env:NodeJS.ProcessEnv,private transport:typeof fetch=fetch,readonly mode:'test'|'live'='test'){}
  private gate(){
    if(this.mode==='live'&&!liveCheckoutConfigured(this.env))throw new CommerceError('live_checkout_closed',503);
  }
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
  async verifyShop(){
    this.gate();
    const shop=await this.api('me');
    if(shop.account_id!==this.env.YOOKASSA_SHOP_ID||shop.status!=='enabled'||shop.test!==(this.mode==='test'))throw new CommerceError('payment_shop_mismatch',422);
    if(this.mode==='live'&&shop.fiscalization?.enabled!==true)throw new CommerceError('receipt_shop_required',422);
    return shop;
  }
  private checkPayment(payment:Payment){
    if(payment.test!==(this.mode==='test'))throw new CommerceError(this.mode==='test'?'test_shop_required':'live_shop_required',422);
    return payment;
  }
  async create(order:StoryOrder):Promise<Payment>{
    this.gate();
    if(Boolean(order.test)!==(this.mode==='test'))throw new CommerceError('payment_mode_mismatch',422);
    if(order.payment_started && Date.now()-order.payment_started>23*3600000)throw new CommerceError('payment_uncertain_needs_support',503);
    const origin=this.env.COMMERCE_PUBLIC_ORIGIN;
    if(!origin || !/^https:\/\//.test(origin))throw new CommerceError('payment_return_origin_missing',503);
    // Verify credentials and shop BEFORE a potentially money-moving POST.
    await this.verifyShop();
    const email=order.data?.receipt_email;
    if(this.mode==='live'&&(typeof email!=='string'||!validReceiptEmail(email)))throw new CommerceError('receipt_email_required',400);
    const receipt=this.mode==='live'?{customer:{email},tax_system_code:Number(this.env.COMMERCE_RECEIPT_TAX_SYSTEM_CODE),items:[{
      description:'Новая личная история',quantity:'1.00',amount:{value:'790.00',currency:'RUB'},
      vat_code:Number(this.env.COMMERCE_RECEIPT_VAT_CODE),payment_subject:'service',payment_mode:this.env.COMMERCE_RECEIPT_PAYMENT_MODE,
    }]}:undefined;
    const payment=await this.api('payments',{
      amount:{value:'790.00',currency:'RUB'},capture:true,
      description:'Новая личная история',metadata:{order_id:order.id},
      confirmation:{type:'redirect',return_url:new URL('/?stories=1',origin).href},
      ...(receipt?{receipt}:{}),
    },order.id);
    return this.checkPayment(payment);
  }
  async get(id:string):Promise<Payment>{
    if(!/^[\w-]{1,80}$/.test(id))throw new CommerceError('payment_id_invalid',400);
    await this.verifyShop();
    const payment=this.checkPayment(await this.api(`payments/${encodeURIComponent(id)}`));
    if(payment.id!==id)throw new CommerceError('payment_id_mismatch',422);
    return payment;
  }
  async refund(id:string){
    if(!/^[\w-]{1,80}$/.test(id))throw new CommerceError('refund_id_invalid',400);
    await this.verifyShop();
    const refund=await this.api(`refunds/${encodeURIComponent(id)}`);
    if(refund.id!==id)throw new CommerceError('refund_id_mismatch',422);
    await this.get(refund.payment_id); // refund has no test field; verify its payment under this shop/mode
    return refund;
  }
  /** Test-only operator action; never exposed as a customer's money-moving route. */
  async createTestRefund(id:string,requestKey:string){
    if(this.mode!=='test')throw new CommerceError('test_refund_only',403);
    if(!/^[\w-]{8,100}$/.test(requestKey))throw new CommerceError('request_key_required',400);
    const payment=await this.get(id);
    if(payment.status!=='succeeded'||!payment.paid||payment.amount?.value!=='790.00'||payment.amount?.currency!=='RUB')throw new CommerceError('refund_payment_invalid',422);
    return this.api('refunds',{payment_id:id,amount:{value:'790.00',currency:'RUB'}},requestKey);
  }
}

export const validReceiptEmail=(value:string)=>value.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
export function liveCheckoutConfigured(env:NodeJS.ProcessEnv){
  return env.COMMERCE_ENABLED==='true'&&env.COMMERCE_PAYMENT_MODE==='live'&&env.COMMERCE_LIVE_ENABLED==='true'
    &&env.COMMERCE_FISCAL_APPROVED==='true'&&Boolean(env.COMMERCE_SELLER_NAME?.trim())
    &&env.COMMERCE_RECEIPT_PAYMENT_MODE==='full_payment'
    &&Boolean(env.COMMERCE_SUPPORT_EMAIL&&validReceiptEmail(env.COMMERCE_SUPPORT_EMAIL))
    &&/^[1-6]$/.test(env.COMMERCE_RECEIPT_TAX_SYSTEM_CODE||'')&&/^(?:[1-9]|1[0-2])$/.test(env.COMMERCE_RECEIPT_VAT_CODE||'')
    &&Boolean(env.YOOKASSA_SHOP_ID&&env.YOOKASSA_SECRET_KEY&&env.COMMERCE_PUBLIC_ORIGIN?.startsWith('https://'));
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
