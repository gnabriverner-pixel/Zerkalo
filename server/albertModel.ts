import tariffs from './aiTariffs.json';
import {PRIMARY_MODEL} from './routerai';

/** Model id sent to the dialogue service. Default is the current one; ALBERT_MODEL may name another model, but only one
 * that has a priced tariff row (the financial guard refuses unpriced calls). Anything else is ignored with a warning. */
export function resolveAlbertModel(env:NodeJS.ProcessEnv=process.env):string{
  const wanted=String(env.ALBERT_MODEL||'').trim();
  if(!wanted)return PRIMARY_MODEL;
  if((tariffs.rows as Array<{model:string}>).some(row=>row.model===wanted))return wanted;
  console.warn('albert_model_ignored',{reason:'no_tariff_row'});
  return PRIMARY_MODEL;
}
