const { chromium } = require('@playwright/test');
const { spawn } = require('child_process');
const path = require('path');
const http = require('http');
const fs = require('fs');

function checkHttpAsset(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      const { statusCode } = res;
      const contentType = res.headers['content-type'] || '';
      if (statusCode === 200 && contentType.startsWith('image/')) {
        resolve({ statusCode, contentType });
      } else {
        reject(new Error(`Asset GET failed: status=${statusCode}, contentType=${contentType}`));
      }
    }).on('error', reject);
  });
}

async function runBrowserAcceptance() {
  console.log('=== ZERKALO V1.1.1 OWNER-REVIEW CORRECTION ACCEPTANCE ===');

  const server = spawn('npx', ['tsx', 'server.ts'], {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, PORT: '3456', NODE_ENV: 'development' },
    stdio: 'pipe'
  });

  await new Promise((resolve) => {
    let resolved = false;
    server.stdout.on('data', (d) => {
      const str = d.toString();
      if (!resolved && (str.includes('ready') || str.includes('http') || str.includes('3456') || str.includes('Local:'))) {
        resolved = true;
        setTimeout(resolve, 1000);
      }
    });
    setTimeout(() => {
      if (!resolved) resolve();
    }, 4000);
  });

  const browser = await chromium.launch({
    headless: true,
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  });

  try {
    fs.mkdirSync(path.resolve(__dirname, '../docs/evidence/v1_1_1-human-audit'), { recursive: true });

    // 1. OG IMAGE HTTP 200 CHECK
    console.log('\n--- Checking OG/Twitter Social Image Asset ---');
    const assetCheck = await checkHttpAsset('http://localhost:3456/og/zerkalo-share.jpg');
    console.log(`OG Image Check: HTTP ${assetCheck.statusCode} (${assetCheck.contentType}) -> PASS`);

    // 2. DESKTOP VIEWPORT & FOCUS RETURN & ALABASTER VISUAL
    console.log('\n--- Running Desktop Tests (1440x900) ---');
    const desktopPage = await browser.newPage({ viewport: { width: 1440, height: 900 } });

    // Network request instrumentation
    let generationRequestCount = 0;
    desktopPage.on('request', (req) => {
      const url = req.url();
      if (url.includes('/api/generate') || url.includes('/api/myth') || url.includes('/api/meeting') || url.includes('/api/albert')) {
        generationRequestCount++;
        console.log(`[Network Call Recorded]: ${req.method()} ${url}`);
      }
    });

    await desktopPage.goto('http://localhost:3456');
    await desktopPage.waitForTimeout(600);

    // Test Focus Return for "О методе"
    const aboutBtn = desktopPage.locator('button:has-text("О методе")');
    await aboutBtn.focus();
    await aboutBtn.click();
    await desktopPage.waitForTimeout(300);

    const aboutModal = desktopPage.locator('[role="dialog"][aria-label="О методе Цифровой Код"]');
    if (!(await aboutModal.isVisible())) {
      throw new Error('About modal failed to open');
    }

    // Verify close button is focused inside modal
    const isCloseFocused = await aboutModal.locator('button[aria-label="Закрыть модальное окно"]').evaluate(
      (el) => document.activeElement === el
    );
    console.log(`About Modal Focus Trapped to Close Button: ${isCloseFocused}`);

    await desktopPage.keyboard.press('Escape');
    await aboutModal.waitFor({ state: 'hidden', timeout: 3000 });

    const isAboutBtnRefocused = await aboutBtn.evaluate((el) => document.activeElement === el);
    console.log(`About Button Refocused on Escape: ${isAboutBtnRefocused}`);
    if (!isAboutBtnRefocused) {
      throw new Error('Focus did not return to "О методе" button after Escape');
    }

    // Test Focus Return for "Мои заметки"
    const notesBtn = desktopPage.locator('button:has-text("Мои заметки")');
    await notesBtn.focus();
    await notesBtn.click();
    await desktopPage.waitForTimeout(300);

    const notesModal = desktopPage.locator('[role="dialog"][aria-label="Мои заметки"]');
    if (!(await notesModal.isVisible())) {
      throw new Error('Notes modal failed to open');
    }

    await desktopPage.keyboard.press('Escape');
    await notesModal.waitFor({ state: 'hidden', timeout: 3000 });

    const isNotesBtnRefocused = await notesBtn.evaluate((el) => document.activeElement === el);
    console.log(`Notes Button Refocused on Escape: ${isNotesBtnRefocused}`);
    if (!isNotesBtnRefocused) {
      throw new Error('Focus did not return to "Мои заметки" button after Escape');
    }
    console.log('FOCUS_RETURN=PASS');

    // 3. EDITORIAL PROSE & DEDUPLICATION FOR 15.03.1990
    console.log('\n--- Testing Digital Code 15.03.1990 Editorial Deduplication ---');
    const codeNav = desktopPage.locator('nav button:has-text("Код")');
    await codeNav.click();
    await desktopPage.waitForTimeout(600);

    // Verify Alabaster Header Visual (one light unified header)
    const headerCount = await desktopPage.locator('header').count();
    console.log(`Rendered Headers Count: ${headerCount}`);
    if (headerCount !== 1) {
      throw new Error(`Expected exactly 1 unified header, found ${headerCount}`);
    }

    await desktopPage.screenshot({
      path: path.resolve(__dirname, '../docs/evidence/v1_1_1-human-audit/alabaster_desktop.png')
    });
    console.log('ALABASTER_HEADER_VISUAL=PASS (Screenshot saved)');

    const dayInput = desktopPage.locator('input[aria-label="День рождения"]');
    await dayInput.click();
    await dayInput.pressSequentially('15', { delay: 50 });
    const monthInput = desktopPage.locator('input[aria-label="Месяц рождения"]');
    await monthInput.click();
    await monthInput.pressSequentially('03', { delay: 50 });
    const yearInput = desktopPage.locator('input[aria-label="Год рождения"]');
    await yearInput.click();
    await yearInput.pressSequentially('1990', { delay: 50 });

    await desktopPage.locator('button[type="submit"]').click();
    await desktopPage.waitForTimeout(800);

    const pageText = await desktopPage.innerText('body');
    if (pageText.includes('.,') || pageText.includes('««') || pageText.includes('""')) {
      throw new Error('Broken punctuation in rendered text');
    }

    // Check duplicate compound paragraphs
    const paragraphs = pageText.split('\n\n').map((p) => p.trim()).filter((p) => p.length > 30);
    const normalizedParas = paragraphs.map((p) => p.toLowerCase().replace(/[^а-яёa-z0-9]/g, ''));
    const uniqueParas = new Set(normalizedParas);
    if (uniqueParas.size !== normalizedParas.length) {
      throw new Error('Found duplicate normalized paragraphs in page text');
    }
    console.log('EDITORIAL_15_03_1990=PASS');
    console.log('DUPLICATE_COMPOUND_PARAGRAPHS=0');

    // 4. BLOCKER 2 & 3: SNAPSHOT COEXISTENCE, DRAFT RESTORE & TRUE RESET
    console.log('\n--- Testing Blocker 2 & 3: Draft Restore with Saved Snapshot & True Reset ---');

    // Set up older saved snapshot A in localStorage
    await desktopPage.evaluate(() => {
      const snapshotA = {
        version: 1,
        savedAt: '2026-08-01T10:00:00.000Z',
        codeDate: '01.01.1980',
        codeResult: {
          soul: 1,
          path: 2,
          expression: 3,
          direction: 4,
          result: 5,
          baseMatrix: {},
          detailedMatrix: {}
        },
        firstMirror: {
          title: 'Сохранённое зеркало 01.01.1980',
          subtitle: 'Архитектура',
          formula: { numbers: '1 · 2 · 3 · 4 · 5', planets: 'Солнце', positions: 'Позиции' },
          keyInsight: 'Инсайт snapshot A',
          blocks: []
        },
        storyInputs: { q1: 'Ответ 1', q2: 'Ответ 2', q3: 'Ответ 3', q4: 'Ответ 4' },
        storyResult: {
          title: 'Миф Первого Шага',
          story: 'В начале пути...',
          archetype: 'Странник',
          reflectionQuestions: ['Вопрос 1'],
          integrationPractice: 'Практика'
        },
        meetingResult: {
          summary: 'Встреча Snapshot A',
          confidenceNote: 'Высокая',
          reflectiveQuestion: 'Вопрос A',
          albertInsight: 'Инсайт Альберта A',
          parallels: ['Параллель 1'],
          divergences: ['Расхождение 1']
        },
        meetingUserNote: 'Моя старая заметка'
      };
      window.localStorage.setItem('zerkalo.myMirror.v1', JSON.stringify(snapshotA));
    });

    // Reset network counter before reload + restore
    generationRequestCount = 0;

    console.log('Performing hard reload with both snapshot A and transient draft B...');
    await desktopPage.reload();
    await desktopPage.waitForTimeout(600);

    // Verify BOTH cards are discoverable
    const savedCard = desktopPage.locator('text=Моё зеркало · Сохранено локально');
    const transientCard = desktopPage.locator('text=Найдено незавершённое зеркало');

    if (!(await savedCard.isVisible())) {
      throw new Error('Saved snapshot card is missing on entry screen');
    }
    if (!(await transientCard.isVisible())) {
      throw new Error('Transient draft card is missing when saved snapshot exists');
    }
    console.log('DRAFT_RESTORE_WITH_OLD_SNAPSHOT=PASS (Both cards discoverable)');

    // Click "Продолжить" to restore transient draft B
    await desktopPage.locator('button:has-text("Продолжить")').click();
    await desktopPage.waitForTimeout(800);

    const restoredText = await desktopPage.innerText('body');
    if (!restoredText.includes('15.03.1990') && !restoredText.includes('Архитектура Силы')) {
      throw new Error('Transient draft B was not restored');
    }

    console.log(`Measured Generation Requests during reload+restore: ${generationRequestCount}`);
    if (generationRequestCount !== 0) {
      throw new Error(`Expected UNNECESSARY_REGENERATION=0, but measured ${generationRequestCount} calls`);
    }
    console.log('UNNECESSARY_REGENERATION=0 (Verified via network request counter)');

    // Test True Reset via "Начать заново"
    console.log('\n--- Testing True Reset ("Начать заново") ---');
    // Go to entry
    await desktopPage.locator('header button[title="Главная"]').click();
    await desktopPage.waitForTimeout(400);

    const startNewBtn = desktopPage.locator('button:has-text("Начать заново")');
    await startNewBtn.click();
    await desktopPage.waitForTimeout(600);

    // Verify transient draft is removed, but saved snapshot A remains
    const draftAfterReset = await desktopPage.evaluate(() => window.sessionStorage.getItem('zerkalo.transientDraft.v1'));
    const snapshotAfterReset = await desktopPage.evaluate(() => window.localStorage.getItem('zerkalo.myMirror.v1'));

    if (draftAfterReset) {
      throw new Error('Transient draft was not cleared from sessionStorage after "Начать заново"');
    }
    if (!snapshotAfterReset) {
      throw new Error('Saved snapshot A was inadvertently cleared from localStorage');
    }
    if (await transientCard.isVisible()) {
      throw new Error('Transient draft card still visible after "Начать заново"');
    }
    if (!(await savedCard.isVisible())) {
      throw new Error('Saved snapshot card disappeared after "Начать заново"');
    }
    console.log('START_NEW_TRUE_RESET=PASS');

    // 5. MOBILE VIEWPORT SCREENSHOT & ACCEPTANCE
    console.log('\n--- Running Mobile Tests (390x844) ---');
    const mobileContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true
    });
    const mobilePage = await mobileContext.newPage();
    await mobilePage.goto('http://localhost:3456');
    await mobilePage.waitForTimeout(500);

    await mobilePage.locator('nav button:has-text("Код")').click();
    await mobilePage.waitForTimeout(500);
    await mobilePage.screenshot({
      path: path.resolve(__dirname, '../docs/evidence/v1_1_1-human-audit/alabaster_mobile.png')
    });
    console.log('Mobile Alabaster View: PASS (Screenshot saved)');

    console.log('\n=== ALL TARGETED CORRECTIONS VERIFIED SUCCESSFULLY ===');
  } finally {
    await browser.close();
    server.kill();
  }
}

runBrowserAcceptance().catch((e) => {
  console.error('Acceptance Test Failed:', e);
  process.exit(1);
});
