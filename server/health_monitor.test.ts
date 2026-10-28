// @vitest-environment node
import {describe,it,expect,beforeEach,afterEach} from 'vitest';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {spawnSync} from 'node:child_process';

const script=path.resolve('deploy/health_monitor.sh');
const SHA='a'.repeat(40);
let dir:string;
const w=(name:string,body:string)=>{const p=path.join(dir,name);fs.writeFileSync(p,body,{mode:0o755});return p;};
beforeEach(()=>{
  dir=fs.mkdtempSync(path.join(os.tmpdir(),'monitor-'));
  // Fake systemctl: state comes from files FAKE_ACTIVE_<unit> / FAKE_RESTARTS_<unit> in the sandbox directory.
  w('systemctl',`#!/usr/bin/env bash
unit="\${@: -1}"; f="$(printf '%s' "$unit" | tr -c 'A-Za-z0-9' '_')"
if [ "$1" = "is-active" ]; then cat "${dir}/active_$f" 2>/dev/null || echo active; exit 0; fi
if [ "$1" = "show" ]; then cat "${dir}/restarts_$f" 2>/dev/null || echo 0; exit 0; fi
`);
  // Fake curl: records every call; web endpoints are healthy, Telegram answers 200.
  w('curl',`#!/usr/bin/env bash
echo "$*" >> "${dir}/curl.log"
out=""; prev=""; for a in "$@"; do if [ "$prev" = "-o" ]; then out="$a"; fi; prev="$a"; done
case "$*" in
  *api.telegram.org*getMe*) if [ "$out" != "/dev/null" ] && [ -n "$out" ]; then :; fi; printf 200; exit 0;;
  *api.telegram.org*sendMessage*) exit 0;;
  *health/ready*) [ -n "$out" ] && echo '{"status":"ready","checks":{"dcs_bridge":{"state":"ready"}}}' > "$out"; printf 200; exit 0;;
  *health*) echo '{"release_sha":"${SHA}"}'; exit 0;;
esac
exit 0
`);
});
afterEach(()=>fs.rmSync(dir,{recursive:true,force:true}));

const run=(now:number,env:Record<string,string>={})=>spawnSync('bash',[script],{encoding:'utf8',env:{
  PATH:process.env.PATH!,HOME:dir,MONITOR_STATE_DIR:path.join(dir,'state'),MONITOR_SYSTEMCTL:path.join(dir,'systemctl'),MONITOR_CURL:path.join(dir,'curl'),
  MONITOR_NOW:String(now),MONITOR_UNITS:'zerkalo.service',MONITOR_RETRY_SLEEP:'0',...env}});
const curlLog=()=>fs.existsSync(path.join(dir,'curl.log'))?fs.readFileSync(path.join(dir,'curl.log'),'utf8'):'';
const sends=()=>curlLog().split('\n').filter(l=>l.includes('sendMessage'));
const setUnit=(active:string,restarts:number)=>{fs.writeFileSync(path.join(dir,'active_zerkalo_service'),active);fs.writeFileSync(path.join(dir,'restarts_zerkalo_service'),String(restarts));};
const bot={MONITOR_BOT_TOKEN:'synthetic-monitor-token',MONITOR_CHAT_ID:'123'};
const T0=Date.parse('2026-10-29T12:00:00Z')/1000;

describe('deploy/health_monitor.sh',()=>{
  it('never uses the product bot token: without monitor credentials it only writes the journal',()=>{
    setUnit('failed',0);
    const r=run(T0,{TELEGRAM_BOT_TOKEN:'synthetic-product-token'});
    expect(r.status).toBe(1);expect(r.stdout).toContain('journal only');
    expect(curlLog()).not.toContain('api.telegram.org');expect(curlLog()).not.toContain('synthetic-product-token');
  });
  it('a restarts_grew-style rise is not a message of its own',()=>{
    setUnit('active',0);run(T0,bot);setUnit('active',1);run(T0+300,bot);setUnit('active',2);run(T0+600,bot);
    expect(sends()).toHaveLength(0);
  });
  it('3 or more restarts within an hour: one "unstable" flag, not repeated within the hour',()=>{
    setUnit('active',0);run(T0,bot);
    setUnit('active',3);run(T0+600,bot);
    expect(sends()).toHaveLength(1);expect(decodeURIComponent(sends()[0])).toContain('3 перезапусков за час');
    setUnit('active',4);run(T0+900,bot);expect(sends()).toHaveLength(1);
    setUnit('active',6);run(T0+4300,bot);expect(sends()).toHaveLength(2);// next hour, still unstable
  });
  it('state change: failed then recovered messages; same state is silent; repeated failed within an hour is suppressed',()=>{
    setUnit('active',0);run(T0,bot);expect(sends()).toHaveLength(0);
    setUnit('failed',0);run(T0+300,bot);expect(sends()).toHaveLength(1);expect(sends()[0]).toContain('unit');
    run(T0+600,bot);expect(sends()).toHaveLength(1);
    setUnit('active',0);run(T0+900,bot);expect(sends()).toHaveLength(2);
    setUnit('failed',0);run(T0+1200,bot);expect(sends()).toHaveLength(2);// failed message sent 15 min ago: suppressed
    setUnit('failed',0);run(T0+300+3700,bot);// still failed, no change: silent
    expect(sends()).toHaveLength(2);
  });
  it('daily summary at 09:00 Moscow only with the flag, once per day',()=>{
    setUnit('active',0);
    const nine=Date.parse('2026-10-30T06:00:00Z')/1000;
    run(nine,bot);expect(sends()).toHaveLength(0);
    run(nine,{...bot,MONITOR_DAILY_SUMMARY:'true'});expect(sends()).toHaveLength(1);expect(decodeURIComponent(sends()[0])).toContain('сводка');
    run(nine+300,{...bot,MONITOR_DAILY_SUMMARY:'true'});expect(sends()).toHaveLength(1);
    run(nine-3600,{...bot,MONITOR_DAILY_SUMMARY:'true'});expect(sends()).toHaveLength(1);// 08:00 MSK: not the time
    run(nine+86400,{...bot,MONITOR_DAILY_SUMMARY:'true'});expect(sends()).toHaveLength(2);
  });
});
