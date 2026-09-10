import {describe,it,expect} from 'vitest';
import {issueConsent,verifyConsent} from './consent';
import {CONSENT_MAX_AGE_MS} from '../src/services/consent';

describe('server-issued consent receipt',()=>{
  it('records server time, version and a bounded core-only scope',()=>{
    const r=verifyConsent(issueConsent('core',null,1000),1001)!;
    expect(r.recordedAt).toBe(1000);expect(r.scopes).toEqual(['core']);expect(r.adult).toBe(true);
  });
  it('expires and cannot be forged by a client flag or payload alteration',()=>{
    const token=issueConsent('core',null,1000);
    expect(verifyConsent(token,1000+CONSENT_MAX_AGE_MS)).toBeNull();
    expect(verifyConsent('confirmed')).toBeNull();
    expect(verifyConsent(token.replace(/.$/,'!'),1001)).toBeNull();
    expect(verifyConsent(token,999)).toBeNull();
  });
  it('transfer is a separate scope and survives serialization',()=>{
    const core=verifyConsent(issueConsent('core'))!;
    expect(core.scopes).not.toContain('telegram_transfer');
    expect(verifyConsent(issueConsent('telegram_transfer',core))!.scopes).toEqual(['core','telegram_transfer']);
  });
});
