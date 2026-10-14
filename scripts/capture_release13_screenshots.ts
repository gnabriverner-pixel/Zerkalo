import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

const OUT_DIR = path.resolve('evidence/release-whole-path-13-2026-10-15/screenshots');
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
    COMMERCE_DATA_KEY: 'f'.repeat(64),
    PERSONAL_MYTH_EXAMPLE_URL: '/primer-lichnogo-mifa'
  };

  const server = spawn('npx', ['tsx', 'server.ts'], {
    env,
    stdio: 'pipe'
  });

  server.stdout.on('data', d => process.stdout.write('[server] ' + d));
  server.stderr.on('data', d => process.stderr.write('[server err] ' + d));

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
      console.log(`\n=== Capturing for ${vp.name} (${vp.width}x${vp.height}) ===`);
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: 2
      });

      const page = await context.newPage();

      await page.route('**/api/free-preview', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            enabled: true,
            phase: 'open',
            active: true,
            can_start_myth: true,
            new_generation_available: true,
            pause_message: '',
            support_url: null,
            started_at: Date.now() - 3600000,
            ends_at: 1793404799000, // 31.10.2026, 23:59:59
            budget_warning: false
          })
        });
      });

      await page.route('**/api/personal-myth/config', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            writer: 'v41',
            generation_available: true,
            example_url: '/primer-lichnogo-mifa'
          })
        });
      });

      // 1. Home hero
      await page.goto(`http://localhost:${port}/`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(600);
      await page.screenshot({
        path: path.join(OUT_DIR, `home-hero-${vp.name}.png`),
        fullPage: false
      });
      console.log(`Saved home-hero-${vp.name}.png`);

      // 2. Home cards
      const dateGate = page.locator('#date-gate');
      if (await dateGate.count() > 0) {
        await dateGate.scrollIntoViewIfNeeded();
      }
      await page.waitForTimeout(400);
      await page.screenshot({
        path: path.join(OUT_DIR, `home-cards-${vp.name}.png`),
        fullPage: false
      });
      console.log(`Saved home-cards-${vp.name}.png`);

      // 3. Code V2 Sample (Click «Посмотреть пример»)
      const sampleBtn = page.locator('button:has-text("Посмотреть пример")').first();
      if (await sampleBtn.count() > 0) {
        await sampleBtn.click();
        await page.waitForTimeout(1000);
        // Screenshot top of sample
        await page.screenshot({
          path: path.join(OUT_DIR, `code-sample-top-${vp.name}.png`),
          fullPage: false
        });
        console.log(`Saved code-sample-top-${vp.name}.png`);

        // Scroll to bottom (myth bridge)
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(400);
        await page.screenshot({
          path: path.join(OUT_DIR, `code-sample-bottom-${vp.name}.png`),
          fullPage: false
        });
        console.log(`Saved code-sample-bottom-${vp.name}.png`);
      }

      // 4. Myth entry
      await page.goto(`http://localhost:${port}/?mode=myth`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(600);
      await page.screenshot({
        path: path.join(OUT_DIR, `myth-entry-${vp.name}.png`),
        fullPage: false
      });
      console.log(`Saved myth-entry-${vp.name}.png`);

      // 5. Question 1
      const startMythBtn = page.locator('button:has-text("Начать Личный миф")').first();
      if (await startMythBtn.count() > 0) {
        await startMythBtn.click();
        await page.locator('text=01 / 04').waitFor({ state: 'visible' });
        await page.screenshot({
          path: path.join(OUT_DIR, `myth-q1-${vp.name}.png`),
          fullPage: false
        });
        console.log(`Saved myth-q1-${vp.name}.png`);

        // Type Q1 and press Enter
        await page.locator('textarea:visible').fill('В ситуации выбора нового творческого пути.');
        await page.waitForTimeout(200);
        await page.locator('textarea:visible').press('Enter');

        // Wait for Q2
        await page.locator('text=02 / 04').waitFor({ state: 'visible' });
        await page.locator('textarea:visible').fill('Старинный морской компас в медном корпусе.');
        await page.waitForTimeout(200);
        await page.locator('textarea:visible').press('Enter');

        // Wait for Q3
        await page.locator('text=03 / 04').waitFor({ state: 'visible' });
        await page.locator('textarea:visible').fill('Спокойной уверенности и попутного ветра.');
        await page.waitForTimeout(200);
        await page.locator('textarea:visible').press('Enter');

        // Wait for Q4 (04 / 04): DO NOT click final submit button!
        await page.locator('text=04 / 04').waitFor({ state: 'visible' });
        await page.locator('text=В какой момент вы чувствовали').first().waitFor({ state: 'visible' });
        await page.screenshot({
          path: path.join(OUT_DIR, `myth-q4-${vp.name}.png`),
          fullPage: false
        });
        console.log(`Saved myth-q4-${vp.name}.png`);
      }

      // 6. «Мои мифы» (empty state & expanded details)
      // Open library via direct trigger or button
      await page.goto(`http://localhost:${port}/`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(500);
      const myMythsBtn = page.locator('button:has-text("Мои мифы")').first();
      if (await myMythsBtn.count() > 0) {
        await myMythsBtn.click();
        await page.waitForTimeout(600);
        await page.screenshot({
          path: path.join(OUT_DIR, `library-empty-${vp.name}.png`),
          fullPage: false
        });
        console.log(`Saved library-empty-${vp.name}.png`);

        // Expand «Хранение и доступ»
        const detailsSummary = page.locator('summary:has-text("Хранение и доступ")').first();
        if (await detailsSummary.count() > 0) {
          await detailsSummary.click();
          await page.waitForTimeout(400);
          await page.screenshot({
            path: path.join(OUT_DIR, `library-details-expanded-${vp.name}.png`),
            fullPage: false
          });
          console.log(`Saved library-details-expanded-${vp.name}.png`);
        }
      }

      // 7. «Велосипед» example page
      await page.goto(`http://localhost:${port}/primer-lichnogo-mifa`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(600);
      await page.screenshot({
        path: path.join(OUT_DIR, `example-velosiped-${vp.name}.png`),
        fullPage: false
      });
      console.log(`Saved example-velosiped-${vp.name}.png`);

      await context.close();
    }

    // 8. Consent modal on real calculation (one 390px mobile capture)
    console.log('\n=== Capturing consent modal on real calculation (390px) ===');
    const consentContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2
    });
    // Ensure clean state without prior consent receipt
    const consentPage = await consentContext.newPage();
    await consentPage.goto(`http://localhost:${port}/`, { waitUntil: 'networkidle' });
    await consentPage.waitForTimeout(500);
    const dayInput = consentPage.locator('#birth-day');
    const monthInput = consentPage.locator('#birth-month');
    const yearInput = consentPage.locator('#birth-year');
    if (await dayInput.count() > 0) {
      await dayInput.fill('15');
      await monthInput.fill('08');
      await yearInput.fill('1990');
      const submit = consentPage.locator('button:has-text("Посмотреть свой разбор")').first();
      await submit.click();
      await consentPage.waitForTimeout(800);
      await consentPage.screenshot({
        path: path.join(OUT_DIR, 'consent-modal-real-calculation-390.png'),
        fullPage: false
      });
      console.log('Saved consent-modal-real-calculation-390.png');
    }
    await consentContext.close();

    console.log('\nAll screenshots captured successfully!');
  } finally {
    await browser.close();
    server.kill();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
