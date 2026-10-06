import 'dotenv/config';import path from 'node:path';
import {CommerceStore} from '../server/commerceStore';import {backupStories,restoreStories} from './story_backup';
if(process.env.NODE_ENV==='production')throw new Error('production_restore_requires_separate_authorisation');
const args=process.argv.slice(2);const value=(name:string)=>{const i=args.indexOf(name);if(i<0||!args[i+1])throw new Error('missing_'+name);return path.resolve(args[i+1]);};
const key=process.env.COMMERCE_DATA_KEY||'';
if(args[0]==='backup'){
 const store=new CommerceStore(path.resolve(process.env.COMMERCE_DB_PATH||'data/commerce/stories.sqlite'),key);
 try{backupStories(store,value('--out'));console.info('BACKUP_COMPLETE encrypted=true keys_included=false');}finally{store.close();}
}else if(args[0]==='restore'){
 restoreStories(value('--snapshot'),value('--destination'),key,value('--deletions'),value('--revocations'));
 console.info('RESTORE_COMPLETE finance_locked=true requires_merchant_and_budget_reconciliation=true');
}else throw new Error('use_backup_or_restore');
