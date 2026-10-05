#!/usr/bin/env node
// Narrow compatibility verifier for the unchanged published HTTP bridge, not the full Telegram bot.
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const root=path.resolve(process.argv[2]||'');
const sha=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
if(sha!=='de78eb346a32da5b9f2fe6b5d40e10c85309c93f')throw new Error('legacy_dcs_verifier_requires_exact_de78');
const venv=path.join(root,'.venv'),python=path.join(venv,'bin','python');
if(!fs.existsSync(venv)||fs.lstatSync(venv).isSymbolicLink())throw new Error('own_dcs_venv_required');
const lock=fs.readFileSync(path.join(__dirname,'dcs-de78-test-runtime.lock'),'utf8').trim().split('\n').map(line=>line.split('=='));
const script=`import sys, json, importlib.metadata, pathlib
assert sys.version_info[:2] == (3,12), 'python_312_required'
assert pathlib.Path(sys.prefix).resolve() == pathlib.Path(sys.argv[1]).resolve(), 'own_dcs_venv_required'
for package, version in json.loads(sys.argv[2]):
    distribution=importlib.metadata.distribution(package)
    assert distribution.version == version, 'locked_package_mismatch:'+package
    assert pathlib.Path(distribution.locate_file('')).resolve().is_relative_to(pathlib.Path(sys.prefix).resolve()), 'borrowed_package:'+package
import integration.dcs_service
print('PASS: exact de78 HTTP bridge imports, own Python 3.12, 11 locked packages; no provider call')`;
const output=execFileSync(python,['-c',script,venv,JSON.stringify(lock)],{cwd:root,encoding:'utf8',env:{...process.env,ROUTERAI_API_KEY:'',GOOGLE_API_KEY:'',GEMINI_API_KEY:'',TELEGRAM_V2_ALBERT_API_KEY:''}});
process.stdout.write(output);
