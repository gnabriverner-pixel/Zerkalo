// Visual capture for release 14a (issue B «Museum»). Usage: node scripts/capture_release14a_visual.mjs <baseUrl> <outDir> <prefix>
// Static example only (embedded sample 14.03.1987); no model calls.
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const [base = 'http://localhost:3099', out = 'shots-v', prefix = 'after'] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const exe = '/Users/artemkrysin/Library/Caches/ms-playwright/chromium-1155/chrome-mac/Chromium.app/Contents/MacOS/Chromium';
const browser = await chromium.launch({ headless: true, ...(fs.existsSync(exe) ? { executablePath: exe } : {}) });
const report = {};
for (const vp of [{ n: '390', w: 390, h: 844 }, { n: '1440', w: 1440, h: 900 }]) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const shot = (name, full = false) => page.screenshot({ path: path.join(out, `${prefix}-${name}-${vp.n}.png`), fullPage: full });
  await page.goto(base + '/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await shot('home-first');
  await page.evaluate(() => window.scrollTo(0, window.innerHeight * 0.9));
  await page.waitForTimeout(400);
  await shot('home-scroll');
  await page.evaluate(() => window.scrollTo(0, 0));
  const sample = page.locator('button:has-text("Посмотреть пример")').first();
  if (await sample.count()) {
    await sample.click();
    await page.waitForTimeout(1500);
    await shot('code-top');
    report[`code-scrollHeight-${vp.n}`] = await page.evaluate(() => document.documentElement.scrollHeight);
    await shot('code-full', true);
  }
  await page.goto(base + '/primer-lichnogo-mifa', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await shot('myth-example-top');
  report[`myth-scrollHeight-${vp.n}`] = await page.evaluate(() => document.documentElement.scrollHeight);
  await shot('myth-example-full', true);
  await ctx.close();
}
await browser.close();
console.log(JSON.stringify(report));
