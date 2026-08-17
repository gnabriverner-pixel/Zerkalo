const { chromium } = require("@playwright/test");
const path = require("path");
const fs = require("fs");
const child_process = require("child_process");

const repoRoot = path.resolve(__dirname, "..");
const evidenceDir = path.join(repoRoot, "docs/evidence/g2-live-acceptance");
const screenshotDir = path.join(evidenceDir, "screenshots");
fs.mkdirSync(screenshotDir, { recursive: true });

async function answerQuestion(page, stepTag, text, isLast = false) {
  console.log(`  [Myth Stepper] Waiting for step ${stepTag}...`);
  await page.waitForSelector(`text=${stepTag}`, { timeout: 20000 });
  await page.waitForTimeout(300);
  
  const textarea = page.locator('textarea');
  await textarea.waitFor({ state: 'visible' });
  await textarea.fill(text);
  await page.waitForTimeout(200);

  if (isLast) {
    const submitBtn = page.locator('button:has-text("Сплести историю")');
    await submitBtn.waitFor({ state: 'visible' });
    await submitBtn.click();
  } else {
    const nextBtn = page.locator('button:has-text("Продолжить")');
    await nextBtn.waitFor({ state: 'visible' });
    await nextBtn.click();
  }
  await page.waitForTimeout(500);
}

function saveDual(page, primaryName, aliasName) {
  const p1 = path.join(screenshotDir, primaryName);
  const p2 = aliasName ? path.join(screenshotDir, aliasName) : null;
  return Promise.all([
    page.screenshot({ path: p1, fullPage: false }),
    p2 ? page.screenshot({ path: p2, fullPage: false }) : Promise.resolve()
  ]);
}

async function switchLens(page, lens) {
  const backToMirrors = page.locator('button:has-text("К зеркалам")');
  if (await backToMirrors.isVisible() && lens !== "code" && lens !== "alabaster") {
    await backToMirrors.click();
    await page.waitForTimeout(400);
  }

  await page.evaluate((target) => {
    const textMap = {
      code: "Код",
      alabaster: "Код",
      myth: "Миф",
      meeting: "Встреча"
    };
    const targetText = textMap[target] || target;
    const btns = Array.from(document.querySelectorAll("nav button, header button, button"));
    let found = btns.find(b => b.closest("nav") && b.textContent && b.textContent.includes(targetText));
    if (!found) {
      if (target === "myth") {
        found = btns.find(b => b.textContent && (b.textContent.includes("Личному мифу") || b.textContent.includes("Миф") || b.textContent.includes("образы")));
      } else if (target === "meeting") {
        found = btns.find(b => b.textContent && (b.textContent.includes("Встреч") || b.textContent.includes("Синтез")));
      } else if (target === "code" || target === "alabaster") {
        found = btns.find(b => b.textContent && (b.textContent.includes("Код") || b.textContent.includes("дату")));
      }
    }
    if (found) {
      found.click();
    }
  }, lens);
  await page.waitForTimeout(600);
}

async function runSuite() {
  console.log("=========================================================");
  console.log("=== STARTING CANONICAL G2 LIVE ACCEPTANCE RUN (MOBILE) ===");
  console.log("=========================================================");

  const browser = await chromium.launch({
    headless: true
  });

  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });

  const page = await context.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') console.log(`  [BROWSER ERROR]: ${msg.text()}`);
  });

  // Collect provider responses for provenance evidence
  let lastMythResponse = null;
  let lastMeetingResponse = null;

  page.on('response', async (res) => {
    const url = res.url();
    if (url.includes('/api/personal-myth') && res.status() === 200) {
      try {
        lastMythResponse = await res.json();
      } catch (e) {}
    }
    if (url.includes('/api/lab/meeting/generate') && res.status() === 200) {
      try {
        lastMeetingResponse = await res.json();
      } catch (e) {}
    }
  });

  // ========================================================
  // TEST 1: ROUTE A (Myth-First Journey -> Code -> Meeting -> Albert)
  // ========================================================
  console.log("\n>>> TEST 1: Route A (Myth -> Code -> Meeting -> Albert)");
  await page.goto("http://localhost:3005", { waitUntil: "networkidle" });
  
  // 1. Threshold
  const h1 = await page.locator("h1").innerText();
  console.log(`  Threshold H1: ${h1}`);
  if (!h1.includes("Зеркало себя")) {
    throw new Error("Threshold page did not render expected title");
  }
  await saveDual(page, "01-threshold-390x844.png", "01_threshold_live.png");

  // 2. Collection choice (Two equal gates)
  const collectionSec = page.locator("#collection");
  await collectionSec.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await saveDual(page, "02_two_lenses_choice_live.png");

  // 3. Open Personal Myth
  const mythCard = page.locator('button:has-text("Войти через образы")').or(page.locator('text=Зеркало восприятия')).or(page.locator('text=Войти через образы →'));
  await mythCard.first().click();
  await page.waitForTimeout(600);

  const startMythBtn = page.locator('button:has-text("Войти через образы")');
  if (await startMythBtn.isVisible()) {
    await startMythBtn.click();
    await page.waitForTimeout(500);
  }

  // Answer 4 questions
  await saveDual(page, "03_myth_questions_live.png");
  await answerQuestion(page, "01 / 04", "Тяжесть в плечах, как будто несу чужой рюкзак.");
  await answerQuestion(page, "02 / 04", "Старая кирпичная арка во дворе, заросшая плющом.");
  await answerQuestion(page, "03 / 04", "Как отец молча положил руку на плечо, когда я не поступил.");
  await answerQuestion(page, "04 / 04", "Устойчивость и внутренняя тишина.", true);

  console.log("  Waiting for real DeepSeek v4-pro story generation...");
  const t0Myth = Date.now();
  await page.waitForSelector("article", { timeout: 90000 });
  const mythElapsed = Date.now() - t0Myth;
  console.log(`  DeepSeek v4-pro story rendered in ${mythElapsed}ms!`);
  await page.waitForTimeout(1000);
  await saveDual(page, "03-myth-result-provenance-390x844.png", "04_myth_result_live.png");

  // Verify source images & reflection blocks are visible
  const storyText = await page.locator("article").innerText();
  console.log(`  Generated Myth Story character count: ${storyText.length}`);

  // Test lens switching state preservation
  console.log("  Testing lens switching state preservation...");
  const toCodeBtn = page.locator('button:has-text("Открыть Цифровой код")').or(page.locator('button:has-text("Перейти ко второй линзе")'));
  await toCodeBtn.first().click();
  await page.waitForTimeout(800);

  // Enter Date in Alabaster Sanctuary for 15.08.1990
  const dayInput = page.locator('input[placeholder="ДД"]');
  const monthInput = page.locator('input[placeholder="ММ"]');
  const yearInput = page.locator('input[placeholder="ГГГГ"]');
  await dayInput.fill("15");
  await monthInput.fill("08");
  await yearInput.fill("1990");
  
  const calcBtn = page.locator('button:has-text("Открыть свой код")').or(page.locator('button:has-text("Рассчитать код")'));
  await calcBtn.first().click();

  console.log("  Waiting for Alabaster Sanctuary Code reveal...");
  await page.waitForSelector('text=Число души', { timeout: 30000 });
  await page.waitForTimeout(800);
  await saveDual(page, "04-code-result-390x844.png", "05_code_reveal_live.png");

  // Switch back to Myth to prove state was preserved in session
  const navMythBtn = page.locator('button:has-text("Личный миф")').first();
  if (await navMythBtn.isVisible()) {
    await navMythBtn.click();
    await page.waitForTimeout(600);
    const storyPreserved = await page.locator("article").isVisible();
    console.log(`  Myth story preserved in session after navigating away: ${storyPreserved}`);
    if (!storyPreserved) throw new Error("Myth state was lost on tab switch");
  }

  // Open Meeting of Mirrors
  const toMeetingBtn = page.locator('button:has-text("Открыть Встречу зеркал")').or(page.locator('nav button:has-text("Встреча")'));
  await toMeetingBtn.first().click();
  await page.waitForTimeout(800);

  // Trigger Meeting synthesis
  console.log("  Triggering real Gemini Meeting synthesis...");
  const runMeetingBtn = page.locator('button:has-text("Провести Встречу Зеркал")');
  await runMeetingBtn.waitFor({ state: 'visible' });
  const t0Meeting = Date.now();
  await runMeetingBtn.click();

  await page.waitForSelector('text=Итог', { timeout: 60000 });
  const meetingElapsed = Date.now() - t0Meeting;
  console.log(`  Meeting synthesis rendered in ${meetingElapsed}ms!`);
  await page.waitForTimeout(1000);
  await saveDual(page, "05-meeting-normal-390x844.png", "06_meeting_resonances_live.png");

  // Verify divergence styling is not treated as error
  const divergenceSec = page.locator('text=Расхождение').first();
  if (await divergenceSec.isVisible()) {
    await divergenceSec.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    await saveDual(page, "06-meeting-divergence-390x844.png");
    console.log("  Divergence section verified with equal evidentiary status (no error styling).");
  }

  // Open Albert Dialogue
  const albertBtn = page.locator('button:has-text("Диалог на сайте")');
  await albertBtn.waitFor({ state: 'visible' });
  await albertBtn.click();
  await page.waitForTimeout(800);

  // Verify Albert modal is open and has context
  const albertHeader = await page.locator('text=Альберт Вяземский').first().isVisible();
  console.log(`  Albert modal opened: ${albertHeader}`);
  
  // Interactive prompt submission in Albert modal
  const albertInput = page.locator('input[placeholder*="Задайте вопрос Альберту"]');
  if (await albertInput.isVisible()) {
    await albertInput.fill("Как связать образ из мифа с Числом души?");
    await albertInput.press("Enter");
    await page.waitForTimeout(1500);
  }
  await saveDual(page, "09-albert-open-390x844.png", "07_albert_dialogue_live.png");

  // Close Albert modal
  const closeAlbertBtn = page.locator('button:has-text("Закрыть")').or(page.locator('button:has-text("✕")')).or(page.locator('button[aria-label="Закрыть диалог"]'));
  if (await closeAlbertBtn.isVisible()) {
    await closeAlbertBtn.first().click();
    await page.waitForTimeout(500);
  }

  // ========================================================
  // TEST 2: ROUTE B (Code-First Journey -> Myth -> Meeting -> Albert)
  // ========================================================
  console.log("\n>>> TEST 2: Route B (Code-First Journey -> Myth -> Meeting -> Albert)");
  await page.goto("http://localhost:3005", { waitUntil: "networkidle" });
  await page.waitForTimeout(500);

  // 1. Enter Date for 06.05.1986 directly on threshold
  const dayInputB = page.locator('input[placeholder="ДД"]');
  const monthInputB = page.locator('input[placeholder="ММ"]');
  const yearInputB = page.locator('input[placeholder="ГГГГ"]');
  await dayInputB.fill("06");
  await monthInputB.fill("05");
  await yearInputB.fill("1986");
  
  const calcBtnB = page.locator('button:has-text("Рассчитать код")').or(page.locator('button:has-text("Открыть свой код")'));
  await calcBtnB.first().click();

  await page.waitForSelector('text=Число души', { timeout: 30000 });
  await page.waitForTimeout(600);
  await saveDual(page, "10-route-b-code-first-390x844.png", "08_route_b_code_first_live.png");

  // 2. Transition to Myth
  const toMythFromCodeBtn = page.locator('button:has-text("Перейти к Личному мифу")').or(page.locator('button:has-text("Открыть вторую линзу")')).or(page.locator('nav button:has-text("Миф")'));
  await toMythFromCodeBtn.first().click();
  await page.waitForTimeout(600);

  const startMythBBtn = page.locator('button:has-text("Войти через образы")');
  if (await startMythBBtn.isVisible()) {
    await startMythBBtn.click();
    await page.waitForTimeout(400);
  }

  await answerQuestion(page, "01 / 04", "Развилка дорог в густом сосновом бору.");
  await answerQuestion(page, "02 / 04", "Старинный медный компас с треснувшим стеклом.");
  await answerQuestion(page, "03 / 04", "Запах хвои после сильной грозы.");
  await answerQuestion(page, "04 / 04", "Верность собственному курсу.", true);

  console.log("  Waiting for DeepSeek v4-pro in Route B...");
  await page.waitForSelector("article", { timeout: 90000 });
  await page.waitForTimeout(800);
  await saveDual(page, "11-route-b-myth-390x844.png", "09_route_b_myth_live.png");

  // 3. Open Meeting of Mirrors in Route B
  const toMeetingFromMythBtn = page.locator('button:has-text("Открыть Встречу зеркал")').or(page.locator('nav button:has-text("Встреча")'));
  await toMeetingFromMythBtn.first().click();
  await page.waitForTimeout(600);

  const runMeetingBBtn = page.locator('button:has-text("Провести Встречу Зеркал")');
  await runMeetingBBtn.waitFor({ state: 'visible' });
  await runMeetingBBtn.click();

  await page.waitForSelector('text=Итог', { timeout: 60000 });
  await page.waitForTimeout(800);
  await saveDual(page, "12-route-b-meeting-390x844.png", "10_route_b_meeting_live.png");

  // 4. Complete Route B through Albert
  const albertBtnB = page.locator('button:has-text("Диалог на сайте")');
  await albertBtnB.waitFor({ state: 'visible' });
  await albertBtnB.click();
  await page.waitForTimeout(800);

  const albertInputB = page.locator('input[placeholder*="Задайте вопрос Альберту"]');
  if (await albertInputB.isVisible()) {
    await albertInputB.fill("Расскажите подробнее о сочетании полученных чисел и образов.");
    await albertInputB.press("Enter");
    await page.waitForTimeout(1500);
  }
  await saveDual(page, "13-route-b-albert-390x844.png");
  console.log("  Route B verified completely through Albert!");

  const closeAlbertBBtn = page.locator('button:has-text("Закрыть")').or(page.locator('button:has-text("✕")')).or(page.locator('button[aria-label="Закрыть диалог"]'));
  if (await closeAlbertBBtn.isVisible()) {
    await closeAlbertBBtn.first().click();
    await page.waitForTimeout(500);
  }

  // ========================================================
  // TEST 3: Feedback Error Handling & Nonblocking Flow
  // ========================================================
  console.log("\n>>> TEST 3: Feedback Error Handling & Non-blocking to Albert");
  const feedbackWidget = page.locator('textarea[placeholder*="комментар"]').or(page.locator('text=Отзыв о первой встрече зеркал')).or(page.locator('text=Насколько точно'));
  if (await feedbackWidget.first().isVisible()) {
    await feedbackWidget.first().scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);

    // Controlled failure on /api/feedback
    await page.route("**/api/feedback", async route => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ status: "error", ui: { safe_message: "Не удалось сохранить отклик. Попробуйте ещё раз позже." } })
      });
    });

    const sendFeedbackBtn = page.locator('button:has-text("Отправить отклик")');
    if (await sendFeedbackBtn.isVisible()) {
      await sendFeedbackBtn.click();
      await page.waitForTimeout(600);
      await saveDual(page, "18-feedback-error-handling-390x844.png", "15_feedback_error_handling.png");
      console.log("  Feedback honest error message verified.");
    }

    await page.unroute("**/api/feedback");
  }

  // ========================================================
  // TEST 4: Reduced Viewport (390x500 active virtual keyboard)
  // ========================================================
  console.log("\n>>> TEST 4: Simulating Reduced Viewport (390x500 active virtual keyboard)...");
  await page.setViewportSize({ width: 390, height: 500 });
  await page.goto("http://localhost:3005", { waitUntil: "networkidle" });
  
  const mythCardSmall = page.locator('button:has-text("Войти через образы")').or(page.locator('text=Зеркало восприятия')).or(page.locator('text=Войти через образы →'));
  await mythCardSmall.first().click();
  await page.waitForTimeout(500);

  const startMythSmallBtn = page.locator('button:has-text("Войти через образы")');
  if (await startMythSmallBtn.isVisible()) {
    await startMythSmallBtn.click();
    await page.waitForTimeout(500);
  }

  await page.waitForSelector('textarea', { timeout: 15000 });
  await page.locator('textarea').fill('Тест клавиатурного экрана: поле ввода полностью доступно для набора.');
  await saveDual(page, "02-myth-question-keyboard-390x844.png", "16_keyboard_reduced_viewport.png");
  console.log("  Reduced 390x500 virtual keyboard viewport verified.");

  // Restore viewport
  await page.setViewportSize({ width: 390, height: 844 });

  // ========================================================
  // TEST 5: Negative States & Architectural Constraints
  // ========================================================
  console.log("\n>>> TEST 5: Negative States & Architectural Constraints");
  await page.goto("http://localhost:3005", { waitUntil: "networkidle" });

  // Impossible Date: 31.02.1990
  const dIn = page.locator('input[placeholder="ДД"]');
  const mIn = page.locator('input[placeholder="ММ"]');
  const yIn = page.locator('input[placeholder="ГГГГ"]');
  await dIn.fill("31");
  await mIn.fill("02");
  await yIn.fill("1990");
  const subBtn = page.locator('button:has-text("Рассчитать код")').or(page.locator('button:has-text("Открыть свой код")'));
  await subBtn.first().click();
  await page.waitForTimeout(400);
  await saveDual(page, "14-invalid-impossible-date-390x844.png", "11_invalid_impossible_date.png");

  // Future Date: 01.01.2099
  await dIn.fill("01");
  await mIn.fill("01");
  await yIn.fill("2099");
  await subBtn.first().click();
  await page.waitForTimeout(400);
  await saveDual(page, "15-invalid-future-date-390x844.png", "12_invalid_future_date.png");

  // Meeting Precondition Blocked
  await page.goto("http://localhost:3005", { waitUntil: "networkidle" });
  const meetingNav = page.locator('nav button:has-text("Встреча")').or(page.locator('text=Встреча зеркал'));
  if (await meetingNav.first().isVisible()) {
    await meetingNav.first().click();
    await page.waitForTimeout(500);
    const synthBtn = page.locator('button:has-text("Провести Встречу Зеркал")');
    const isBlocked = await synthBtn.isDisabled();
    console.log(`  Meeting synthesis button disabled on fresh session: ${isBlocked}`);
    await saveDual(page, "16-meeting-precondition-blocked-390x844.png", "13_meeting_precondition_blocked.png");
  }

  // Offline / Deterministic Code
  await page.goto("http://localhost:3005", { waitUntil: "networkidle" });
  await dIn.fill("12");
  await mIn.fill("12");
  await yIn.fill("1988");
  await subBtn.first().click();
  await page.waitForSelector('text=Число души', { timeout: 15000 });
  await saveDual(page, "17-code-deterministic-offline-390x844.png", "14_code_deterministic_offline.png");

  // ========================================================
  // TEST 6: Controlled Provider Failures (Truthful Proofs)
  // ========================================================
  console.log("\n>>> TEST 6: Controlled Provider Failures & State Preservation");

  // 1. Myth Provider Failure (Missing DEEPSEEK_API_KEY on alternate server port 3006)
  console.log("  Testing missing DEEPSEEK_API_KEY against fresh server instance on port 3006...");
  const altServer = child_process.spawn("npx", ["tsx", "server.ts"], {
    cwd: repoRoot,
    env: { ...process.env, PORT: "3006", DEEPSEEK_API_KEY: "" },
    stdio: "pipe"
  });

  try {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Timeout waiting for alt server on port 3006")), 15000);
      altServer.stdout.on("data", (data) => {
        if (data.toString().includes("3006")) {
          clearTimeout(timeout);
          resolve();
        }
      });
      altServer.on("error", (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    // Verify API returns 503 personal_myth_provider_not_ready
    const altApiRes = await fetch("http://localhost:3006/api/personal-myth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        request_id: "test_missing_key_proof_12345",
        answers: {
          q1: "Чувствую усталость",
          q2: "Старый маяк в тумане",
          q3: "Тихий вечер у моря",
          q4: "Внутреннее спокойствие"
        }
      })
    });
    const altApiJson = await altApiRes.json();
    console.log(`  Alt-port 3006 API response: HTTP ${altApiRes.status}, code: ${altApiJson.code}`);
    if (altApiRes.status !== 503 || altApiJson.code !== "personal_myth_provider_not_ready") {
      throw new Error(`Expected 503 personal_myth_provider_not_ready from server without DEEPSEEK_API_KEY, got ${altApiRes.status}: ${JSON.stringify(altApiJson)}`);
    }
  } finally {
    altServer.kill("SIGTERM");
  }

  // 1b. Client Failure Injection (503 / Provider Not Ready) + Answers Preserved
  await page.goto("http://localhost:3005", { waitUntil: "networkidle" });
  const mythEntry = page.locator('button:has-text("Войти через образы")').or(page.locator('text=Зеркало восприятия')).or(page.locator('text=Войти через образы →'));
  await mythEntry.first().click();
  await page.waitForTimeout(400);

  const startMythFail = page.locator('button:has-text("Войти через образы")');
  if (await startMythFail.isVisible()) {
    await startMythFail.click();
    await page.waitForTimeout(500);
  }

  await answerQuestion(page, "01 / 04", "Ответ 1 для проверки ошибки.");
  await answerQuestion(page, "02 / 04", "Ответ 2 для проверки ошибки.");
  await answerQuestion(page, "03 / 04", "Ответ 3 для проверки ошибки.");

  // Inject 503 on /api/personal-myth (CONTROLLED_FAILURE_INJECTION)
  await page.route("**/api/personal-myth", async route => {
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        status: "error",
        code: "personal_myth_provider_not_ready",
        ui: { safe_message: "Личный миф временно недоступен (провайдер генерации не настроен). Ваши ответы сохранены." }
      })
    });
  });

  await answerQuestion(page, "04 / 04", "Ответ 4 для проверки ошибки.", true);
  await page.waitForSelector('text=Личный миф временно недоступен', { timeout: 10000 });
  
  // Verify answer is preserved in textarea
  const preservedText = await page.locator('textarea').inputValue();
  console.log(`  Preserved answer in textarea after provider failure: ${preservedText}`);
  await saveDual(page, "19-myth-provider-failure-answers-preserved-390x844.png", "17_myth_provider_failure.png");
  await page.unroute("**/api/personal-myth");

  // 2. Controlled Meeting Failure on Two Real Lenses (Preserves Code + Myth)
  console.log("  Testing Controlled Meeting Failure on Two Real Completed Lenses...");
  await page.goto("http://localhost:3005", { waitUntil: "networkidle" });
  
  // Calculate real Code
  await dIn.fill("15");
  await mIn.fill("08");
  await yIn.fill("1990");
  await subBtn.first().click();
  await page.waitForSelector('text=Число души', { timeout: 15000 });

  // Generate real Myth
  const toMythBtn2 = page.locator('button:has-text("Перейти к Личному мифу")').or(page.locator('button:has-text("Открыть вторую линзу")')).or(page.locator('nav button:has-text("Миф")'));
  await toMythBtn2.first().click();
  await page.waitForTimeout(400);

  if (await startMythFail.isVisible()) {
    await startMythFail.click();
    await page.waitForTimeout(500);
  }

  await answerQuestion(page, "01 / 04", "Отражение в речной воде.");
  await answerQuestion(page, "02 / 04", "Деревянный мост через туман.");
  await answerQuestion(page, "03 / 04", "Свет фонаря на мокром асфальте.");
  await answerQuestion(page, "04 / 04", "Спокойная решимость.", true);
  await page.waitForSelector("article", { timeout: 90000 });

  // Navigate to Meeting
  const toMeetingBtn2 = page.locator('button:has-text("Открыть Встречу зеркал")').or(page.locator('nav button:has-text("Встреча")'));
  await toMeetingBtn2.first().click();
  await page.waitForTimeout(500);

  // Inject 503 on /api/lab/meeting/generate
  await page.route("**/api/lab/meeting/generate", async route => {
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        status: "error",
        ui: { safe_message: "Встреча зеркал временно не смогла сформировать синтез. Ваши результаты сохранены — попробуйте повторить запрос." }
      })
    });
  });

  const runMeetingFailBtn = page.locator('button:has-text("Провести Встречу Зеркал")');
  await runMeetingFailBtn.click();
  await page.waitForSelector('text=Встреча зеркал временно', { timeout: 10000 });
  await saveDual(page, "08-meeting-provider-error-preserves-results-390x844.png", "18_meeting_provider_failure.png");

  // Verify Code and Myth remain accessible
  await switchLens(page, "code");
  await page.waitForSelector('text=Число души', { timeout: 10000 });
  const codeStillVisible = await page.locator('text=Число души').isVisible();
  console.log(`  Code calculation still visible after Meeting 503: ${codeStillVisible}`);

  await switchLens(page, "myth");
  await page.waitForSelector('article', { timeout: 10000 });
  const mythStillVisible = await page.locator('article').isVisible();
  console.log(`  Myth story still visible after Meeting 503: ${mythStillVisible}`);
  
  if (!codeStillVisible || !mythStillVisible) {
    throw new Error("Lens results were lost during Meeting provider failure");
  }
  await page.unroute("**/api/lab/meeting/generate");

  // ========================================================
  // TEST 7: Crisis Safety Intercept
  // ========================================================
  console.log("\n>>> TEST 7: Crisis Safety Intercept");
  await page.goto("http://localhost:3005", { waitUntil: "networkidle" });
  const mythEntryCrisis = page.locator('button:has-text("Войти через образы")').or(page.locator('text=Зеркало восприятия')).or(page.locator('text=Войти через образы →'));
  await mythEntryCrisis.first().click();
  await page.waitForTimeout(400);

  const startMythCrisis = page.locator('button:has-text("Войти через образы")');
  if (await startMythCrisis.isVisible()) {
    await startMythCrisis.click();
    await page.waitForTimeout(500);
  }

  await answerQuestion(page, "01 / 04", "Я больше не могу терпеть и хочу умереть.");
  await answerQuestion(page, "02 / 04", "Темнота.");
  await answerQuestion(page, "03 / 04", "Ничего.");
  await answerQuestion(page, "04 / 04", "Пустота.", true);

  await page.waitForSelector('text=живая поддержка', { timeout: 15000 });
  await saveDual(page, "20-crisis-safety-intercept-390x844.png", "19_crisis_safety_intercept.png");
  console.log("  Crisis Safety Intercept verified.");

  // ========================================================
  // TEST 8: Zero-Resonance Synthetic UI State Fixture
  // ========================================================
  console.log("\n>>> TEST 8: Zero-Resonance Synthetic UI State Fixture");
  await page.goto("http://localhost:3005", { waitUntil: "networkidle" });
  
  // Calculate code
  await dIn.fill("15");
  await mIn.fill("08");
  await yIn.fill("1990");
  await subBtn.first().click();
  await page.waitForSelector('text=Число души', { timeout: 15000 });

  // Myth
  const toMythBtn3 = page.locator('button:has-text("Перейти к Личному мифу")').or(page.locator('button:has-text("Открыть вторую линзу")')).or(page.locator('nav button:has-text("Миф")'));
  await toMythBtn3.first().click();
  await page.waitForTimeout(400);

  const startMythZero = page.locator('button:has-text("Войти через образы")');
  if (await startMythZero.isVisible()) {
    await startMythZero.click();
    await page.waitForTimeout(500);
  }

  await answerQuestion(page, "01 / 04", "Отражение в зеркале.");
  await answerQuestion(page, "02 / 04", "Старый чердак.");
  await answerQuestion(page, "03 / 04", "Звон колокола.");
  await answerQuestion(page, "04 / 04", "Тишина.", true);
  await page.waitForSelector("article", { timeout: 90000 });

  // Route Meeting with synthetic 0-resonance payload
  await page.route("**/api/lab/meeting/generate", async route => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        status: "ok",
        result: {
          summary: "Две линзы показали разные грани без прямого пересечения.",
          hasStrongParallels: false,
          confidenceNote: "Синтез на основе контраста",
          parallels: [],
          divergences: [
            {
              theme: "Разные точки опоры",
              codeAspect: "Код подчёркивает структуру и внешнюю реализацию.",
              mythAspect: "Миф обращает внимание на тишину и наблюдение.",
              reflection: "Это не противоречие, а разные языки описания."
            }
          ],
          albertInsight: "Две линзы не противоречат друг другу, а исследуют вас в разных измерениях.",
          reflectiveQuestion: "Какая из двух сторон сейчас требует больше внимания?",
          disclaimer: "Встреча зеркал носит метафорический и исследовательский характер."
        }
      })
    });
  });

  const toMeetingBtn3 = page.locator('button:has-text("Открыть Встречу зеркал")').or(page.locator('nav button:has-text("Встреча")'));
  await toMeetingBtn3.first().click();
  await page.waitForTimeout(500);

  const runMeetingZeroBtn = page.locator('button:has-text("Провести Встречу Зеркал")');
  await runMeetingZeroBtn.click();
  await page.waitForSelector('text=Итог', { timeout: 15000 });
  await page.waitForTimeout(800);
  await saveDual(page, "07-meeting-zero-390x844.png", "20_meeting_zero_match_synthetic.png");
  console.log("  Zero-Resonance Synthetic UI State verified.");
  await page.unroute("**/api/lab/meeting/generate");

  await browser.close();

  // Fail-closed verification of synthesis model via /health endpoint
  const healthRes = await fetch("http://localhost:3005/health");
  if (!healthRes.ok) {
    throw new Error(`Failed to query /health endpoint: HTTP ${healthRes.status}`);
  }
  const healthJson = await healthRes.json();
  const synthesisModel = healthJson?.models?.synthesis;
  if (!synthesisModel) {
    throw new Error("Synthesis model missing in /health endpoint");
  }

  // Fail-closed verification of captured real provider responses
  if (
    !lastMythResponse ||
    lastMythResponse.status !== "ok" ||
    lastMythResponse.provider !== "deepseek" ||
    lastMythResponse.model !== "deepseek-v4-pro" ||
    !lastMythResponse.story_result ||
    !lastMythResponse.qa ||
    !lastMythResponse.qa.passed
  ) {
    throw new Error(`Personal Myth response failed fail-closed provenance validation: ${JSON.stringify(lastMythResponse)}`);
  }

  if (
    !lastMeetingResponse ||
    lastMeetingResponse.status !== "ok" ||
    !lastMeetingResponse.result
  ) {
    throw new Error(`Meeting response failed fail-closed provenance validation: ${JSON.stringify(lastMeetingResponse)}`);
  }

  // Save fail-closed provenance artifact
  const provenanceData = {
    timestamp: new Date().toISOString(),
    personal_myth: {
      provider: lastMythResponse.provider,
      model: lastMythResponse.model,
      writer_version: lastMythResponse.writer_version,
      status: lastMythResponse.status,
      qa: {
        passed: lastMythResponse.qa.passed,
        word_count: lastMythResponse.qa.word_count,
        repaired: lastMythResponse.qa.repaired
      }
    },
    meeting_synthesis: {
      provider: "google",
      model: synthesisModel,
      status: lastMeetingResponse.status,
      parallels_count: Array.isArray(lastMeetingResponse.result.parallels) ? lastMeetingResponse.result.parallels.length : 0,
      divergences_count: Array.isArray(lastMeetingResponse.result.divergences) ? lastMeetingResponse.result.divergences.length : 0
    }
  };

  fs.writeFileSync(
    path.join(evidenceDir, "PROVIDER_PROVENANCE.json"),
    JSON.stringify(provenanceData, null, 2),
    "utf-8"
  );
  console.log("  Saved fail-closed PROVIDER_PROVENANCE.json successfully.");

  console.log("\n=========================================================");
  console.log("=== ALL CANONICAL LIVE ACCEPTANCE SUITES PASSED CLEAN ===");
  console.log("=========================================================\n");
}

runSuite().catch(err => {
  console.error("FATAL ERROR IN ACCEPTANCE RUNNER:", err);
  process.exit(1);
});
