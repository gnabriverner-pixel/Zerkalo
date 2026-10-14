import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

const OUT_DIR = path.resolve('evidence/release-personal-myth-name-10-2026-10-14/screenshots');
fs.mkdirSync(OUT_DIR, { recursive: true });

async function main() {
  const port = 3097;
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
      { name: 'desktop-1440', width: 1440, height: 900 }
    ];

    for (const vp of viewports) {
      console.log(`\n=== Capturing for ${vp.name} (${vp.width}x${vp.height}) ===`);
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: 2
      });
      await context.addInitScript(() => {
        try {
          localStorage.setItem('zerkalo_consent_receipt', JSON.stringify({
            accepted: true,
            eventId: 'local-test-consent-event',
            timestamp: new Date().toISOString()
          }));
        } catch {}
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
            ends_at: Date.now() + 86400000 * 4,
            budget_warning: false
          })
        });
      });

      // 1. Landing (Myth card)
      await page.goto(`http://localhost:${port}/`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);
      // Scroll to show the cards
      const mythCard = page.locator('text=Личный миф').first();
      if (await mythCard.count() > 0) {
        await mythCard.scrollIntoViewIfNeeded();
      }
      await page.waitForTimeout(500);
      await page.screenshot({
        path: path.join(OUT_DIR, `1-landing-myth-card-${vp.name}.png`),
        fullPage: false
      });
      console.log(`Saved 1-landing-myth-card-${vp.name}.png`);

      // 2. Menu
      if (vp.width === 390) {
        // Open mobile additional menu details
        const summary = page.locator('summary[aria-label="Дополнительно"]').first();
        if (await summary.count() > 0) {
          await summary.click();
          await page.waitForTimeout(500);
        }
      } else {
        // Desktop: show header nav with МИФЫ and the fixed floating badge
        await page.waitForTimeout(500);
      }
      await page.screenshot({
        path: path.join(OUT_DIR, `2-header-menu-${vp.name}.png`),
        fullPage: false
      });
      console.log(`Saved 2-header-menu-${vp.name}.png`);

      // 3. Code V2 result with Albert bridge
      await page.goto(`http://localhost:${port}/`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(500);
      // Fill DOB 14.03.1987
      const inputs = page.locator('input[type="text"], input[type="tel"]');
      if (await inputs.count() >= 3) {
        await inputs.nth(0).fill('14');
        await inputs.nth(1).fill('03');
        await inputs.nth(2).fill('1987');
        const submitBtn = page.locator('button:has-text("Посмотреть свой разбор")').first();
        if (await submitBtn.count() > 0) {
          await submitBtn.click();
          await page.waitForTimeout(1000);

          const consentCheckbox = page.locator('input[type="checkbox"]').first();
          if (await consentCheckbox.isVisible().catch(() => false)) {
            await consentCheckbox.check();
            const acceptBtn = page.locator('button:has-text("Согласиться и продолжить")').first();
            if (await acceptBtn.isVisible().catch(() => false)) {
              await acceptBtn.click();
            }
          }

          // Wait for Code result bridge
          await page.waitForSelector('text=Мы посмотрели на пять сторон жизни через образы чисел', { timeout: 25000 });
          await page.waitForTimeout(1000);
          const bridge = page.locator('text=Мы посмотрели на пять сторон жизни через образы чисел').first();
          await bridge.scrollIntoViewIfNeeded();
          await page.waitForTimeout(500);
          await page.screenshot({
            path: path.join(OUT_DIR, `3-code-result-bridge-${vp.name}.png`),
            fullPage: false
          });
          console.log(`Saved 3-code-result-bridge-${vp.name}.png`);
        }
      }

      // 4. First screen of Myth with example link
      await page.goto(`http://localhost:${port}/`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(500);
      // Click "Личный миф" / "Начать Личный миф" or menu "МИФ"
      const startMythBtn = page.locator('button:has-text("Начать Личный миф")').first();
      if (await startMythBtn.count() > 0) {
        await startMythBtn.click();
      } else {
        const mythLink = page.locator('button:has-text("МИФ"), a:has-text("МИФ")').first();
        if (await mythLink.count() > 0) await mythLink.click();
      }
      await page.waitForTimeout(1000);
      await page.screenshot({
        path: path.join(OUT_DIR, `4-myth-entry-example-link-${vp.name}.png`),
        fullPage: false
      });
      console.log(`Saved 4-myth-entry-example-link-${vp.name}.png`);

      // 5. Static example page (/primer-lichnogo-mifa)
      await page.goto(`http://localhost:${port}/primer-lichnogo-mifa`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(500);
      await page.screenshot({
        path: path.join(OUT_DIR, `5-example-velosiped-page-${vp.name}.png`),
        fullPage: false
      });
      console.log(`Saved 5-example-velosiped-page-${vp.name}.png`);

      await context.close();
    }
  } finally {
    await browser.close();
    server.kill();
  }
}

main().catch(err => {
  console.error('Error during screenshot capture:', err);
  process.exit(1);
});
