import { chromium } from 'playwright';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

const PORT = 3088;
const DCS_ROOT = '/Users/artemkrysin/Documents/New project/digital-code-product-journey';
const SCREENSHOT_DIR = path.resolve('docs/screenshots');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function waitForServer(url, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status === 404) return true;
    } catch (_) {}
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error(`Server did not respond at ${url} within ${timeoutMs}ms`);
}

async function run() {
  console.log('--- Starting server on port', PORT, '---');
  const serverProcess = spawn('npx', ['tsx', 'server.ts'], {
    env: {
      ...process.env,
      PORT: String(PORT),
      DCS_ROOT,
      PYTHONPATH: DCS_ROOT,
      NODE_ENV: 'development',
    },
    stdio: 'pipe',
  });

  serverProcess.stdout.on('data', d => {
    const s = d.toString();
    if (s.includes('Listening') || s.includes('http')) console.log('[server]', s.trim());
  });

  try {
    await waitForServer(`http://localhost:${PORT}/health`);
    console.log('Server is healthy and listening!');

    const browser = await chromium.launch({
      executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      headless: true,
    });

    // 1. Desktop: Clean entry experience (normal user preview)
    console.log('--- 1. Testing Clean Desktop Viewport (/?preview=v2) ---');
    const desktopContext = await browser.newContext({
      viewport: { width: 1280, height: 900 },
    });
    const page = await desktopContext.newPage();
    page.on('console', msg => console.log('[browser console]', msg.type(), msg.text()));
    page.on('pageerror', err => console.error('[browser error]', err));

    async function passConsentIfPresent(p) {
      const cb = p.locator('input[type="checkbox"]');
      if (await cb.isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log('Consent boundary detected, accepting...');
        await cb.check();
        await p.locator('button:has-text("Продолжить к зеркалам")').click();
        await p.waitForTimeout(1000);
      }
    }

    await page.goto(`http://localhost:${PORT}/?preview=v2`, { waitUntil: 'networkidle' });
    console.log('Loaded http://localhost:3088/?preview=v2');
    await passConsentIfPresent(page);

    // Verify title and clean orientation entry
    const title = await page.title();
    console.log('Page Title:', title);
    await page.waitForSelector('text=Карта Цифрового Кода', { timeout: 10000 });
    await page.waitForSelector('button:has-text("Рассчитать")', { timeout: 10000 });

    // Capture clean preview desktop screenshot
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'desktop_preview_v2_clean.png'),
      fullPage: true,
    });
    console.log('Saved desktop_preview_v2_clean.png');

    // 2. Mobile: Clean entry experience (iPhone 14 viewport 390x844)
    console.log('--- 2. Testing Clean Mobile Viewport (/?preview=v2) ---');
    const mobileContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1',
      isMobile: true,
      hasTouch: true,
    });
    const mobilePage = await mobileContext.newPage();
    await mobilePage.goto(`http://localhost:${PORT}/?preview=v2`, { waitUntil: 'networkidle' });
    await passConsentIfPresent(mobilePage);
    await mobilePage.waitForSelector('text=Карта Цифрового Кода', { timeout: 10000 });

    await mobilePage.screenshot({
      path: path.join(SCREENSHOT_DIR, 'mobile_preview_v2_clean.png'),
      fullPage: true,
    });
    console.log('Saved mobile_preview_v2_clean.png');

    // 3. Desktop: Owner acceptance map (06.05.1986)
    console.log('--- 3. Testing Owner DOB 06.05.1986 (/?preview=v2&dob=06.05.1986) ---');
    await page.goto(`http://localhost:${PORT}/?preview=v2&dob=06.05.1986`, { waitUntil: 'networkidle' });
    await passConsentIfPresent(page);
    await page.waitForSelector('text=Как устроен ваш Цифровой Код', { timeout: 15000 });
    console.log('06.05.1986 rendered: Orientation & 5 Numbers active!');

    // Test expanding arithmetic chain
    const calcButton = page.locator('text=Откуда взялись эти числа?');
    if (await calcButton.isVisible()) {
      await calcButton.click();
      await page.waitForSelector('text=Пошаговая прозрачная цепочка вычислений');
      console.log('Arithmetic chain expanded successfully!');
    }

    // Capture full desktop screenshot for 06.05.1986
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'desktop_code_v2_06_05_1986.png'),
      fullPage: true,
    });
    console.log('Saved desktop_code_v2_06_05_1986.png');

    // Test expanding life scenes
    const sceneButton = page.locator('button:has-text("Показать ситуации в жизни")').first();
    if (await sceneButton.isVisible()) {
      await sceneButton.click();
      await page.waitForTimeout(300);
      console.log('Expanded position life scenes!');
    }

    // Test opening Albert dialogue
    const albertButton = page.locator('button:has-text("Поговорить с Альбертом о моей карте")');
    await albertButton.scrollIntoViewIfNeeded();
    await albertButton.click();
    await page.waitForSelector('text=Альберт Вяземский', { timeout: 5000 });
    console.log('Albert dialogue modal opened!');

    await page.waitForTimeout(500);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'desktop_albert_dialogue.png'),
    });
    console.log('Saved desktop_albert_dialogue.png');

    // Close Albert modal
    const closeBtn = page.locator('button[aria-label="Закрыть диалог"]');
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
      await page.waitForTimeout(300);
    }

    // Mobile: Owner acceptance map (06.05.1986)
    console.log('--- 4. Testing Mobile Owner DOB 06.05.1986 ---');
    await mobilePage.goto(`http://localhost:${PORT}/?preview=v2&dob=06.05.1986`, { waitUntil: 'networkidle' });
    await passConsentIfPresent(mobilePage);
    await mobilePage.waitForSelector('text=Как устроен ваш Цифровой Код', { timeout: 15000 });
    await mobilePage.screenshot({
      path: path.join(SCREENSHOT_DIR, 'mobile_code_v2_06_05_1986.png'),
      fullPage: true,
    });
    console.log('Saved mobile_code_v2_06_05_1986.png');

    // 4. Desktop: Out-of-sample validation date (19.08.1991)
    console.log('--- 5. Testing Out-of-Sample Date 19.08.1991 ---');
    await page.goto(`http://localhost:${PORT}/?preview=v2&dob=19.08.1991`, { waitUntil: 'networkidle' });
    await passConsentIfPresent(page);
    await page.waitForSelector('text=Как устроен ваш Цифровой Код', { timeout: 15000 });
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'desktop_code_v2_out_of_sample_19_08_1991.png'),
      fullPage: true,
    });
    console.log('Saved desktop_code_v2_out_of_sample_19_08_1991.png');

    // 5. QA Mode Presets verification (/?preview=v2&qa=1)
    console.log('--- 6. Testing QA Mode Presets (/?preview=v2&qa=1) ---');
    await page.goto(`http://localhost:${PORT}/?preview=v2&qa=1`, { waitUntil: 'networkidle' });
    await passConsentIfPresent(page);
    await page.waitForSelector('text=Контрольные даты для проверки', { timeout: 10000 });

    const presets = ['06.05.1986', '06.09.1991', '18.12.1989', '01.10.1990'];
    for (const dob of presets) {
      console.log(`--- Testing Preset ${dob} ---`);
      const presetBtn = page.locator(`button:has-text("${dob}")`);
      await presetBtn.click();
      await page.waitForSelector(`text=(${dob})`, { timeout: 10000 });
      console.log(`Preset ${dob} loaded and calculated!`);
    }

    await browser.close();
    console.log('--- All browser tests & screenshots completed successfully! ---');
  } finally {
    serverProcess.kill('SIGTERM');
  }
}

run().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
