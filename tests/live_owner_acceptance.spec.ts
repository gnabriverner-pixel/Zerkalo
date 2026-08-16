import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const screenshotDir = path.resolve(__dirname, '../docs/evidence/g2-owner-acceptance/screenshots');
fs.mkdirSync(screenshotDir, { recursive: true });

test.use({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});

test.describe('G2 Live Acceptance Pass', () => {
  test('Complete End-to-End Live Journey 1 (Myth -> Code -> Meeting -> Albert) & Visual Audit', async ({ page }) => {
    test.setTimeout(180000);

    // 1. Threshold
    await page.goto('http://localhost:3005');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1')).toContainText('Зеркало себя');
    await page.screenshot({ path: path.join(screenshotDir, '01_threshold.png'), fullPage: false });

    // 2. Collection choice (Two equal gates)
    const collectionSec = page.locator('#collection');
    await collectionSec.scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(screenshotDir, '02_two_lenses_choice.png'), fullPage: false });

    // 3. Journey 1: Open Personal Myth
    const mythCard = page.locator('text=Сказка про вас').first();
    await mythCard.click();
    await page.waitForTimeout(500);

    // Intro to Myth
    const startMythBtn = page.locator('button:has-text("Войти через образы")');
    if (await startMythBtn.isVisible()) {
      await startMythBtn.click();
      await page.waitForTimeout(500);
    }

    // Question 1
    await expect(page.locator('text=01 / 04')).toBeVisible();
    await page.locator('textarea').fill('Тяжесть в плечах, как будто несу чужой рюкзак.');
    await page.screenshot({ path: path.join(screenshotDir, '03_myth_questions.png'), fullPage: false });
    await page.locator('button:has-text("Дальше")').click();
    await page.waitForTimeout(400);

    // Question 2
    await expect(page.locator('text=02 / 04')).toBeVisible();
    await page.locator('textarea').fill('Старая кирпичная арка во дворе, заросшая плющом.');
    await page.locator('button:has-text("Дальше")').click();
    await page.waitForTimeout(400);

    // Question 3
    await expect(page.locator('text=03 / 04')).toBeVisible();
    await page.locator('textarea').fill('Как отец молча положил руку на плечо, когда я не поступил.');
    await page.locator('button:has-text("Дальше")').click();
    await page.waitForTimeout(400);

    // Question 4
    await expect(page.locator('text=04 / 04')).toBeVisible();
    await page.locator('textarea').fill('Устойчивость.');
    
    // Generate Myth (calls DeepSeek)
    const generateBtn = page.locator('button:has-text("Собрать сказку")');
    await generateBtn.click();

    // Wait for generation result
    await page.waitForSelector('text=История', { timeout: 90000 });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(screenshotDir, '04_myth_result.png'), fullPage: false });

    // Navigate to second lens (Digital Code)
    const toCodeBtn = page.locator('button:has-text("Перейти ко второй линзе")').or(page.locator('button:has-text("Перейти к Цифровому Коду")')).or(page.locator('nav button:has-text("Код")'));
    await toCodeBtn.first().click();
    await page.waitForTimeout(800);

    // Enter Date in Alabaster Sanctuary
    const dayInput = page.locator('input[placeholder="ДД"]');
    const monthInput = page.locator('input[placeholder="ММ"]');
    const yearInput = page.locator('input[placeholder="ГГГГ"]');

    if (await dayInput.isVisible()) {
      await dayInput.fill('15');
      await monthInput.fill('08');
      await yearInput.fill('1990');
      const calcBtn = page.locator('button:has-text("Рассчитать код")').or(page.locator('button:has-text("Рассчитать карту")')).or(page.locator('button:has-text("Войти в святилище")'));
      await calcBtn.first().click();
    }

    // Wait for Code calculation reveal
    await page.waitForSelector('text=Число души', { timeout: 30000 });
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(screenshotDir, '05_code_reveal.png'), fullPage: false });

    // Open Meeting of Mirrors
    const toMeetingBtn = page.locator('button:has-text("Открыть Встречу зеркал")').or(page.locator('nav button:has-text("Встреча")'));
    await toMeetingBtn.first().click();
    await page.waitForTimeout(800);

    // Click Run Synthesis
    const runMeetingBtn = page.locator('button:has-text("Запустить Встречу Зеркал")').or(page.locator('button:has-text("Провести встречу")'));
    if (await runMeetingBtn.isVisible()) {
      await runMeetingBtn.click();
    }

    // Wait for synthesis result
    await page.waitForSelector('text=Сходство').or(page.locator('text=Расхождение')).or(page.locator('text=В этой встрече')).first().waitFor({ timeout: 60000 });
    await page.waitForTimeout(1000);

    // Screenshot meeting state
    await page.screenshot({ path: path.join(screenshotDir, '06_meeting_resonances.png'), fullPage: false });

    // Scroll to reflective question & divergences
    const albertPromptArea = page.locator('text=Вопрос для дневника').or(page.locator('text=Продолжить разговор с Альбертом')).or(page.locator('text=Расхождение'));
    await albertPromptArea.first().scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(screenshotDir, '07_meeting_divergence_zero.png'), fullPage: false });

    // Open Albert Dialogue
    const albertBtn = page.locator('button:has-text("Продолжить разговор с Альбертом")');
    if (await albertBtn.isVisible()) {
      await albertBtn.click();
      await page.waitForTimeout(600);
      await page.screenshot({ path: path.join(screenshotDir, '08_albert_transition.png'), fullPage: false });
    }
  });

  test('Journey 2 (Reverse Order: Code -> Myth -> Meeting)', async ({ page }) => {
    test.setTimeout(180000);

    await page.goto('http://localhost:3005');
    await page.waitForLoadState('networkidle');

    // Enter date on homepage
    const dayInput = page.locator('input[placeholder="ДД"]');
    const monthInput = page.locator('input[placeholder="ММ"]');
    const yearInput = page.locator('input[placeholder="ГГГГ"]');

    await dayInput.fill('06');
    await monthInput.fill('05');
    await yearInput.fill('1986');
    await page.locator('button:has-text("Рассчитать код")').click();

    // Verify Alabaster Code Room opens
    await page.waitForSelector('text=Число души', { timeout: 30000 });
    expect(await page.locator('text=Число души').isVisible()).toBeTruthy();

    // Continue to Myth
    const toMythBtn = page.locator('button:has-text("Перейти к Личному мифу")');
    await toMythBtn.click();
    await page.waitForTimeout(600);

    // Intro to Myth
    const startMythBtn = page.locator('button:has-text("Войти через образы")');
    if (await startMythBtn.isVisible()) {
      await startMythBtn.click();
    }

    // Fill 4 questions
    await page.locator('textarea').fill('Ощущение, что застрял в цикле повторяющихся задач.');
    await page.locator('button:has-text("Дальше")').click();
    await page.locator('textarea').fill('Часовой механизм с выпавшей шестерёнкой.');
    await page.locator('button:has-text("Дальше")').click();
    await page.locator('textarea').fill('Ночной костёр в горах, когда вокруг была полная тишина.');
    await page.locator('button:has-text("Дальше")').click();
    await page.locator('textarea').fill('Ясность приоритетов.');
    await page.locator('button:has-text("Собрать сказку")').click();

    // Wait for myth result
    await page.waitForSelector('text=История', { timeout: 90000 });

    // Open Meeting of Mirrors
    const toMeetingBtn = page.locator('button:has-text("Открыть Встречу зеркал")').or(page.locator('nav button:has-text("Встреча")'));
    await toMeetingBtn.first().click();
    await page.waitForTimeout(600);

    const runMeetingBtn = page.locator('button:has-text("Запустить Встречу Зеркал")');
    if (await runMeetingBtn.isVisible()) {
      await runMeetingBtn.click();
    }

    // Synthesis should complete
    await page.waitForSelector('text=Сходство').or(page.locator('text=Расхождение')).or(page.locator('text=В этой встрече')).first().waitFor({ timeout: 60000 });
    expect(await page.locator('text=Встреча двух отражений').isVisible()).toBeTruthy();
  });

  test('Crisis Intervention & Error Handling', async ({ page }) => {
    test.setTimeout(60000);
    await page.goto('http://localhost:3005');
    
    // Go to Myth
    await page.locator('nav button:has-text("Миф")').click();
    const startMythBtn = page.locator('button:has-text("Войти через образы")');
    if (await startMythBtn.isVisible()) {
      await startMythBtn.click();
    }

    // Fill crisis phrase in Question 1
    await page.locator('textarea').fill('Я хочу умереть и покончить с собой.');
    await page.locator('button:has-text("Дальше")').click();
    await page.locator('textarea').fill('Темнота.');
    await page.locator('button:has-text("Дальше")').click();
    await page.locator('textarea').fill('Ничего.');
    await page.locator('button:has-text("Дальше")').click();
    await page.locator('textarea').fill('Пустота.');
    await page.locator('button:has-text("Собрать сказку")').click();

    // Wait for crisis safety message
    await page.waitForSelector('text=живая поддержка', { timeout: 15000 });
    await page.screenshot({ path: path.join(screenshotDir, '09_provider_failure.png'), fullPage: false });
    expect(await page.locator('text=живая поддержка').isVisible()).toBeTruthy();
  });
});
