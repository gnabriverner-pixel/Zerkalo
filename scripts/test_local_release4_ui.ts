import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

const OUT_DIR = path.resolve('evidence/release-numeric-houses-4-2026-10-13/screenshots');
fs.mkdirSync(OUT_DIR, { recursive: true });

async function main() {
  const port = 3099;
  const env = {
    ...process.env,
    PORT: String(port),
    NODE_ENV: 'test',
    DCS_ROOT: '/Users/artemkrysin/code/digital-code-system-numeric-houses',
    PYTHON_BIN: '/Users/artemkrysin/code/digital-code-system-numeric-houses/.venv/bin/python',
    COMMERCE_ENABLED: 'true',
    FREE_PREVIEW_ENABLED: 'true',
    DELETION_LOOKUP_SECRET: 'test-deletion-secret-32-characters-long!',
    CONTINUATION_CLAIM_SECRET: 'test-deletion-secret-32-characters-long!',
    COMMERCE_DATA_KEY: 'f'.repeat(64)
  };

  const server = spawn('npx', ['tsx', 'server.ts'], {
    env,
    stdio: 'pipe'
  });

  server.stdout.on('data', d => process.stdout.write('[server] ' + d));
  server.stderr.on('data', d => process.stderr.write('[server err] ' + d));

  // Wait for server ready
  let ready = false;
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://localhost:${port}/health`);
      if (res.ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise(r => setTimeout(r, 500));
  }

  if (!ready) {
    server.kill();
    throw new Error('Server failed to start');
  }

  console.log('Server ready on port', port);
  const defaultChromiumPath = '/Users/artemkrysin/Library/Caches/ms-playwright/chromium-1155/chrome-mac/Chromium.app/Contents/MacOS/Chromium';
  const browser = await chromium.launch({
    headless: true,
    ...(fs.existsSync(defaultChromiumPath) ? { executablePath: defaultChromiumPath } : {})
  });

  try {
    const viewports = [
      { name: 'mobile-390', width: 390, height: 844 },
      { name: 'tablet-768', width: 768, height: 1024 },
      { name: 'desktop-1440', width: 1440, height: 900 }
    ];

    for (const vp of viewports) {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: 2
      });
      const page = await context.newPage();

      // 1. Home page
      await page.goto(`http://localhost:${port}/`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('h1:has-text("Зеркало себя")');
      await page.screenshot({ path: path.join(OUT_DIR, `${vp.name}-home.png`), fullPage: false });
      console.log(`Saved ${vp.name}-home.png`);

      // Verify on 390px: are Gate 1 buttons visible without scrolling?
      if (vp.width === 390) {
        const startMythBtn = page.getByRole('button', { name: 'Начать историю' });
        const box = await startMythBtn.boundingBox();
        console.log('390px Start Myth button bounding box:', box);
        if (!box || box.y + box.height > 844) {
          throw new Error(`On 390px, Start Myth button is below fold: y=${box?.y}`);
        }
        console.log('PASS: Start Myth button is visible without scrolling on 390px!');
      }

      await context.close();
    }

    // Test Opening "Прочитать пример" (Sample Myth modal)
    {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 2
      });
      const page = await context.newPage();
      await page.goto(`http://localhost:${port}/`, { waitUntil: 'domcontentloaded' });
      const readSampleBtn = page.getByRole('button', { name: 'Прочитать пример' });
      await readSampleBtn.click();
      await page.waitForSelector('text=Дверь у воды — вымышленный образец');
      await page.screenshot({ path: path.join(OUT_DIR, 'desktop-1440-sample-myth-modal.png') });
      console.log('Saved desktop-1440-sample-myth-modal.png');
      await context.close();
    }

    // Test Opening "Посмотреть пример" (Code result for 14.03.1987)
    {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 2
      });
      const page = await context.newPage();
      await page.goto(`http://localhost:${port}/`, { waitUntil: 'domcontentloaded' });
      const viewCodeSampleBtn = page.getByRole('button', { name: 'Посмотреть пример' });
      await viewCodeSampleBtn.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(OUT_DIR, 'debug-after-code-sample-click.png') });
      console.log('Current URL:', page.url());
      console.log('Page body snippet:', await page.locator('body').innerText().then(t => t.slice(0, 300)));

      // Check if consent modal appears:
      const consentDialog = page.getByRole('dialog', { name: 'Ваш опыт остаётся вашим' });
      if (await consentDialog.isVisible().catch(() => false)) {
        console.log('Consent dialog appeared, confirming...');
        await page.getByRole('checkbox').check();
        await page.getByRole('button', { name: 'Согласиться и продолжить' }).click();
        await page.waitForTimeout(2000);
        await page.screenshot({ path: path.join(OUT_DIR, 'debug-after-consent.png') });
      }

      // Wait for calculation result
      await page.waitForSelector('text=14.03.1987', { timeout: 15000 });
      await page.waitForTimeout(1000);
      await page.screenshot({ path: path.join(OUT_DIR, 'desktop-1440-code-sample-result.png') });
      console.log('Saved desktop-1440-code-sample-result.png');
      await context.close();
    }

    console.log('ALL LOCAL BROWSER CHECKS PASSED!');
  } finally {
    await browser.close();
    server.kill();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
