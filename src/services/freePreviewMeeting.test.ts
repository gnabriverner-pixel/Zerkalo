import {describe,it,expect} from 'vitest';import {meetingUnavailable,type PreviewStatus} from './freePreview';
const status={enabled:true,active:true,phase:'open',new_generation_available:true} as PreviewStatus;
describe('Meeting availability during preview',()=>{
  it('blocks mounting before the server status is known',()=>expect(meetingUnavailable(null)).toBe(true));
  it('blocks active preview and a budget pause without discarding saved state',()=>{expect(meetingUnavailable(status)).toBe(true);expect(meetingUnavailable({...status,new_generation_available:false})).toBe(true);});
  it('preserves the ordinary contract when disabled, not started or ended',()=>{expect(meetingUnavailable({...status,enabled:false,active:false})).toBe(false);for(const phase of ['not_started','ended','stopped'])expect(meetingUnavailable({...status,active:false,phase})).toBe(false);});
});
