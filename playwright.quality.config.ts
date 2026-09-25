import {defineConfig} from '@playwright/test';
export default defineConfig({
  testDir:'./tests',testMatch:'quality-candidate.spec.ts',timeout:60000,workers:1,
  outputDir:'output/playwright/quality-results',
  reporter:[['list'],['json',{outputFile:'output/playwright/quality-results.json'}]],
  use:{baseURL:'http://127.0.0.1:3017',trace:'retain-on-failure'},
  webServer:{
    command:'DISABLE_HMR=true DELETION_LOOKUP_SECRET="${DELETION_LOOKUP_SECRET:-stage1-synthetic-quality-secret-32chars}" DCS_ROOT="${DCS_ROOT:-../dcs-canonical-732}" PYTHON_BIN="${PYTHON_BIN:-../dcs-canonical-732/.venv/bin/python}" PORT=3017 npx tsx server.ts',
    port:3017,
    reuseExistingServer:false,
    timeout:60000,
  },
  projects:['chromium','webkit'].flatMap(browserName=>[
    {name:`${browserName}-390`,use:{browserName:browserName as 'chromium'|'webkit',...(browserName==='chromium'?{channel:'chrome'}:{}),viewport:{width:390,height:844}}},
    {name:`${browserName}-430`,use:{browserName:browserName as 'chromium'|'webkit',...(browserName==='chromium'?{channel:'chrome'}:{}),viewport:{width:430,height:932}}},
    {name:`${browserName}-1440`,use:{browserName:browserName as 'chromium'|'webkit',...(browserName==='chromium'?{channel:'chrome'}:{}),viewport:{width:1440,height:900}}},
  ]),
});
