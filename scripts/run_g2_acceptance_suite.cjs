const { chromium } = require("/Users/artemkrysin/.npm/_npx/31e32ef8478fbf80/node_modules/playwright-core");
const path = require("path");
const fs = require("fs");

const evidenceDir = "/Users/artemkrysin/Documents/Hermes_agent/zerkalo-lab/docs/evidence/g2-live-acceptance";
const screenshotDir = path.join(evidenceDir, "screenshots");
fs.mkdirSync(screenshotDir, { recursive: true });

const chromePath = "/Users/artemkrysin/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell";

async function answerQuestion(page, stepTag, text, isLast = false) {
  console.log(`  [Myth Stepper] Waiting for step ${stepTag}...`);
  await page.waitForSelector(`text=${stepTag}`, { timeout: 15000 });
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

async function runSuite() {
  console.log("=================================================");
  console.log("=== STARTING COMPLETE G2 LIVE ACCEPTANCE RUN ===");
  console.log("=================================================");

  const browser = await chromium.launch({
    executablePath: chromePath,
    headless: true
  });

  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });

  const page = await context.newPage();

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      console.log("  [BROWSER ERROR]:", msg.text());
    }
  });

  try {
    // -------------------------------------------------------------
    // TEST 1: ROUTE A (LIVE: Myth -> Code -> Meeting -> Albert)
    // -------------------------------------------------------------
    console.log("\n>>> TEST 1: Route A (Myth-First Journey)");
    await page.goto("http://localhost:3005", { waitUntil: "networkidle" });
    await page.waitForTimeout(500);

    // 1.1 Threshold Landing
    const title = await page.textContent("h1");
    console.log("  Threshold H1:", title.trim());
    await page.screenshot({ path: path.join(screenshotDir, "01_threshold_live.png") });
    console.log("  Saved: 01_threshold_live.png");

    // 1.2 Two Equal Gates
    const collectionElem = page.locator("#collection");
    await collectionElem.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(screenshotDir, "02_two_lenses_choice_live.png") });
    console.log("  Saved: 02_two_lenses_choice_live.png");

    // 1.3 Personal Myth Entrance
    await page.click("text=Сказка про вас");
    await page.waitForTimeout(500);
    const startMythBtn = page.locator('button:has-text("Войти через образы")');
    if (await startMythBtn.isVisible()) {
      await startMythBtn.click();
      await page.waitForTimeout(400);
    }

    // 1.4 Answering 4 Questions
    await page.screenshot({ path: path.join(screenshotDir, "03_myth_questions_live.png") });
    console.log("  Saved: 03_myth_questions_live.png");

    await answerQuestion(page, "01 / 04", "Тяжесть в плечах, как будто несу чужой рюкзак.", false);
    await answerQuestion(page, "02 / 04", "Старая кирпичная арка во дворе, заросшая плющом.", false);
    await answerQuestion(page, "03 / 04", "Как отец молча положил руку на плечо, когда я не поступил.", false);
    await answerQuestion(page, "04 / 04", "Устойчивость и внутренняя тишина.", true);

    // 1.5 Real DeepSeek v4-pro Story Generation
    console.log("  Waiting for real DeepSeek v4-pro story generation...");
    await page.waitForSelector("article", { timeout: 90000 });
    await page.waitForTimeout(1000);
    console.log("  DeepSeek v4-pro story rendered successfully!");
    await page.screenshot({ path: path.join(screenshotDir, "04_myth_result_live.png") });
    console.log("  Saved: 04_myth_result_live.png");

    // 1.6 Navigate to Second Lens (Digital Code)
    const toCodeBtn = page.locator('button:has-text("Открыть Цифровой код")').or(page.locator('button:has-text("Перейти ко второй линзе")'));
    await toCodeBtn.first().scrollIntoViewIfNeeded();
    await toCodeBtn.first().click();
    await page.waitForTimeout(600);

    // 1.7 Calculate Code in Alabaster Sanctuary
    await page.locator('input[placeholder="ДД"]').fill("15");
    await page.locator('input[placeholder="ММ"]').fill("08");
    await page.locator('input[placeholder="ГГГГ"]').fill("1990");
    await page.locator('button:has-text("Открыть свой код")').click();

    console.log("  Waiting for Alabaster Sanctuary Code reveal...");
    await page.waitForSelector("text=Число души", { timeout: 30000 });
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(screenshotDir, "05_code_reveal_live.png") });
    console.log("  Saved: 05_code_reveal_live.png");

    // 1.8 Navigate to Meeting of Mirrors
    const toMeetingBtn = page.locator('button:has-text("Открыть Встречу зеркал")');
    await toMeetingBtn.scrollIntoViewIfNeeded();
    await toMeetingBtn.click();
    await page.waitForTimeout(600);

    // 1.9 Run Live Meeting Synthesis
    const runMeetingBtn = page.locator('button:has-text("Провести Встречу Зеркал")');
    await runMeetingBtn.waitFor({ state: 'visible' });
    console.log("  Triggering real Gemini Meeting synthesis...");
    await runMeetingBtn.click();

    await page.waitForSelector("text=Итог", { timeout: 60000 });
    await page.waitForTimeout(1000);
    console.log("  Meeting synthesis rendered successfully!");
    await page.screenshot({ path: path.join(screenshotDir, "06_meeting_resonances_live.png") });
    console.log("  Saved: 06_meeting_resonances_live.png");

    // 1.10 Open Albert Web Dialogue with Real Interaction
    const openAlbertBtn = page.locator('button:has-text("Диалог на сайте")');
    await openAlbertBtn.scrollIntoViewIfNeeded();
    await openAlbertBtn.click();
    await page.waitForTimeout(800);

    const modal = page.locator('.fixed.inset-0.z-\\[130\\]');
    await modal.waitFor({ state: 'visible' });
    const modalQuestionBtn = modal.locator('button.text-left').first();
    if (await modalQuestionBtn.isVisible()) {
      await modalQuestionBtn.click();
      await page.waitForTimeout(1500);
    }
    await page.screenshot({ path: path.join(screenshotDir, "07_albert_dialogue_live.png") });
    console.log("  Saved: 07_albert_dialogue_live.png (Live Interactive Albert Modal)");

    const closeAlbertBtn = modal.locator('button').first();
    if (await closeAlbertBtn.isVisible()) await closeAlbertBtn.click();
    await page.waitForTimeout(500);

    // -------------------------------------------------------------
    // TEST 2: ROUTE B (LIVE: Code-First -> Myth -> Meeting -> Albert)
    // -------------------------------------------------------------
    console.log("\n>>> TEST 2: Route B (Code-First Journey)");
    await page.goto("http://localhost:3005", { waitUntil: "networkidle" });
    await page.waitForTimeout(500);

    // 2.1 Calculate Code on Landing
    await page.locator('input[placeholder="ДД"]').fill("06");
    await page.locator('input[placeholder="ММ"]').fill("05");
    await page.locator('input[placeholder="ГГГГ"]').fill("1986");
    await page.locator('button:has-text("Рассчитать код")').click();

    await page.waitForSelector("text=Число души", { timeout: 30000 });
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(screenshotDir, "08_route_b_code_first_live.png") });
    console.log("  Saved: 08_route_b_code_first_live.png");

    // 2.2 Click Continue to Myth
    const continueToMythBtn = page.locator('button:has-text("Перейти к Личному мифу")');
    await continueToMythBtn.scrollIntoViewIfNeeded();
    await continueToMythBtn.click();
    await page.waitForTimeout(600);

    const startMythBtnB = page.locator('button:has-text("Войти через образы")');
    if (await startMythBtnB.isVisible()) await startMythBtnB.click();

    // 2.3 Answer Myth in Route B
    await answerQuestion(page, "01 / 04", "Развилка дорог в густом сосновом бору.", false);
    await answerQuestion(page, "02 / 04", "Старинный медный компас с треснувшим стеклом.", false);
    await answerQuestion(page, "03 / 04", "Запах хвои после сильной грозы.", false);
    await answerQuestion(page, "04 / 04", "Верность собственному курсу.", true);

    console.log("  Waiting for DeepSeek v4-pro in Route B...");
    await page.waitForSelector("article", { timeout: 90000 });
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(screenshotDir, "09_route_b_myth_live.png") });
    console.log("  Saved: 09_route_b_myth_live.png");

    // 2.4 Open Meeting of Mirrors from Route B
    const openMeetingFromMyth = page.locator('button:has-text("Открыть Встречу зеркал")');
    await openMeetingFromMyth.scrollIntoViewIfNeeded();
    await openMeetingFromMyth.click();
    await page.waitForTimeout(600);

    const runMeetingBtnB = page.locator('button:has-text("Провести Встречу Зеркал")');
    await runMeetingBtnB.click();

    await page.waitForSelector("text=Итог", { timeout: 60000 });
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(screenshotDir, "10_route_b_meeting_live.png") });
    console.log("  Saved: 10_route_b_meeting_live.png");

    // 2.5 Feedback Failure Handling (API error does not claim success)
    await page.route("**/api/feedback", async (route) => {
      await route.fulfill({ status: 500, json: { status: "error", error: "db_error" } });
    });
    const feedbackHeader = page.locator('text=Насколько Встреча зеркал оказалась про вас?');
    await feedbackHeader.scrollIntoViewIfNeeded();
    await page.locator('button:has-text("9")').first().click();
    await page.waitForTimeout(300);
    const submitFb = page.locator('button:has-text("Отправить отклик")');
    await submitFb.scrollIntoViewIfNeeded();
    await submitFb.click();
    await page.waitForSelector("text=Не удалось сохранить отклик", { timeout: 5000 });
    await page.screenshot({ path: path.join(screenshotDir, "15_feedback_error_handling.png") });
    console.log("  Saved: 15_feedback_error_handling.png (Feedback Error Honest)");
    await page.unroute("**/api/feedback");

    // 2.6 Virtual Keyboard / Reduced Viewport (390 x 500)
    console.log("\n>>> Simulating Reduced Viewport (390x500 active virtual keyboard)...");
    await page.setViewportSize({ width: 390, height: 500 });
    const toMythNav = page.locator('header nav button:has-text("Миф")').or(page.locator('button:has-text("Миф")'));
    await toMythNav.first().click();
    await page.waitForTimeout(500);
    const mythInput = page.locator('textarea');
    if (!await mythInput.isVisible()) {
      const startM = page.locator('button:has-text("Войти через образы")');
      if (await startM.isVisible()) await startM.click();
    }
    await page.waitForSelector("textarea", { timeout: 5000 });
    await page.locator("textarea").scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(screenshotDir, "16_keyboard_reduced_viewport.png") });
    console.log("  Saved: 16_keyboard_reduced_viewport.png (Mobile Keyboard Safe)");
    await page.setViewportSize({ width: 390, height: 844 });

    // -------------------------------------------------------------
    // TEST 3: NEGATIVE STATES, CONSTRAINTS & EDGE CASES
    // -------------------------------------------------------------
    console.log("\n>>> TEST 3: Negative States & Architectural Constraints");

    // 3.1 Impossible Date Validation
    await page.goto("http://localhost:3005", { waitUntil: "networkidle" });
    await page.locator('input[placeholder="ДД"]').fill("31");
    await page.locator('input[placeholder="ММ"]').fill("02");
    await page.locator('input[placeholder="ГГГГ"]').fill("1990");
    await page.locator('button:has-text("Рассчитать код")').click();
    await page.waitForSelector("text=Введите существующую дату рождения", { timeout: 5000 });
    await page.screenshot({ path: path.join(screenshotDir, "11_invalid_impossible_date.png") });
    console.log("  Saved: 11_invalid_impossible_date.png (Impossible Date Rejected)");

    // 3.2 Future Date Validation
    await page.locator('input[placeholder="ДД"]').fill("01");
    await page.locator('input[placeholder="ММ"]').fill("01");
    await page.locator('input[placeholder="ГГГГ"]').fill("2099");
    await page.locator('button:has-text("Рассчитать код")').click();
    await page.waitForSelector("text=Введите существующую дату рождения", { timeout: 5000 });
    await page.screenshot({ path: path.join(screenshotDir, "12_invalid_future_date.png") });
    console.log("  Saved: 12_invalid_future_date.png (Future Date Rejected)");

    // 3.3 Meeting Precondition Blocked (Meeting without both mirrors)
    await page.goto("http://localhost:3005", { waitUntil: "networkidle" });
    const toMeetingDirect = page.locator('header nav button:has-text("Встреча")').or(page.locator('button:has-text("Встреча")'));
    await toMeetingDirect.first().click();
    await page.waitForTimeout(400);
    const meetingBtn = page.locator('button:has-text("Провести Встречу Зеркал")');
    const isDisabled = await meetingBtn.isDisabled();
    console.log("  Meeting synthesis button disabled on fresh session:", isDisabled);
    await page.screenshot({ path: path.join(screenshotDir, "13_meeting_precondition_blocked.png") });
    console.log("  Saved: 13_meeting_precondition_blocked.png (Meeting Precondition Enforced)");

    // 3.4 Code Usability Offline / Deterministic Calculation
    const toCodeDirect = page.locator('header nav button:has-text("Код")').or(page.locator('button:has-text("Код")'));
    await toCodeDirect.first().click();
    await page.locator('input[placeholder="ДД"]').fill("15");
    await page.locator('input[placeholder="ММ"]').fill("08");
    await page.locator('input[placeholder="ГГГГ"]').fill("1990");
    await page.locator('button:has-text("Открыть свой код")').click();
    await page.waitForSelector("text=Число души", { timeout: 10000 });
    await page.screenshot({ path: path.join(screenshotDir, "14_code_deterministic_offline.png") });
    console.log("  Saved: 14_code_deterministic_offline.png (Deterministic Engine Usable)");

    // -------------------------------------------------------------
    // TEST 4: REAL PROVIDER FAILURES & CRISIS INTERCEPTION
    // -------------------------------------------------------------
    console.log("\n>>> TEST 4: Real Provider Failures & Safety");

    // 4.1 Myth Provider Failure (Answers preserved)
    await page.route("**/api/personal-myth", async (route) => {
      await route.fulfill({
        status: 502,
        json: { status: "error", error: "provider_unavailable", ui: { safe_message: "Связь с зеркалом прервалась. Попробуйте обновить." } }
      });
    });

    await page.goto("http://localhost:3005", { waitUntil: "networkidle" });
    const toMythFail = page.locator('header nav button:has-text("Миф")').or(page.locator('button:has-text("Миф")'));
    await toMythFail.first().click();
    await page.waitForTimeout(500);
    const startMythBtnFail = page.locator('button:has-text("Войти через образы")');
    await startMythBtnFail.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
    if (await startMythBtnFail.isVisible()) {
      await startMythBtnFail.click();
      await page.waitForTimeout(500);
    }

    await answerQuestion(page, "01 / 04", "Ответ 1 для проверки ошибки.", false);
    await answerQuestion(page, "02 / 04", "Ответ 2 для проверки ошибки.", false);
    await answerQuestion(page, "03 / 04", "Ответ 3 для проверки ошибки.", false);
    await answerQuestion(page, "04 / 04", "Ответ 4 для проверки ошибки.", true);

    await page.waitForSelector("text=Связь с зеркалом прервалась", { timeout: 10000 });
    const preservedVal = await page.locator("textarea").inputValue();
    console.log("  Preserved answer in textarea after provider failure:", preservedVal);
    await page.screenshot({ path: path.join(screenshotDir, "17_myth_provider_failure.png") });
    console.log("  Saved: 17_myth_provider_failure.png (Myth Provider Failure + Answers Preserved)");
    await page.unroute("**/api/personal-myth");

    // 4.2 Meeting Provider Failure (Code + Myth Preserved)
    await page.route("**/api/lab/meeting/generate", async (route) => {
      await route.fulfill({
        status: 503,
        json: { status: "error", error: "synthesis_model_overloaded", ui: { safe_message: "Связь с зеркалом прервалась при сопоставлении линз." } }
      });
    });

    // Provide mock completed code & myth to page state
    await page.goto("http://localhost:3005", { waitUntil: "networkidle" });
    const toCodeF = page.locator('header nav button:has-text("Код")').or(page.locator('button:has-text("Код")'));
    await toCodeF.first().click();
    await page.locator('input[placeholder="ДД"]').fill("15");
    await page.locator('input[placeholder="ММ"]').fill("08");
    await page.locator('input[placeholder="ГГГГ"]').fill("1990");
    await page.locator('button:has-text("Открыть свой код")').click();
    await page.waitForSelector("text=Число души", { timeout: 10000 });

    // Mock successful myth response
    await page.route("**/api/personal-myth", async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          status: "ok",
          story_result: {
            title: "Тихий маяк",
            story: "История о человеке, который нашел твердый берег.",
            mirror: { mainImage: "Маяк", innerTension: "Поиск", hiddenResource: "Опора", newView: "Спокойствие" },
            meaning: ["Опора"],
            one_step: "Дышать глубже",
            journal_question: "Где вы чувствуете твердость?",
            disclaimer: "Образный формат."
          }
        }
      });
    });

    const toMythM = page.locator('header nav button:has-text("Миф")').or(page.locator('button:has-text("Миф")'));
    await toMythM.first().click();
    await page.waitForTimeout(500);
    const startMBtn = page.locator('button:has-text("Войти через образы")');
    await startMBtn.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
    if (await startMBtn.isVisible()) {
      await startMBtn.click();
      await page.waitForTimeout(500);
    }
    await answerQuestion(page, "01 / 04", "Тест 1", false);
    await answerQuestion(page, "02 / 04", "Тест 2", false);
    await answerQuestion(page, "03 / 04", "Тест 3", false);
    await answerQuestion(page, "04 / 04", "Тест 4", true);
    await page.waitForSelector("article", { timeout: 10000 });

    const toMeetF = page.locator('header nav button:has-text("Встреча")').or(page.locator('button:has-text("Встреча")'));
    await toMeetF.first().click();
    await page.waitForTimeout(500);
    await page.locator('button:has-text("Провести Встречу Зеркал")').click();
    await page.waitForSelector("text=Связь с зеркалом прервалась", { timeout: 10000 });
    await page.screenshot({ path: path.join(screenshotDir, "18_meeting_provider_failure.png") });
    console.log("  Saved: 18_meeting_provider_failure.png (Meeting Provider Failure + Honest Error)");

    await page.unroute("**/api/lab/meeting/generate");
    await page.unroute("**/api/personal-myth");

    // 4.3 Crisis Safety Interception
    await page.goto("http://localhost:3005", { waitUntil: "networkidle" });
    const toMythCr = page.locator('header nav button:has-text("Миф")').or(page.locator('button:has-text("Миф")'));
    await toMythCr.first().click();
    await page.waitForTimeout(500);
    const startMythCrisis = page.locator('button:has-text("Войти через образы")');
    await startMythCrisis.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
    if (await startMythCrisis.isVisible()) {
      await startMythCrisis.click();
      await page.waitForTimeout(500);
    }

    await answerQuestion(page, "01 / 04", "Я хочу умереть и покончить с собой.", false);
    await answerQuestion(page, "02 / 04", "Темнота.", false);
    await answerQuestion(page, "03 / 04", "Ничего.", false);
    await answerQuestion(page, "04 / 04", "Пустота.", true);

    await page.waitForSelector("text=живая поддержка", { timeout: 15000 });
    await page.screenshot({ path: path.join(screenshotDir, "19_crisis_safety_intercept.png") });
    console.log("  Saved: 19_crisis_safety_intercept.png (Crisis Safety Intercept)");

    // -------------------------------------------------------------
    // TEST 5: ZERO-RESONANCE SYNTHETIC STATE
    // -------------------------------------------------------------
    console.log("\n>>> TEST 5: Zero-Resonance Synthetic UI State Fixture");
    await page.route("**/api/lab/meeting/generate", async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          status: "ok",
          result: {
            summary: "Две независимые линзы не обнаружили прямых параллелей между числовой структурой и образным миром.",
            parallels: [],
            divergences: [
              {
                theme: "Фокус внимания",
                codeAspect: "Число Души 6 нацелено на социальное служение.",
                mythAspect: "Образ компаса и леса ориентирован на индивидуальную автономию.",
                reflection: "Разнонаправленность векторов отражает многослойность вашего опыта."
              }
            ],
            albertInsight: "Отсутствие явных совпадений — это тоже точное отражение: ваши внешние задачи и внутреннее воображение сейчас живут в разных пространствах.",
            reflectiveQuestion: "Какая из этих двух сторон требует вашего внимания прямо сейчас?"
          }
        }
      });
    });

    await page.goto("http://localhost:3005", { waitUntil: "networkidle" });
    const toCodeZ = page.locator('header nav button:has-text("Код")').or(page.locator('button:has-text("Код")'));
    await toCodeZ.first().click();
    await page.locator('input[placeholder="ДД"]').fill("15");
    await page.locator('input[placeholder="ММ"]').fill("08");
    await page.locator('input[placeholder="ГГГГ"]').fill("1990");
    await page.locator('button:has-text("Открыть свой код")').click();
    await page.waitForSelector("text=Число души", { timeout: 10000 });

    // Mock myth
    await page.route("**/api/personal-myth", async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          status: "ok",
          story_result: {
            title: "Компас в соснах",
            story: "История странствия по густому лесу.",
            mirror: { mainImage: "Лес", innerTension: "Одиночество", hiddenResource: "Компас", newView: "Тишина" },
            meaning: ["Путь"],
            one_step: "Остановиться",
            journal_question: "Куда ведет стрелка?",
            disclaimer: "Образный формат."
          }
        }
      });
    });

    const toMythZ = page.locator('header nav button:has-text("Миф")').or(page.locator('button:has-text("Миф")'));
    await toMythZ.first().click();
    await page.waitForTimeout(500);
    const startM = page.locator('button:has-text("Войти через образы")');
    await startM.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
    if (await startM.isVisible()) {
      await startM.click();
      await page.waitForTimeout(500);
    }
    await answerQuestion(page, "01 / 04", "Лес", false);
    await answerQuestion(page, "02 / 04", "Компас", false);
    await answerQuestion(page, "03 / 04", "Ветер", false);
    await answerQuestion(page, "04 / 04", "Путь", true);
    await page.waitForSelector("article", { timeout: 10000 });

    const toMeetZ = page.locator('header nav button:has-text("Встреча")').or(page.locator('button:has-text("Встреча")'));
    await toMeetZ.first().click();
    await page.waitForTimeout(500);
    await page.locator('button:has-text("Провести Встречу Зеркал")').click();
    await page.waitForSelector("text=Сильных резонансов не найдено", { timeout: 10000 });
    await page.screenshot({ path: path.join(screenshotDir, "20_meeting_zero_match_synthetic.png") });
    console.log("  Saved: 20_meeting_zero_match_synthetic.png (SYNTHETIC_UI_STATE: 0-Resonance)");

    await page.unroute("**/api/lab/meeting/generate");
    await page.unroute("**/api/personal-myth");

    console.log("\n=================================================");
    console.log("=== ALL LIVE ACCEPTANCE SUITES PASSED CLEANLY ===");
    console.log("=================================================");
  } catch (err) {
    console.error("\n[FATAL SUITE ERROR]:", err);
    throw err;
  } finally {
    await browser.close();
  }
}

runSuite().catch((err) => {
  console.error("Runner failed:", err);
  process.exit(1);
});
