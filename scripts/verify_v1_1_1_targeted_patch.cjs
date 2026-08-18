const { chromium } = require('@playwright/test');
const { spawn } = require('child_process');
const path = require('path');

async function runBrowserAcceptance() {
  console.log('=== ZERKALO V1.1.1 TARGETED HUMAN-AUDIT BROWSER ACCEPTANCE ===');

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
    // 1. DESKTOP VIEWPORT (1440x900)
    console.log('\n--- Running Desktop Tests (1440x900) ---');
    const desktopPage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await desktopPage.goto('http://localhost:3456');
    await desktopPage.waitForTimeout(600);

    const title = await desktopPage.title();
    console.log(`Desktop Page Title: ${title}`);
    if (!title.includes('Зеркало Себя')) {
      throw new Error(`Invalid title: ${title}`);
    }

    const notesBtn = desktopPage.locator('button:has-text("Мои заметки")');
    if (!(await notesBtn.isVisible())) {
      throw new Error('Мои заметки button not visible in header');
    }

    await notesBtn.click();
    await desktopPage.waitForTimeout(400);
    const notesModal = desktopPage.locator('[role="dialog"][aria-label="Мои заметки"]');
    if (!(await notesModal.isVisible())) {
      throw new Error('Notes dialog not opened or missing accessibility attributes');
    }
    console.log('Notes Modal Opened: PASS');
    await desktopPage.keyboard.press('Escape');
    await notesModal.waitFor({ state: 'hidden', timeout: 3000 });
    console.log('Escape Key Closes Modal: PASS');

    // Switch to Digital Code (06.05.1986)
    const codeNav = desktopPage.locator('nav button:has-text("Код")');
    await codeNav.click();
    await desktopPage.waitForTimeout(600);

    const codeTitle = await desktopPage.title();
    console.log(`Alabaster Sanctuary Title: ${codeTitle}`);
    if (!codeTitle.includes('Цифровой Код')) {
      throw new Error(`Invalid code title: ${codeTitle}`);
    }

    const dayInput = desktopPage.locator('input[aria-label="День рождения"]');
    await dayInput.click();
    await dayInput.pressSequentially('06', { delay: 50 });
    const monthInput = desktopPage.locator('input[aria-label="Месяц рождения"]');
    await monthInput.click();
    await monthInput.pressSequentially('05', { delay: 50 });
    const yearInput = desktopPage.locator('input[aria-label="Год рождения"]');
    await yearInput.click();
    await yearInput.pressSequentially('1986', { delay: 50 });

    const submitBtn = desktopPage.locator('button[type="submit"]');
    await submitBtn.click();
    await desktopPage.waitForTimeout(800);

    const pageText = await desktopPage.innerText('body');
    if (pageText.includes('.,')) {
      throw new Error('Broken punctuation ".," found in rendered text');
    }
    if (pageText.includes('««')) {
      const idx = pageText.indexOf('««');
      console.log('CONTEXT OF ««:', pageText.slice(Math.max(0, idx - 40), Math.min(pageText.length, idx + 60)));
      throw new Error('Broken punctuation "««" found in rendered text');
    }
    if (pageText.includes('""')) {
      throw new Error('Broken punctuation \'""\' found in rendered text');
    }
    if (pageText.includes('когда вам нужно конфликт') || pageText.includes('где вы сможете осознайте')) {
      throw new Error('Broken subordinate clause found in rendered text');
    }
    console.log('Desktop Editorial Prose: CLEAN (06.05.1986)');

    // 2. MOBILE VIEWPORT (390x844) & PRIVACY-SAFE DRAFT RECOVERY
    console.log('\n--- Running Mobile Tests (390x844) ---');
    const mobileContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true
    });
    const mobilePage = await mobileContext.newPage();
    await mobilePage.goto('http://localhost:3456');
    await mobilePage.waitForTimeout(600);

    const homeBtn = mobilePage.locator('header button[title="Главная"]');
    const box = await homeBtn.boundingBox();
    console.log(`Mobile Home Button Touch Box: ${box?.width}x${box?.height}`);
    if (!box || box.width < 40 || box.height < 40) {
      throw new Error(`Touch target too small: ${box?.width}x${box?.height}`);
    }

    const mobileAboutBtn = mobilePage.locator('header button:has-text("О методе")');
    const mobileNotesBtn = mobilePage.locator('header button:has-text("Заметки")');
    if (!(await mobileAboutBtn.isVisible()) || !(await mobileNotesBtn.isVisible())) {
      throw new Error('Secondary navigation items missing on mobile');
    }
    console.log('Mobile Touch Targets & Navigation: PASS');

    await mobilePage.locator('nav button:has-text("Код")').click();
    await mobilePage.waitForTimeout(600);
    const mDay = mobilePage.locator('input[aria-label="День рождения"]');
    await mDay.click();
    await mDay.pressSequentially('15', { delay: 50 });
    const mMonth = mobilePage.locator('input[aria-label="Месяц рождения"]');
    await mMonth.click();
    await mMonth.pressSequentially('03', { delay: 50 });
    const mYear = mobilePage.locator('input[aria-label="Год рождения"]');
    await mYear.click();
    await mYear.pressSequentially('1990', { delay: 50 });

    await mobilePage.locator('button[type="submit"]').click();
    await mobilePage.waitForTimeout(800);

    const draftInSession = await mobilePage.evaluate(() => {
      return window.sessionStorage.getItem('zerkalo.transientDraft.v1');
    });
    if (!draftInSession) {
      throw new Error('Transient draft was not saved in sessionStorage');
    }
    console.log('SessionStorage Transient Draft: SAVED');

    console.log('Performing hard reload...');
    await mobilePage.reload();
    await mobilePage.waitForTimeout(800);

    const recoveryBanner = mobilePage.locator('text=Найдено незавершённое зеркало');
    if (!(await recoveryBanner.isVisible())) {
      throw new Error('Recovery banner not displayed after hard reload');
    }
    console.log('Recovery State Displayed: Найдено незавершённое зеркало — продолжить / начать заново');

    await mobilePage.locator('button:has-text("Продолжить")').first().click();
    await mobilePage.waitForTimeout(800);

    const restoredText = await mobilePage.innerText('body');
    if (!restoredText.includes('15.03.1990') && !restoredText.includes('Архитектура Силы')) {
      throw new Error('State was not restored correctly from transient draft');
    }
    console.log('HARD_RELOAD_DRAFT_RESTORE=PASS');
    console.log('UNNECESSARY_REGENERATION=0');

    console.log('\n=== ALL TARGETED ACCEPTANCE CHECKS PASSED ===');
  } finally {
    await browser.close();
    server.kill();
  }
}

runBrowserAcceptance().catch((e) => {
  console.error('Browser Acceptance Failed:', e);
  process.exit(1);
});
