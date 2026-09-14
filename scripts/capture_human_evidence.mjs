import { chromium } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outDir = path.resolve(__dirname, '../docs/evidence/owner-code-v2-human-experience');

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

async function ensureConsent(page) {
  try {
    const checkbox = page.locator('input[type="checkbox"]');
    if (await checkbox.isVisible({ timeout: 2500 })) {
      console.log('Consent modal visible, accepting...');
      await checkbox.check();
      await page.locator('button:has-text("Продолжить к зеркалам")').click();
      await page.waitForTimeout(500);
    }
  } catch (_e) {
    // Already accepted or not visible
  }
}

async function run() {
  const browser = await chromium.launch({
    headless: true,
    channel: 'chrome'
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });

  // 1. Clean entry desktop
  console.log('Capturing 1: clean entry desktop...');
  const page1 = await context.newPage();
  await page1.goto('http://localhost:3088/?preview=v2', { waitUntil: 'networkidle' });
  await ensureConsent(page1);
  await page1.waitForSelector('text=Ваш Цифровой Код', { timeout: 15000 });
  await page1.waitForTimeout(500);
  const path1 = path.join(outDir, '01_clean_entry_desktop.png');
  await page1.screenshot({ path: path1, fullPage: false });
  await page1.close();

  // 2. 06.05.1986 first meaningful screen
  console.log('Capturing 2: 06.05.1986 first meaningful screen...');
  const page2 = await context.newPage();
  await page2.goto('http://localhost:3088/?preview=v2&dob=06.05.1986', { waitUntil: 'networkidle' });
  await ensureConsent(page2);
  await page2.waitForSelector('text=Пять позиций вашей карты', { timeout: 15000 });
  await page2.waitForTimeout(800);
  const path2 = path.join(outDir, '02_06_05_1986_first_meaningful_screen.png');
  await page2.screenshot({ path: path2, fullPage: false });

  // 3. Middle of five-position journey
  console.log('Capturing 3: middle of five-position journey...');
  await page2.evaluate(() => {
    const el = document.querySelector('section.space-y-6');
    if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
  });
  await page2.waitForTimeout(600);
  const path3 = path.join(outDir, '03_five_position_journey.png');
  await page2.screenshot({ path: path3, fullPage: false });

  // 4. Albert invitation
  console.log('Capturing 4: Albert invitation...');
  const albertSec = page2.locator('text=Альберт — собеседник по вашей карте');
  await albertSec.scrollIntoViewIfNeeded();
  await page2.waitForTimeout(600);
  const path4 = path.join(outDir, '04_albert_invitation.png');
  await page2.screenshot({ path: path4, fullPage: false });
  await page2.close();

  // 5. Mobile first meaningful screen
  console.log('Capturing 5: mobile first meaningful screen...');
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true
  });
  const page3 = await mobileContext.newPage();
  await page3.goto('http://localhost:3088/?preview=v2&dob=06.05.1986', { waitUntil: 'networkidle' });
  await ensureConsent(page3);
  await page3.waitForSelector('text=Пять позиций вашей карты', { timeout: 15000 });
  await page3.waitForTimeout(800);
  const path5 = path.join(outDir, '05_mobile_first_meaningful_screen.png');
  await page3.screenshot({ path: path5, fullPage: false });
  await page3.close();
  await mobileContext.close();

  await context.close();
  await browser.close();
  console.log('Evidence capture complete! All 5 screenshots saved.');
}

run().catch(err => {
  console.error('Evidence capture failed:', err);
  process.exit(1);
});
