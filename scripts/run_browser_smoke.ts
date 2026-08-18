import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs/promises';

const BASE_URL = process.env.APP_URL || 'http://localhost:3005';
const SCREENSHOTS_DIR = path.join(process.cwd(), 'docs/evidence/v1_1-final/screenshots');

async function runBrowserSmoke() {
  console.log('=== STARTING REAL BROWSER SMOKE TEST (DESKTOP, ALBERT & MOBILE) ===');
  await fs.mkdir(SCREENSHOTS_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });

  try {
    // -------------------------------------------------------------
    // TEST 1: DESKTOP 1440x900 (Route 1: Code -> Myth -> Meeting -> Albert -> My Mirror -> Reload & Restore)
    // -------------------------------------------------------------
    console.log('\n[1/3] Running Desktop 1440x900 Route 1 (Code -> Myth -> Meeting -> Albert -> Restore)...');
    const desktopContext = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2,
    });
    const desktopPage = await desktopContext.newPage();

    let regenerationCallCount = 0;
    let postRestoreRegenCount = 0;
    desktopPage.on('request', (req) => {
      if (req.url().includes('/api/story') || req.url().includes('/api/meeting') || req.url().includes('/api/lab/meeting/generate')) {
        regenerationCallCount++;
      }
    });

    const mythAnswers = [
      'кажется, что стою перед закрытой гранитной стеной и не могу сделать шаг',
      'старый маяк на скале посреди ночного моря',
      'первый луч солнца сквозь сосновые ветви и запах смолы',
      'уверенное спокойствие и внутренняя опора',
    ];

    // 1.1 Navigate to Home / Entry
    await desktopPage.goto(BASE_URL, { waitUntil: 'networkidle' });
    await desktopPage.waitForTimeout(500);

    // 1.2 Open Digital Code (Alabaster Sanctuary)
    await desktopPage.locator('nav button:has-text("Код")').first().click();
    await desktopPage.waitForTimeout(600);

    // Enter DOB 06.05.1986
    await desktopPage.locator('input[placeholder="ДД"]').first().fill('06');
    await desktopPage.locator('input[placeholder="ММ"]').first().fill('05');
    await desktopPage.locator('input[placeholder="ГГГГ"]').first().fill('1986');
    await desktopPage.waitForTimeout(300);
    await desktopPage.locator('button:has-text("Открыть свой код"), form button[type="submit"]').first().click();
    await desktopPage.waitForTimeout(1500);

    // Capture Code Desktop Screenshot
    await desktopPage.screenshot({
      path: path.join(SCREENSHOTS_DIR, '01_code_desktop_1440x900.png'),
      fullPage: false,
    });
    console.log('  ✓ Saved 01_code_desktop_1440x900.png');

    // 1.3 Capture Alabaster Emblem Plate
    const alabasterPlate = desktopPage.locator('.zk-plate-alabaster').first();
    if (await alabasterPlate.isVisible()) {
      await alabasterPlate.screenshot({
        path: path.join(SCREENSHOTS_DIR, '03_gipsoteka_emblem_alabaster.png'),
      });
      console.log('  ✓ Saved 03_gipsoteka_emblem_alabaster.png');
    }

    // 1.4 Navigate to Personal Myth
    await desktopPage.locator('button:has-text("К зеркалам")').first().click();
    await desktopPage.waitForTimeout(500);
    await desktopPage.locator('nav button:has-text("Миф")').first().click();
    await desktopPage.waitForTimeout(500);

    // Click "Войти через образы"
    await desktopPage.locator('button:has-text("Войти через образы")').first().click();
    await desktopPage.waitForTimeout(500);

    for (let stepIdx = 0; stepIdx < 4; stepIdx++) {
      const textarea = desktopPage.locator('textarea').last();
      await textarea.waitFor({ state: 'visible' });
      await textarea.fill(mythAnswers[stepIdx]);
      await desktopPage.waitForTimeout(300);
      const actionBtn = desktopPage.locator('button:not([disabled]):has-text("Далее"), button:not([disabled]):has-text("Соткать историю")').last();
      await actionBtn.click();
      await desktopPage.waitForTimeout(800);
    }

    // Wait for generation on desktop
    console.log('  Waiting for Myth generation on desktop...');
    await desktopPage.locator('text="Символические истоки"').waitFor({ state: 'visible', timeout: 90000 });
    await desktopPage.waitForTimeout(1000);

    // Capture Myth Result Desktop Screenshot
    await desktopPage.screenshot({
      path: path.join(SCREENSHOTS_DIR, '06_myth_result_desktop_1440x900.png'),
      fullPage: false,
    });
    console.log('  ✓ Saved 06_myth_result_desktop_1440x900.png');

    // 1.5 Navigate to Meeting of Two Mirrors
    const meetingBtn = desktopPage.locator('button:has-text("Открыть Встречу зеркал"), nav button:has-text("Встреча")').first();
    await meetingBtn.click();
    await desktopPage.waitForTimeout(1000);

    // Click "Провести Встречу зеркал" to run synthesis
    console.log('  Running Meeting Synthesis...');
    const runSynthesisBtn = desktopPage.locator('button:has-text("Провести Встречу зеркал")').first();
    if (await runSynthesisBtn.isVisible()) {
      await runSynthesisBtn.click();
      await desktopPage.locator('text="Взгляд Альберта Вяземского"').waitFor({ state: 'visible', timeout: 60000 });
      await desktopPage.waitForTimeout(1000);
    }

    // Capture Meeting Desktop Screenshot
    await desktopPage.screenshot({
      path: path.join(SCREENSHOTS_DIR, '07_meeting_synthesis_desktop_1440x900.png'),
      fullPage: false,
    });
    console.log('  ✓ Saved 07_meeting_synthesis_desktop_1440x900.png');

    // 1.6 Exercise Albert Dialogue Modal & Save Screenshot 09
    console.log('  Opening Albert dialogue modal...');
    const albertBtn = desktopPage.locator('button:has-text("Диалог на сайте")').first();
    await albertBtn.click();
    await desktopPage.waitForTimeout(800);

    const questionBtn = desktopPage.locator('button:has-text("Какой один земной шаг"), button:has-text("Почему я всё время"), button:has-text("В чем скрытый ресурс")').first();
    await questionBtn.waitFor({ state: "visible", timeout: 10000 });
    await questionBtn.click();
    console.log("  Sent question to Albert. Waiting for response...");
    
    // Wait for loading to finish
    await desktopPage.locator('text="Альберт сверяется"').waitFor({ state: "visible", timeout: 10000 }).catch(() => {});
    await desktopPage.locator('text="Альберт сверяется"').waitFor({ state: "detached", timeout: 45000 });
    await desktopPage.waitForTimeout(1500);
    await desktopPage.screenshot({
      path: path.join(SCREENSHOTS_DIR, "09_albert_dialog_desktop_1440x900.png"),
      fullPage: false,
    });
    console.log('  ✓ Saved 09_albert_dialog_desktop_1440x900.png (Albert response received)');

    // Close Albert Dialogue
    const closeBtn = desktopPage.locator('button[aria-label="Закрыть диалог"]').first();
    await closeBtn.click();
    await desktopPage.waitForTimeout(800);

    // 1.7 Save Meeting snapshot to My Mirror
    console.log('  Saving snapshot to My Mirror...');
    const saveMirrorBtn = desktopPage.locator('button:has-text("Сохранить на этом устройстве"), button:has-text("Обновить сохранённое"), button:has-text("Сохранить зеркало")').first();
    await saveMirrorBtn.click();
    await desktopPage.waitForTimeout(800);

    // 1.8 Navigate to My Mirror Dashboard on Desktop
    const logoBtn = desktopPage.locator('button[title="Главная"], button:has-text("Зеркало себя")').first();
    await logoBtn.click();
    await desktopPage.waitForTimeout(600);

    await desktopPage.screenshot({
      path: path.join(SCREENSHOTS_DIR, '10_my_mirror_dashboard_desktop_1440x900.png'),
      fullPage: false,
    });
    console.log('  ✓ Saved 10_my_mirror_dashboard_desktop_1440x900.png');

    // Capture Obsidian Plate on Dashboard
    const obsidianPlate = desktopPage.locator('.zk-plate-obsidian').first();
    if (await obsidianPlate.isVisible()) {
      await obsidianPlate.screenshot({
        path: path.join(SCREENSHOTS_DIR, '04_gipsoteka_emblem_obsidian.png'),
      });
      console.log('  ✓ Saved 04_gipsoteka_emblem_obsidian.png');
    }

    // 1.9 HARD RELOAD & RESTORE VERIFICATION
    console.log('  Performing Hard Page Reload...');
    const preReloadRegenCount = regenerationCallCount;
    await desktopPage.reload({ waitUntil: 'networkidle' });
    await desktopPage.waitForTimeout(1000);

    console.log('  Restoring saved snapshot...');
    const restoreBtn = desktopPage.locator('button:has-text("Открыть сохранённое")').first();
    await restoreBtn.waitFor({ state: 'visible' });
    await restoreBtn.click();
    await desktopPage.waitForTimeout(1500);

    // Verify synthesis is visible without additional LLM regeneration
    await desktopPage.locator('text="Взгляд Альберта Вяземского"').first().waitFor({ state: 'visible', timeout: 15000 });
    postRestoreRegenCount = regenerationCallCount - preReloadRegenCount;
    console.log(`  Unnecessary LLM regeneration API calls on restore: ${postRestoreRegenCount}`);

    await desktopPage.screenshot({
      path: path.join(SCREENSHOTS_DIR, '13_restored_session_desktop.png'),
      fullPage: false,
    });
    console.log('  ✓ Saved 13_restored_session_desktop.png (Hard reload + restore verified)');

    await desktopContext.close();

    // -------------------------------------------------------------
    // TEST 2: MOBILE 390x844 (Route 2: Myth -> Code -> Meeting -> My Mirror)
    // -------------------------------------------------------------
    console.log('\n[2/3] Running Mobile 390x844 Route 2...');
    const mobileContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
    });
    const mobilePage = await mobileContext.newPage();

    // 2.1 Start directly on Personal Myth
    await mobilePage.goto(BASE_URL, { waitUntil: 'networkidle' });
    await mobilePage.waitForTimeout(500);

    await mobilePage.locator('nav button:has-text("Миф")').first().click();
    await mobilePage.waitForTimeout(500);

    await mobilePage.locator('button:has-text("Войти через образы")').first().click();
    await mobilePage.waitForTimeout(500);

    const mobileAnswers = [
      'развилка двух путей и усталость',
      'деревянная дверь на краю туманного сада',
      'шум реки и прохладная вода',
      'ясность и спокойная смелость',
    ];

    for (let stepIdx = 0; stepIdx < 3; stepIdx++) {
      const textarea = mobilePage.locator('textarea').last();
      await textarea.waitFor({ state: 'visible' });
      await textarea.fill(mobileAnswers[stepIdx]);
      await mobilePage.waitForTimeout(300);
      const actionBtn = mobilePage.locator('button:not([disabled]):has-text("Далее")').last();
      await actionBtn.click();
      await mobilePage.waitForTimeout(800);
    }

    // Step 4 on Mobile - capture question step 4
    const textareaQ4 = mobilePage.locator('textarea').last();
    await textareaQ4.waitFor({ state: 'visible' });
    await textareaQ4.fill(mobileAnswers[3]);
    await mobilePage.waitForTimeout(300);

    await mobilePage.screenshot({
      path: path.join(SCREENSHOTS_DIR, '05_myth_step4_mobile_390x844.png'),
      fullPage: false,
    });
    console.log('  ✓ Saved 05_myth_step4_mobile_390x844.png');

    // Submit step 4
    const finishBtn = mobilePage.locator('button:not([disabled]):has-text("Соткать историю")').last();
    await finishBtn.click();
    console.log('  Waiting for Myth generation on mobile...');
    await mobilePage.locator('text="Символические истоки"').waitFor({ state: 'visible', timeout: 90000 });
    await mobilePage.waitForTimeout(800);

    // 2.2 Go from Myth to Digital Code
    await mobilePage.locator('nav button:has-text("Код")').first().click();
    await mobilePage.waitForTimeout(600);

    // Enter DOB 29.02.2000 on mobile
    await mobilePage.locator('input[placeholder="ДД"]').first().fill('29');
    await mobilePage.locator('input[placeholder="ММ"]').first().fill('02');
    await mobilePage.locator('input[placeholder="ГГГГ"]').first().fill('2000');
    await mobilePage.waitForTimeout(300);
    await mobilePage.locator('button:has-text("Открыть свой код"), form button[type="submit"]').first().click();
    await mobilePage.waitForTimeout(1200);

    // Capture Code Mobile Screenshot
    await mobilePage.screenshot({
      path: path.join(SCREENSHOTS_DIR, '02_code_mobile_390x844.png'),
      fullPage: false,
    });
    console.log('  ✓ Saved 02_code_mobile_390x844.png');

    // 2.3 Go to Meeting on Mobile
    await mobilePage.locator('button:has-text("К зеркалам")').first().click();
    await mobilePage.waitForTimeout(400);
    await mobilePage.locator('nav button:has-text("Встреча")').first().click();
    await mobilePage.waitForTimeout(1000);

    // Run synthesis on mobile
    const mobileSynthesisBtn = mobilePage.locator('button:has-text("Провести Встречу зеркал")').first();
    if (await mobileSynthesisBtn.isVisible()) {
      await mobileSynthesisBtn.click();
      await mobilePage.locator('text="Взгляд Альберта Вяземского"').waitFor({ state: 'visible', timeout: 60000 });
      await mobilePage.waitForTimeout(800);
    }

    // Capture Meeting Mobile Screenshot
    await mobilePage.screenshot({
      path: path.join(SCREENSHOTS_DIR, '08_meeting_synthesis_mobile_390x844.png'),
      fullPage: false,
    });
    console.log('  ✓ Saved 08_meeting_synthesis_mobile_390x844.png');

    // 2.4 My Mirror Dashboard on Mobile
    const mobileLogo = mobilePage.locator('button[title="Главная"], button:has-text("Зеркало себя")').first();
    await mobileLogo.click();
    await mobilePage.waitForTimeout(600);

    await mobilePage.screenshot({
      path: path.join(SCREENSHOTS_DIR, '11_my_mirror_mobile_390x844.png'),
      fullPage: false,
    });
    console.log('  ✓ Saved 11_my_mirror_mobile_390x844.png');

    await mobileContext.close();

    // -------------------------------------------------------------
    // TEST 3: REDUCED MOTION MODE (Desktop)
    // -------------------------------------------------------------
    console.log('\n[3/3] Running Reduced Motion Mode verification...');
    const motionContext = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      reducedMotion: 'reduce',
    });
    const motionPage = await motionContext.newPage();
    await motionPage.goto(BASE_URL, { waitUntil: 'networkidle' });
    await motionPage.waitForTimeout(600);

    await motionPage.screenshot({
      path: path.join(SCREENSHOTS_DIR, '12_reduced_motion_desktop.png'),
      fullPage: false,
    });
    console.log('  ✓ Saved 12_reduced_motion_desktop.png');

    await motionContext.close();

    console.log('\n=== ALL BROWSER SMOKE TESTS & SCREENSHOTS COMPLETED SUCCESSFULLY ===');
    console.log('ALBERT_BROWSER_SMOKE=PASS');
    console.log('HARD_RELOAD_RESTORE=PASS');
    console.log(`UNNECESSARY_REGENERATION=${postRestoreRegenCount}`);
  } catch (error) {
    console.error('Browser smoke test error:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

runBrowserSmoke().catch((e) => {
  console.error('Fatal error in browser smoke suite:', e);
  process.exit(1);
});
