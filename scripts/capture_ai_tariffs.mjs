// Public metadata only. Never load .env or send an API key/model request.
import fs from 'node:fs';import {DatabaseSync} from 'node:sqlite';
import {initialiseTariffs,prepareTariffs,currentTariffs,refreshTariffs} from '../server/aiTariffService.mjs';
if(Number(process.versions.node.split('.')[0])!==24)throw Error('Node_24_required');
const i=process.argv.indexOf('--runtime');
if(i<0||!process.argv[i+1])throw Error('use_--runtime_absolute_commerce_database');
const filename=process.argv[i+1];if(!filename.startsWith('/')||!fs.existsSync(filename))throw Error('existing_absolute_database_required');
const db=new DatabaseSync(filename);db.exec('PRAGMA busy_timeout=5000;');
try{
  const seed=JSON.parse(fs.readFileSync(new URL('../server/aiTariffs.json',import.meta.url),'utf8'));
  initialiseTariffs(db,seed);
  if(process.argv.includes('--force'))await refreshTariffs(db);else await prepareTariffs(db);
  console.info(JSON.stringify({version:currentTariffs(db).version,captured_at:currentTariffs(db).captured_at,currency:'RUB',public_metadata_only:true}));
}finally{db.close();}
