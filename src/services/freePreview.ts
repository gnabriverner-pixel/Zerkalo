import {useEffect,useState} from 'react';
export type PreviewStatus={enabled:boolean;active:boolean;phase:string;can_start_myth:boolean;new_generation_available:boolean;pause_message:string;support_url:string|null;started_at:number|null;ends_at:number|null;budget_warning:boolean};
export const meetingUnavailable=(status:PreviewStatus|null)=>status===null||(status.enabled&&status.active);
export async function readFreePreview():Promise<PreviewStatus>{const response=await fetch('/api/free-preview',{cache:'no-store'});if(!response.ok)throw new Error('Не удалось проверить доступность. Попробуйте через минуту.');return response.json();}
export function useFreePreview(){
  const [status,setStatus]=useState<PreviewStatus|null>(null);
  useEffect(()=>{let mounted=true;const read=()=>readFreePreview().then(value=>{if(mounted)setStatus(value);}).catch(()=>{});void read();const timer=setInterval(read,30000);return()=>{mounted=false;clearInterval(timer);};},[]);
  return status;
}

export function getMythsAccessLabel(statusOrEnabled: PreviewStatus | boolean | null | undefined): string {
  if (statusOrEnabled === null || statusOrEnabled === undefined) {
    return 'Проверяем доступ…';
  }
  if (typeof statusOrEnabled === 'boolean') {
    return statusOrEnabled ? 'Мои мифы · бесплатно' : 'Мои мифы · 790 ₽';
  }
  return statusOrEnabled.enabled && statusOrEnabled.active ? 'Мои мифы · бесплатно' : 'Мои мифы · 790 ₽';
}
