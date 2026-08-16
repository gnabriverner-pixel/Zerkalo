const { chromium } = require("@playwright/test");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");
const dotenv = require("dotenv");

const repoRoot = path.resolve(__dirname, "..");
const evidenceDir = path.join(repoRoot, "docs/evidence/deepseek-provider-consolidation");
const screenshotDir = path.join(evidenceDir, "screenshots");
fs.mkdirSync(screenshotDir, { recursive: true });

async function completeMythStepper(page, answers) {
  console.log("  [Myth Stepper] Starting questionnaire...");
  const introBtn = page.locator('button:has-text("Войти через образы")');
  await introBtn.waitFor({ state: "visible", timeout: 8000 }).catch(() => {});
  if (await introBtn.isVisible()) {
    await introBtn.click();
    await page.waitForTimeout(600);
  }

  const questions = [
    { tag: "01 / 04", text: answers.q1 },
    { tag: "02 / 04", text: answers.q2 },
    { tag: "03 / 04", text: answers.q3 },
    { tag: "04 / 04", text: answers.q4 },
  ];

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    console.log(`  [Myth Stepper] Filling step ${q.tag}...`);
    await page.waitForSelector(`text=${q.tag}`, { timeout: 15000 });
    const textarea = page.locator("textarea");
    await textarea.waitFor({ state: "visible" });
    await textarea.fill(q.text);
    await page.waitForTimeout(300);

    const isLast = i === questions.length - 1;
    const btnText = isLast ? "Сплести историю" : "Продолжить";
    const nextBtn = page.locator(`button:has-text("${btnText}")`);
    await nextBtn.waitFor({ state: "visible" });
    
    if (isLast) {
      const responsePromise = page.waitForResponse(
        (res) => res.url().includes("/api/personal-myth") && res.status() === 200,
        { timeout: 60000 }
      );
      await nextBtn.click();
      console.log("  [Myth Stepper] Waiting for /api/personal-myth response...");
      const res = await responsePromise;
      const json = await res.json();
      return json;
    } else {
      await nextBtn.click();
      await page.waitForTimeout(600);
    }
  }
}

async function fillCodeDate(page, d, m, y) {
  console.log(`  [Code Input] Filling DOB ${d}.${m}.${y}...`);
  const dayInput = page.locator('input[placeholder="ДД"]');
  const monthInput = page.locator('input[placeholder="ММ"]');
  const yearInput = page.locator('input[placeholder="ГГГГ"]');
  
  await dayInput.waitFor({ state: "visible", timeout: 10000 });
  await dayInput.fill(d);
  await monthInput.fill(m);
  await yearInput.fill(y);
  await page.waitForTimeout(300);

  const calcBtn = page.locator('button:has-text("Открыть свой код"), button:has-text("Рассчитать код")').first();
  await calcBtn.click();
  await page.waitForSelector('text=Число души', { timeout: 30000 });
  await page.waitForTimeout(600);
}

async function runAcceptance() {
  console.log("====================================================================");
  console.log("=== ISSUE #18: DEEPSEEK PROVIDER CONSOLIDATION ACCEPTANCE RUN ===");
  console.log("====================================================================");

  const envConfig = dotenv.parse(fs.readFileSync(path.join(repoRoot, ".env")));
  const port = 3020;

  // Start Main Live Server
  const mainServer = spawn("npx", ["tsx", "server.ts"], {
    cwd: repoRoot,
    env: { ...process.env, ...envConfig, PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"],
  });

  await new Promise((r) => setTimeout(r, 3000));

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const provenance = {
    consolidation_timestamp: new Date().toISOString(),
    execution_environment: "live_node_express_playwright",
    canonical_runtime_provider: "deepseek",
    google_production_dependency: "none",
    runs: {},
  };

  try {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();

    // -------------------------------------------------------------
    // Preflight Health Verification
    // -------------------------------------------------------------
    console.log("\n[Preflight] Verifying /health & /health/ready on live server...");
    const healthRes = await fetch(`http://localhost:${port}/health`);
    const healthJson = await healthRes.json();
    console.log("  /health response:", healthJson);
    if (healthJson.google_production_dependency !== "none") {
      throw new Error("Preflight failed: google_production_dependency is not none");
    }

    const readyRes = await fetch(`http://localhost:${port}/health/ready`);
    const readyJson = await readyRes.json();
    console.log("  /health/ready response:", readyJson);
    if (readyRes.status !== 200 || readyJson.status !== "ready") {
      throw new Error("Preflight failed: /health/ready did not return ready status");
    }

    provenance.preflight = {
      health: healthJson,
      health_ready: readyJson,
      verified_at: new Date().toISOString(),
    };

    // -------------------------------------------------------------
    // ROUTE A: Personal Myth (DeepSeek) -> Code -> Meeting (DeepSeek) -> Albert (DeepSeek)
    // -------------------------------------------------------------
    console.log("\n[Route A] Starting Myth -> Code -> Meeting -> Albert...");
    await page.goto(`http://localhost:${port}`);
    await page.waitForLoadState("networkidle");

    // Click Myth from Entry / Nav
    const mythNavBtn = page.locator('button:has-text("Миф"), button:has-text("Сказка")').first();
    await mythNavBtn.click();
    await page.waitForTimeout(500);

    // Step 1..4 answers
    const capturedMythA = await completeMythStepper(page, {
      q1: "ощущение развилки и поиск устойчивости",
      q2: "старый каменный мост через горную реку",
      q3: "долгая вечерняя прогулка в полной тишине",
      q4: "внутренней ясности и спокойного терпения",
    });

    console.log("  [Route A] Captured Myth live response:", {
      status: capturedMythA.status,
      provider: capturedMythA.provider,
      model: capturedMythA.model,
      title: capturedMythA.story_result?.title,
    });

    // Assert live response structure
    if (capturedMythA.status !== "ok" || capturedMythA.provider !== "deepseek" || capturedMythA.model !== "deepseek-v4-pro") {
      throw new Error(`Route A Myth response assertion failed: ${JSON.stringify(capturedMythA)}`);
    }

    await page.waitForSelector('text=Символические истоки', { timeout: 15000 });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(screenshotDir, "route_a_1_myth.png") });
    console.log("  ✓ Captured route_a_1_myth.png");

    // Switch to Code (Alabaster)
    const codeNavBtn = page.locator('nav button:has-text("Код")').first();
    await codeNavBtn.click();
    await page.waitForTimeout(500);

    // Enter DOB in Code
    await fillCodeDate(page, "15", "08", "1990");
    await page.screenshot({ path: path.join(screenshotDir, "route_a_2_code.png") });
    console.log("  ✓ Captured route_a_2_code.png");

    // Go to Meeting
    const toMeetingFromCode = page.locator('button:has-text("Открыть Встречу зеркал"), button:has-text("К зеркалам")').first();
    await toMeetingFromCode.click();
    await page.waitForTimeout(500);

    const meetingNavBtn = page.locator('nav button:has-text("Встреча")').first();
    if (await meetingNavBtn.isVisible()) {
      await meetingNavBtn.click();
      await page.waitForTimeout(500);
    }

    const synthBtn = page.locator('button:has-text("Встречу"), button:has-text("Синтез")').first();
    await synthBtn.waitFor({ state: "visible", timeout: 10000 });
    console.log("  [Route A] Running Meeting DeepSeek synthesis...");
    const meetingPromiseA = page.waitForResponse(
      (res) => res.url().includes("/api/lab/meeting/generate") && res.status() === 200,
      { timeout: 60000 }
    );
    await synthBtn.click();
    const meetingResA = await meetingPromiseA;
    const capturedMeetingA = await meetingResA.json();
    console.log("  [Route A] Captured Meeting live response:", {
      status: capturedMeetingA.status,
      provider: capturedMeetingA.provider,
      model: capturedMeetingA.model,
      summary: capturedMeetingA.meeting?.summary?.slice(0, 60),
      parallels: capturedMeetingA.meeting?.parallels?.length,
    });

    if (capturedMeetingA.status !== "ok" || capturedMeetingA.provider !== "deepseek" || capturedMeetingA.model !== "deepseek-v4-pro") {
      throw new Error(`Route A Meeting response assertion failed: ${JSON.stringify(capturedMeetingA)}`);
    }

    await page.waitForSelector('text=Итог ·', { timeout: 15000 });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(screenshotDir, "route_a_3_meeting.png") });
    console.log("  ✓ Captured route_a_3_meeting.png");

    // Open Albert Dialogue
    const albertBtn = page.locator('button:has-text("Диалог на сайте")').first();
    await albertBtn.waitFor({ state: "visible", timeout: 10000 });
    console.log("  [Route A] Opening Albert Dialogue...");
    await albertBtn.click();
    await page.waitForTimeout(1000);

    // Send a question to Albert
    const albertInput = page.locator('input[placeholder*="Задайте вопрос Альберту"]').first();
    await albertInput.waitFor({ state: "visible", timeout: 10000 });
    await albertInput.fill("Как соединить структуру расчета с образом моста?");
    await page.waitForTimeout(300);
    
    const albertPromiseA = page.waitForResponse(
      (res) => res.url().includes("/api/albert/dialogue") && res.status() === 200,
      { timeout: 45000 }
    );
    const sendBtn = page.locator('button[type="submit"]').first();
    await sendBtn.click();

    console.log("  [Route A] Waiting for Albert DeepSeek dialogue response...");
    const albertResA = await albertPromiseA;
    const capturedAlbertA = await albertResA.json();
    console.log("  [Route A] Captured Albert live response:", {
      status: capturedAlbertA.status,
      provider: capturedAlbertA.provider,
      model: capturedAlbertA.model,
      message_snippet: capturedAlbertA.message?.slice(0, 80),
      ends_with_q: capturedAlbertA.message?.trim().endsWith("?"),
    });

    if (capturedAlbertA.status !== "ok" || capturedAlbertA.provider !== "deepseek" || capturedAlbertA.model !== "deepseek-v4-pro") {
      throw new Error(`Route A Albert response assertion failed: ${JSON.stringify(capturedAlbertA)}`);
    }
    if (!capturedAlbertA.message?.trim().endsWith("?")) {
      throw new Error(`Route A Albert message did not end with '?': ${capturedAlbertA.message}`);
    }

    await page.waitForSelector('div.rounded-full:has-text("АВ")', { timeout: 15000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(screenshotDir, "route_a_4_albert.png") });
    console.log("  ✓ Captured route_a_4_albert.png");

    // Close modal
    const closeBtn = page.locator('button:has(svg.lucide-x), button:has-text("✕")').first();
    if (await closeBtn.isVisible()) await closeBtn.click();
    await page.waitForTimeout(500);

    provenance.runs.route_a = {
      status: "success",
      personal_myth: {
        status: capturedMythA.status,
        provider: capturedMythA.provider,
        model: capturedMythA.model,
        title: capturedMythA.story_result?.title,
        word_count: capturedMythA.story_result?.story?.split(/\s+/).length,
      },
      code: {
        dob: "15.08.1990",
        calculated: true,
      },
      meeting_of_mirrors: {
        status: capturedMeetingA.status,
        provider: capturedMeetingA.provider,
        model: capturedMeetingA.model,
        parallels_count: capturedMeetingA.meeting?.parallels?.length,
        divergences_count: capturedMeetingA.meeting?.divergences?.length,
        summary_snippet: capturedMeetingA.meeting?.summary?.slice(0, 80),
      },
      albert_dialogue: {
        status: capturedAlbertA.status,
        provider: capturedAlbertA.provider,
        model: capturedAlbertA.model,
        message_length: capturedAlbertA.message?.length,
        ends_with_question: capturedAlbertA.message?.trim().endsWith("?"),
      },
      verified_at: new Date().toISOString(),
    };

    // -------------------------------------------------------------
    // ROUTE B: Code -> Myth (DeepSeek) -> Meeting (DeepSeek) -> Albert (DeepSeek)
    // -------------------------------------------------------------
    console.log("\n[Route B] Starting Code -> Myth -> Meeting -> Albert...");
    await page.goto(`http://localhost:${port}`);
    await page.waitForLoadState("networkidle");

    // Enter Code first
    const codeNavBtnB = page.locator('button:has-text("Код"), button:has-text("Цифровой код")').first();
    await codeNavBtnB.click();
    await page.waitForTimeout(500);

    await fillCodeDate(page, "07", "03", "1988");
    await page.screenshot({ path: path.join(screenshotDir, "route_b_1_code.png") });
    console.log("  ✓ Captured route_b_1_code.png");

    // Go to Myth
    const toMythBtnB = page.locator('button:has-text("Перейти к Личному мифу"), button:has-text("К зеркалам")').first();
    await toMythBtnB.click();
    await page.waitForTimeout(500);

    const mythNavBtnB = page.locator('nav button:has-text("Миф")').first();
    if (await mythNavBtnB.isVisible()) {
      await mythNavBtnB.click();
      await page.waitForTimeout(500);
    }

    const capturedMythB = await completeMythStepper(page, {
      q1: "напряжение перед новым шагом",
      q2: "открытая терраса над сосновым лесом",
      q3: "утренний чай в полной тишине",
      q4: "внутренней собранности и прямоты",
    });

    console.log("  [Route B] Captured Myth live response:", {
      status: capturedMythB.status,
      provider: capturedMythB.provider,
      model: capturedMythB.model,
      title: capturedMythB.story_result?.title,
    });

    if (capturedMythB.status !== "ok" || capturedMythB.provider !== "deepseek" || capturedMythB.model !== "deepseek-v4-pro") {
      throw new Error(`Route B Myth response assertion failed: ${JSON.stringify(capturedMythB)}`);
    }

    await page.waitForSelector('text=Символические истоки', { timeout: 15000 });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(screenshotDir, "route_b_2_myth.png") });
    console.log("  ✓ Captured route_b_2_myth.png");

    // Go to Meeting
    const toMeetingBtnB = page.locator('button:has-text("Открыть Встречу зеркал"), button:has-text("Встречу"), nav button:has-text("Встреча")').first();
    await toMeetingBtnB.click();
    await page.waitForTimeout(600);

    const synthBtnB = page.locator('button:has-text("Встречу"), button:has-text("Синтез")').first();
    await synthBtnB.waitFor({ state: "visible", timeout: 10000 });
    console.log("  [Route B] Running Meeting DeepSeek synthesis...");
    const meetingPromiseB = page.waitForResponse(
      (res) => res.url().includes("/api/lab/meeting/generate") && res.status() === 200,
      { timeout: 60000 }
    );
    await synthBtnB.click();
    const meetingResB = await meetingPromiseB;
    const capturedMeetingB = await meetingResB.json();
    console.log("  [Route B] Captured Meeting live response:", {
      status: capturedMeetingB.status,
      provider: capturedMeetingB.provider,
      model: capturedMeetingB.model,
      summary: capturedMeetingB.meeting?.summary?.slice(0, 60),
      parallels: capturedMeetingB.meeting?.parallels?.length,
    });

    if (capturedMeetingB.status !== "ok" || capturedMeetingB.provider !== "deepseek" || capturedMeetingB.model !== "deepseek-v4-pro") {
      throw new Error(`Route B Meeting response assertion failed: ${JSON.stringify(capturedMeetingB)}`);
    }

    await page.waitForSelector('text=Итог ·', { timeout: 15000 });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(screenshotDir, "route_b_3_meeting.png") });
    console.log("  ✓ Captured route_b_3_meeting.png");

    // Open Albert Dialogue
    const albertBtnB = page.locator('button:has-text("Диалог на сайте")').first();
    await albertBtnB.waitFor({ state: "visible", timeout: 10000 });
    console.log("  [Route B] Opening Albert Dialogue...");
    await albertBtnB.click();
    await page.waitForTimeout(1000);

    // Send question to Albert
    const albertInputB = page.locator('input[placeholder*="Задайте вопрос Альберту"]').first();
    await albertInputB.waitFor({ state: "visible", timeout: 10000 });
    await albertInputB.fill("Почему я всё время оказываюсь между двумя противоположными состояниями?");
    await page.waitForTimeout(300);

    const albertPromiseB = page.waitForResponse(
      (res) => res.url().includes("/api/albert/dialogue") && res.status() === 200,
      { timeout: 60000 }
    );
    const sendBtnB = page.locator('button[type="submit"]').first();
    await sendBtnB.click();

    console.log("  [Route B] Waiting for Albert DeepSeek dialogue response...");
    const albertResB = await albertPromiseB;
    const capturedAlbertB = await albertResB.json();
    console.log("  [Route B] Captured Albert live response:", {
      status: capturedAlbertB.status,
      provider: capturedAlbertB.provider,
      model: capturedAlbertB.model,
      message_snippet: capturedAlbertB.message?.slice(0, 80),
      ends_with_q: capturedAlbertB.message?.trim().endsWith("?"),
    });

    if (capturedAlbertB.status !== "ok" || capturedAlbertB.provider !== "deepseek" || capturedAlbertB.model !== "deepseek-v4-pro") {
      throw new Error(`Route B Albert response assertion failed: ${JSON.stringify(capturedAlbertB)}`);
    }
    if (!capturedAlbertB.message?.trim().endsWith("?")) {
      throw new Error(`Route B Albert message did not end with '?': ${capturedAlbertB.message}`);
    }

    await page.waitForSelector('div.rounded-full:has-text("АВ")', { timeout: 15000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(screenshotDir, "route_b_4_albert.png") });
    console.log("  ✓ Captured route_b_4_albert.png");

    provenance.runs.route_b = {
      status: "success",
      code: {
        dob: "07.03.1988",
        calculated: true,
      },
      personal_myth: {
        status: capturedMythB.status,
        provider: capturedMythB.provider,
        model: capturedMythB.model,
        title: capturedMythB.story_result?.title,
        word_count: capturedMythB.story_result?.story?.split(/\s+/).length,
      },
      meeting_of_mirrors: {
        status: capturedMeetingB.status,
        provider: capturedMeetingB.provider,
        model: capturedMeetingB.model,
        parallels_count: capturedMeetingB.meeting?.parallels?.length,
        divergences_count: capturedMeetingB.meeting?.divergences?.length,
        summary_snippet: capturedMeetingB.meeting?.summary?.slice(0, 80),
      },
      albert_dialogue: {
        status: capturedAlbertB.status,
        provider: capturedAlbertB.provider,
        model: capturedAlbertB.model,
        message_length: capturedAlbertB.message?.length,
        ends_with_question: capturedAlbertB.message?.trim().endsWith("?"),
      },
      verified_at: new Date().toISOString(),
    };

    // -------------------------------------------------------------
    // Controlled Failure Scenario C: Meeting Unavailable & State Preservation
    // -------------------------------------------------------------
    console.log("\n[Controlled Failure C] Testing Meeting 503 unavailable with completed Code + Myth state preservation...");
    const failContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
    });
    const failPage = await failContext.newPage();
    await failPage.goto(`http://localhost:${port}`);
    await failPage.waitForLoadState("networkidle");

    // 1. Calculate Code
    const failCodeBtn = failPage.locator('button:has-text("Код"), button:has-text("Цифровой код")').first();
    await failCodeBtn.click();
    await fillCodeDate(failPage, "11", "11", "1991");

    // 2. Complete Myth
    const failToMythBtn = failPage.locator('button:has-text("Перейти к Личному мифу"), button:has-text("К зеркалам")').first();
    await failToMythBtn.click();
    await failPage.waitForTimeout(500);

    const failMythNavBtn = failPage.locator('nav button:has-text("Миф")').first();
    if (await failMythNavBtn.isVisible()) {
      await failMythNavBtn.click();
      await failPage.waitForTimeout(500);
    }

    await completeMythStepper(failPage, {
      q1: "поиск новой опоры",
      q2: "каменный маяк на скалистом берегу",
      q3: "вечерний свет перед закатом",
      q4: "уверенности и спокойного дыхания",
    });
    await failPage.waitForSelector('text=Символические истоки', { timeout: 15000 });

    // 3. Intercept Meeting endpoint to simulate 503 provider unavailability
    await failPage.route("**/api/lab/meeting/generate", async (route) => {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          error: true,
          code: "meeting_provider_not_ready",
          ui: { safe_message: "Встреча зеркал сейчас недоступна (провайдер генерации не настроен). Ваши результаты сохранены — попробуйте снова позже." },
        }),
      });
    });

    // 4. Open Meeting and trigger synthesis
    const failToMeetingBtn = failPage.locator('button:has-text("Открыть Встречу зеркал"), button:has-text("Встречу"), nav button:has-text("Встреча")').first();
    await failToMeetingBtn.click();
    await failPage.waitForTimeout(600);

    const failSynthBtn = failPage.locator('button:has-text("Встречу"), button:has-text("Синтез")').first();
    await failSynthBtn.click();
    
    // Assert honest error appears
    await failPage.waitForSelector('text=Встреча зеркал сейчас недоступна', { timeout: 10000 });
    
    // Assert no fake result is shown
    const fakeMeetingResultVisible = await failPage.locator('text=Итог ·').isVisible();
    if (fakeMeetingResultVisible) {
      throw new Error("Meeting failure produced fake meeting result!");
    }

    await failPage.screenshot({ path: path.join(screenshotDir, "meeting_unavailable_honest_state.png") });
    console.log("  ✓ Captured meeting_unavailable_honest_state.png");

    // 5. Assert Code and Myth remain intact and recoverable
    const checkMythBtn = failPage.locator('nav button:has-text("Миф")').first();
    await checkMythBtn.click();
    await failPage.waitForTimeout(500);
    const mythIntact = await failPage.locator('article').isVisible();
    console.log("  [Controlled Failure C] Myth state preserved after meeting failure:", mythIntact);
    if (!mythIntact) {
      throw new Error("Myth state was corrupted/lost after Meeting failure!");
    }

    const checkCodeBtn = failPage.locator('nav button:has-text("Код")').first();
    await checkCodeBtn.click();
    await failPage.waitForTimeout(500);
    const codeIntact = await failPage.locator('text=Число души').isVisible();
    console.log("  [Controlled Failure C] Code state preserved after meeting failure:", codeIntact);
    if (!codeIntact) {
      throw new Error("Code state was corrupted/lost after Meeting failure!");
    }

    provenance.runs.failure_c_meeting_unavailable = {
      http_status: 503,
      code: "meeting_provider_not_ready",
      honest_error_rendered: true,
      no_fake_result: !fakeMeetingResultVisible,
      myth_preserved: mythIntact,
      code_preserved: codeIntact,
      lenses_intact: mythIntact && codeIntact,
      verified_at: new Date().toISOString(),
    };

    // -------------------------------------------------------------
    // Controlled Failure Scenario D: Albert Unavailable & Meeting Preservation
    // -------------------------------------------------------------
    console.log("\n[Controlled Failure D] Testing Albert 503 unavailable with completed Meeting preservation...");
    // Go back to Meeting in Route A / failPage
    // Unroute meeting API first
    await failPage.unroute("**/api/lab/meeting/generate");

    // Intercept Albert endpoint
    await failPage.route("**/api/albert/dialogue", async (route) => {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          error: true,
          code: "albert_provider_not_ready",
          ui: { safe_message: "Собеседник Альберт сейчас недоступен (провайдер генерации не настроен). Ваши результаты сохранены." },
        }),
      });
    });

    const returnMeetingBtn = failPage.locator('button:has-text("Открыть Встречу зеркал"), button:has-text("К зеркалам"), nav button:has-text("Встреча")').first();
    await returnMeetingBtn.click();
    await failPage.waitForTimeout(500);

    const navMeeting = failPage.locator('nav button:has-text("Встреча")').first();
    if (await navMeeting.isVisible()) {
      await navMeeting.click();
      await failPage.waitForTimeout(500);
    }

    // Conduct real Meeting synthesis
    const realSynthBtn = failPage.locator('button:has-text("Встречу"), button:has-text("Синтез")').first();
    await realSynthBtn.click();
    await failPage.waitForSelector('text=Итог ·', { timeout: 60000 });
    console.log("  [Controlled Failure D] Meeting completed. Now triggering Albert failure...");

    // Open Albert Dialogue modal
    const openAlbertModal = failPage.locator('button:has-text("Диалог на сайте")').first();
    await openAlbertModal.click();
    await failPage.waitForTimeout(600);

    // Submit question
    const albertInputD = failPage.locator('input[placeholder*="Задайте вопрос Альберту"]').first();
    await albertInputD.fill("Вопрос для проверки недоступности");
    const sendBtnD = failPage.locator('button[type="submit"]').first();
    await sendBtnD.click();

    // Assert honest error in modal
    await failPage.waitForSelector('text=Собеседник Альберт сейчас недоступен', { timeout: 10000 });
    
    // Assert no fake assistant message rendered (initial greeting has 1 avatar bubble, so total <= 1)
    const albertAvatarCount = await failPage.locator('div.rounded-full:has-text("АВ")').count();
    const fakeAssistantVisible = albertAvatarCount > 1;
    if (fakeAssistantVisible) {
      throw new Error("Albert failure produced fake assistant message!");
    }

    await failPage.screenshot({ path: path.join(screenshotDir, "albert_unavailable_honest_state.png") });
    console.log("  ✓ Captured albert_unavailable_honest_state.png");

    // Close modal and assert Meeting remains intact
    const closeAlbertModal = failPage.locator('button:has(svg.lucide-x), button:has-text("✕")').first();
    if (await closeAlbertModal.isVisible()) await closeAlbertModal.click();
    await failPage.waitForTimeout(500);

    const meetingSummaryIntact = await failPage.locator('text=Итог ·').isVisible();
    const parallelsIntact = await failPage.locator('text=Точки смыслового пересечения').isVisible();
    console.log("  [Controlled Failure D] Meeting summary intact after Albert failure:", meetingSummaryIntact);
    console.log("  [Controlled Failure D] Parallels intact after Albert failure:", parallelsIntact);

    if (!meetingSummaryIntact || !parallelsIntact) {
      throw new Error("Meeting state was corrupted/lost after Albert failure!");
    }

    provenance.runs.failure_d_albert_unavailable = {
      http_status: 503,
      code: "albert_provider_not_ready",
      honest_error_rendered: true,
      no_fake_assistant_message: !fakeAssistantVisible,
      meeting_summary_preserved: meetingSummaryIntact,
      parallels_preserved: parallelsIntact,
      meeting_intact: meetingSummaryIntact && parallelsIntact,
      verified_at: new Date().toISOString(),
    };

    console.log("\n====================================================================");
    console.log("=== ALL ISSUE #18 SCENARIOS & PROVENANCE CHECKS PASSED ===");
    console.log("====================================================================");

    // Save PROVIDER_PROVENANCE.json
    fs.writeFileSync(
      path.join(evidenceDir, "PROVIDER_PROVENANCE.json"),
      JSON.stringify(provenance, null, 2),
      "utf-8"
    );

    // Save PROVIDER_CONSOLIDATION_REPORT.md
    const reportMd = `# Production Provider Consolidation Report (Issue #18)

## 1. Summary
- **Canonical Model Suite**: DeepSeek-only (\`deepseek-v4-pro\`)
- **Personal Myth**: \`deepseek-v4-pro\` (via server \`DeepSeekMythProvider\`, single transient transport retry contract)
- **Meeting of Mirrors**: \`deepseek-v4-pro\` (via server \`generateMeetingOfMirrors\`, JSON-grounded synthesis)
- **Albert Dialogue**: \`deepseek-v4-pro\` (via server \`generateAlbertDialogue\`, RP-1 mechanical validation <= 180 words, exactly 1 final question)
- **Google GenAI / Gemini Production Dependency**: **NONE** (\`@google/genai\` purged from \`package.json\` and lockfile, \`.env.example\` and \`README.md\` updated)

## 2. Transport & Retry Architecture
- **Shared Transport**: \`server/deepseek.ts\` (\`DeepSeekClient\`)
- **API Endpoint**: \`https://api.deepseek.com/chat/completions\` (OpenAI-compatible server-side)
- **Retry Policy**:
  - Transient failures (HTTP 408/409/429/5xx, network aborts, timeouts): at most **1 application retry**.
  - Terminal failures (HTTP 400/401/403, missing key, unparseable payload): **0 retries** (fail-closed immediately).
- **Layering**:
  - \`generatePersonalMyth\` no longer stacks transport retry loops. Transport errors propagate immediately. Editorial QA loops (up to 3 attempts) apply solely to content quality/format repair on HTTP 200 responses.

## 3. Albert Dialogue Enforcement (RP-1 Compliance)
- **Mechanical Validation**: \`validateAlbertResponse()\`
  - Word count: 5 <= words <= 180.
  - Question mark count: exactly 1 \`?\` in entire response.
  - Ending: response must end with \`?\`.
- **Editorial Format Repair**: Exactly 1 bounded format repair generation on validation failure before failing closed.

## 4. Live Acceptance Proofs & Viewport Artifacts (390x844)
1. **Route A (Myth -> Code -> Meeting -> Albert)**:
   - Myth Output: \`docs/evidence/deepseek-provider-consolidation/screenshots/route_a_1_myth.png\`
   - Code Output: \`docs/evidence/deepseek-provider-consolidation/screenshots/route_a_2_code.png\`
   - Meeting Synthesis: \`docs/evidence/deepseek-provider-consolidation/screenshots/route_a_3_meeting.png\`
   - Albert Live Dialogue: \`docs/evidence/deepseek-provider-consolidation/screenshots/route_a_4_albert.png\`
2. **Route B (Code -> Myth -> Meeting -> Albert)**:
   - Code Output: \`docs/evidence/deepseek-provider-consolidation/screenshots/route_b_1_code.png\`
   - Myth Output: \`docs/evidence/deepseek-provider-consolidation/screenshots/route_b_2_myth.png\`
   - Meeting Synthesis: \`docs/evidence/deepseek-provider-consolidation/screenshots/route_b_3_meeting.png\`
   - Albert Live Dialogue: \`docs/evidence/deepseek-provider-consolidation/screenshots/route_b_4_albert.png\`
3. **Controlled Provider Failure & State Preservation**:
   - Meeting 503 Provider Unavailable (Lenses Intact): \`docs/evidence/deepseek-provider-consolidation/screenshots/meeting_unavailable_honest_state.png\`
   - Albert 503 Provider Unavailable (Meeting Intact): \`docs/evidence/deepseek-provider-consolidation/screenshots/albert_unavailable_honest_state.png\`
   - Live Captured Provenance Manifest: \`docs/evidence/deepseek-provider-consolidation/PROVIDER_PROVENANCE.json\`
`;

    fs.writeFileSync(path.join(evidenceDir, "PROVIDER_CONSOLIDATION_REPORT.md"), reportMd, "utf-8");

  } finally {
    await browser.close();
    mainServer.kill("SIGTERM");
  }
}

runAcceptance().catch((err) => {
  console.error("Acceptance run failed:", err);
  process.exit(1);
});
