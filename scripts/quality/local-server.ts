/** Isolated candidate browser server. Uses normal configured provider, never production storage. */
import 'dotenv/config';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';

const canonicalSibling = path.resolve(process.cwd(), '..', 'digital-code-system');
const root = process.env.DCS_ROOT || (fs.existsSync(canonicalSibling) ? canonicalSibling : '');
if (!root || !fs.existsSync(root)) {
  throw new Error(`[Quality Local Server] Canonical DCS root not found at "${root}". Set DCS_ROOT.`);
}
const pythonBin = process.env.PYTHON_BIN || (fs.existsSync(path.join(root, '.venv312/bin/python')) ? path.join(root, '.venv312/bin/python') : (fs.existsSync('/opt/homebrew/bin/python3.12') ? '/opt/homebrew/bin/python3.12' : 'python3'));
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'zerkalo-quality-'));
const env={...process.env,NODE_ENV:process.env.QUALITY_STATIC==='1'?'production':'development',PORT:'3017',DCS_ROOT:root,PYTHONPATH:root,
  PYTHON_BIN:pythonBin,DCS_BRIDGE_URL:'http://127.0.0.1:39517',
  SHARED_CLAIMS_DIR:path.join(temp,'claims'),CONTINUATION_CLAIM_SECRET:crypto.randomBytes(32).toString('hex')};
const bridge=spawn(env.PYTHON_BIN,['-m','integration.dcs_service','--host','127.0.0.1','--port','39517'],{cwd:root,env,stdio:'ignore'});
const web=spawn(process.execPath,['--import','tsx','server.ts'],{cwd:process.cwd(),env,stdio:['ignore','pipe','pipe']});
// Bounded diagnostics only: application stderr may contain provider URLs or submitted data.
web.stdout.on('data',b=>{if(String(b).includes('Server running'))console.log('QUALITY_LOCAL_READY http://127.0.0.1:3017');});
web.stderr.on('data',()=>{});
for(const child of [bridge,web])child.on('error',()=>console.error('quality_local_child_failed'));
function stop(){bridge.kill();web.kill();}
process.on('SIGINT',stop);process.on('SIGTERM',stop);process.on('exit',stop);
console.log('Isolated synthetic storage; production configuration unchanged.');
