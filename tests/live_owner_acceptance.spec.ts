import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const screenshotDir = path.join(__dirname, '../docs/evidence/g2-live-acceptance/screenshots');

// Helper to advance myth stepper reliably
async function answerMythQuestion(page: any, stepTag: string, text: string, isLast = false) {
  console.log(`  [Myth Stepper] Waiting for step ${stepTag}...`);
  await page.waitForSelector(`text=${stepTag}`, { timeout: 20000 });
  await page.waitForTimeout(300);

  const textarea = page.locator('textarea');
  await textarea.waitFor({ state: 'visible', timeout: 15000 });
  await textarea.fill(text);
  await page.waitForTimeout(200);

  if (isLast) {
    const submitBtn = page.locator('button:has-text("Соткать историю")').or(page.locator('button:has-text("Сплести историю")'));
    await submitBtn.first().waitFor({ state: 'visible' });
    await submitBtn.first().click();
  } else {
    const nextBtn = page.locator('button:has-text("Далее")').or(page.locator('button:has-text("Продолжить")'));
    await nextBtn.first().waitFor({ state: 'visible' });
    await nextBtn.first().click();
  }
  await page.waitForTimeout(500);
}

test.describe('G2 Live Acceptance Pass', () => {
  test('Complete End-to-End Live Journey 1 (Myth -> Code -> Meeting -> Albert) & Visual Audit', async ({ page }) => {
    test.setTimeout(180000);

    // 1. Threshold
    console.log('[Playwright] Step 1: Threshold');
    await page.goto('http://localhost:3005');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1')).toContainText('Зеркало себя');
    await page.screenshot({ path: path.join(screenshotDir, '01_threshold_live.png'), fullPage: false });

    // 2. Collection choice (Two equal gates)
    console.log('[Playwright] Step 2: Collection choice');
    const collectionSec = page.locator('#collection');
    await collectionSec.scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(screenshotDir, '02_two_lenses_choice_live.png'), fullPage: false });

    // 3. Journey 1: Open Personal Myth
    console.log('[Playwright] Step 3: Open Personal Myth');
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
    console.log('[Playwright] Step 4: Myth questions');
    await page.screenshot({ path: path.join(screenshotDir, '03_myth_questions_live.png'), fullPage: false });
    await answerMythQuestion(page, '01 / 04', 'Тяжесть в плечах, как будто несу чужой рюкзак, наполненный мокрыми камнями после долгого перехода по северным холмам.', false);
    await answerMythQuestion(page, '02 / 04', 'Старая кирпичная арка во дворе старого дома, заросшая диким виноградом и плющом, где пахнет сырой землей и осенними листьями.', false);
    await answerMythQuestion(page, '03 / 04', 'Как отец молча положил руку на плечо на перроне вокзала, когда поезд уже тронулся и гудел в тумане.', false);
    await answerMythQuestion(page, '04 / 04', 'Устойчивость, внутренняя тишина и способность стоять прямо даже на сильном холодном ветру.', true);

    // Wait for generation result
    console.log('[Playwright] Step 6: Waiting for Myth generation');
    await page.waitForSelector('article', { timeout: 90000 });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(screenshotDir, '04_myth_result_live.png'), fullPage: false });

    // Navigate to second lens (Digital Code)
    console.log('[Playwright] Step 7: Navigating to Digital Code');
    const toCodeBtn = page.locator('button:has-text("Открыть Цифровой код")').or(page.locator('button:has-text("Перейти ко второй линзе")'));
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
      const calcBtn = page.locator('button:has-text("Открыть свой код")').or(page.locator('button:has-text("Рассчитать код")'));
      await calcBtn.first().click();
    }

    // Wait for Code calculation reveal
    console.log('[Playwright] Step 8: Waiting for Code calculation reveal');
    await page.waitForSelector('text=Число души', { timeout: 30000 });
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(screenshotDir, '05_code_reveal_live.png'), fullPage: false });

    // Open Meeting of Mirrors
    console.log('[Playwright] Step 9: Opening Meeting of Mirrors');
    const toMeetingBtn = page.locator('button:has-text("Открыть Встречу зеркал")').or(page.locator('nav button:has-text("Встреча")'));
    await toMeetingBtn.first().click();
    await page.waitForTimeout(800);

    // Click Run Synthesis
    console.log('[Playwright] Step 10: Running Meeting synthesis');
    const runMeetingBtn = page.locator('button:has-text("Провести Встречу")');
    if (await runMeetingBtn.first().isVisible()) {
      await runMeetingBtn.first().click();
    }

    // Wait for synthesis result
    console.log('[Playwright] Step 11: Waiting for synthesis result');
    await page.waitForSelector('text=Итог', { timeout: 60000 });
    await page.waitForTimeout(1000);

    // Screenshot meeting state
    await page.screenshot({ path: path.join(screenshotDir, '06_meeting_resonances_live.png'), fullPage: false });

    // Open Albert Dialogue
    console.log('[Playwright] Step 12: Opening Albert Dialogue');
    const albertBtn = page.locator('button:has-text("Диалог на сайте")');
    if (await albertBtn.isVisible()) {
      await albertBtn.click();
      await page.waitForTimeout(600);
      const albertInput = page.locator('input[placeholder*="Задайте вопрос Альберту"]');
      if (await albertInput.isVisible()) {
        await albertInput.fill("Как связать образ из мифа с Числом души?");
        await albertInput.press("Enter");
        await page.waitForTimeout(1500);
      }
      await page.screenshot({ path: path.join(screenshotDir, '07_albert_dialogue_live.png'), fullPage: false });
      const closeAlbertBtn = page.locator('button:has-text("✕")').or(page.locator('button[aria-label="Закрыть диалог"]'));
      if (await closeAlbertBtn.first().isVisible()) {
        await closeAlbertBtn.first().click();
        await page.waitForTimeout(400);
      }
    }
    console.log('[Playwright] Journey 1 complete!');
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
    await page.screenshot({ path: path.join(screenshotDir, '08_route_b_code_first_live.png'), fullPage: false });

    // Continue to Myth
    const toMythBtn = page.locator('button:has-text("Перейти к Личному мифу")').or(page.locator('nav button:has-text("Миф")'));
    await toMythBtn.first().scrollIntoViewIfNeeded();
    await toMythBtn.first().click();
    await page.waitForTimeout(600);

    // Intro to Myth
    const startMythBtn = page.locator('button:has-text("Войти через образы")');
    if (await startMythBtn.isVisible()) {
      await startMythBtn.click();
      await page.waitForTimeout(500);
    }

    // Fill 4 questions
    await answerMythQuestion(page, '01 / 04', 'Развилка лесных дорог в густом сосновом бору, где между стволами стелется утренний туман и не слышно птиц.', false);
    await answerMythQuestion(page, '02 / 04', 'Старинный медный компас с треснувшим стеклом и потертой шкалой, который всегда показывает одно и то же направление.', false);
    await answerMythQuestion(page, '03 / 04', 'Запах свежей хвои, влажного мха и озона сразу после сильной грозы в предгорьях.', false);
    await answerMythQuestion(page, '04 / 04', 'Верность собственному внутреннему курсу, спокойствие и ясность в моменты принятия важных решений.', true);

    // Wait for myth result
    await page.waitForSelector('article', { timeout: 90000 });
    await page.screenshot({ path: path.join(screenshotDir, '09_route_b_myth_live.png'), fullPage: false });

    // Open Meeting of Mirrors
    const toMeetingBtn = page.locator('button:has-text("Открыть Встречу зеркал")').or(page.locator('nav button:has-text("Встреча")'));
    await toMeetingBtn.first().click();
    await page.waitForTimeout(600);

    const runMeetingBtn = page.locator('button:has-text("Провести Встречу")');
    if (await runMeetingBtn.first().isVisible()) {
      await runMeetingBtn.first().click();
    }

    // Synthesis should complete
    await page.waitForSelector('text=Итог', { timeout: 60000 });
    await page.screenshot({ path: path.join(screenshotDir, '10_route_b_meeting_live.png'), fullPage: false });
  });

  test('Crisis Intervention & Safety Interception', async ({ page }) => {
    test.setTimeout(60000);
    await page.goto('http://localhost:3005', { waitUntil: 'networkidle' });
    
    // Go to Myth
    const mythEntryCrisis = page.locator('button:has-text("Войти через образы")').or(page.locator('text=Зеркало восприятия')).or(page.locator('text=Войти через образы →')).or(page.locator('text=Сказка про вас'));
    await mythEntryCrisis.first().click();
    await page.waitForTimeout(400);

    const startMythCrisis = page.locator('button:has-text("Войти через образы")');
    if (await startMythCrisis.isVisible()) {
      await startMythCrisis.click();
      await page.waitForTimeout(500);
    }

    // Fill crisis phrase in Question 1
    await answerMythQuestion(page, '01 / 04', 'Я больше не могу терпеть и хочу умереть.', false);
    await answerMythQuestion(page, '02 / 04', 'Темнота.', false);
    await answerMythQuestion(page, '03 / 04', 'Ничего.', false);
    await answerMythQuestion(page, '04 / 04', 'Пустота.', true);

    // Wait for crisis safety message
    await page.waitForSelector('text=живая поддержка', { timeout: 15000 });
    await page.screenshot({ path: path.join(screenshotDir, '19_crisis_safety_intercept.png'), fullPage: false });
    expect(await page.locator('text=живая поддержка').isVisible()).toBeTruthy();
  });
});
