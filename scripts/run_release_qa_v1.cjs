const { chromium } = require("@playwright/test");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");
const dotenv = require("dotenv");

const repoRoot = path.resolve(__dirname, "..");
const evidenceDir = path.join(repoRoot, "docs", "evidence", "release-qa-v1");
const port = 3045;

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
        { timeout: 90000 }
      );
      await nextBtn.click();
      console.log("  [Myth Stepper] Waiting for LIVE /api/personal-myth response...");
      const res = await responsePromise;
      const json = await res.json();
      return json;
    } else {
      await nextBtn.click();
      await page.waitForTimeout(600);
    }
  }
}

async function sendAlbertMessage(page, question) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    console.log(`  [Albert Live Dialogue] Sending attempt ${attempt}: "${question.slice(0, 40)}..."`);
    const albertInput = page.locator('input[placeholder*="Альберту"], textarea[placeholder*="Альберту"]').first();
    await albertInput.waitFor({ state: "visible", timeout: 10000 });
    await albertInput.fill(question);
    
    const albertPromise = page.waitForResponse(
      (res) => res.url().includes("/api/albert/dialogue"),
      { timeout: 90000 }
    );
    const sendAlbertBtn = page.locator('button:has(svg.lucide-send), button:has-text("Отправить")').first();
    await sendAlbertBtn.click();

    const res = await albertPromise;
    if (res.status() === 200) {
      const json = await res.json();
      return json;
    }
    console.log(`  [Albert Live Dialogue] Attempt ${attempt} returned status ${res.status()}, retrying in 2s...`);
    await page.waitForTimeout(2000);
  }
  throw new Error("Failed to get 200 response from /api/albert/dialogue after 3 attempts");
}

async function fillCode(page, d, m, y) {
  console.log(`  [Code Calc] Calculating code for ${d}.${m}.${y}...`);
  const dayInput = page.locator('input[placeholder="ДД"]').first();
  const monthInput = page.locator('input[placeholder="ММ"]').first();
  const yearInput = page.locator('input[placeholder="ГГГГ"]').first();

  await dayInput.waitFor({ state: "visible", timeout: 10000 });
  await dayInput.fill(d);
  await monthInput.fill(m);
  await yearInput.fill(y);

  const submitBtn = page.locator('button:has-text("Открыть свой код"), button[type="submit"]').first();
  await submitBtn.click();
  await page.waitForSelector('text=Акт I · Личная формула', { timeout: 15000 });
  await page.waitForTimeout(600);
}

async function runReleaseQA() {
  console.log("====================================================================");
  console.log("=== ISSUE #21: RELEASE QA V1 — END-TO-END VERIFICATION HARNESS ===");
  console.log("====================================================================\n");

  fs.mkdirSync(evidenceDir, { recursive: true });

  const envConfig = dotenv.parse(fs.readFileSync(path.join(repoRoot, ".env")));

  // Start Server
  const serverProcess = spawn("npx", ["tsx", "server.ts"], {
    cwd: repoRoot,
    env: { ...process.env, ...envConfig, PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"],
  });

  serverProcess.stdout.on("data", (d) => process.stdout.write(`[Server] ${d}`));
  serverProcess.stderr.on("data", (d) => process.stderr.write(`[Server ERR] ${d}`));

  let browser;
  const recordedProvenance = {
    routeA: {},
    routeB: {},
  };
  const consoleErrors = [];

  try {
    // -------------------------------------------------------------
    // Health & Readiness Verification
    // -------------------------------------------------------------
    console.log("[QA-1] Checking /health and /health/ready...");
    let healthy = false;
    let readyData = null;
    for (let i = 0; i < 30; i++) {
      try {
        const hRes = await fetch(`http://localhost:${port}/health`);
        const rRes = await fetch(`http://localhost:${port}/health/ready`);
        if (hRes.ok && rRes.ok) {
          healthy = true;
          readyData = await rRes.json();
          break;
        }
      } catch (e) {}
      await new Promise((r) => setTimeout(r, 500));
    }
    if (!healthy) throw new Error("Server failed health check on port " + port);

    console.log("  ✓ /health and /health/ready returned HTTP 200");
    console.log("  [Readiness Payload]:", JSON.stringify(readyData, null, 2));
    if (
      readyData.status !== "ready" ||
      readyData.providers.personal_myth.provider !== "deepseek" ||
      readyData.providers.meeting.provider !== "deepseek" ||
      readyData.providers.albert.provider !== "deepseek"
    ) {
      throw new Error("Readiness payload failed DeepSeek production contract!");
    }

    browser = await chromium.launch({ headless: true });
    
    // =============================================================
    // ROUTE A: Personal Myth -> Digital Code -> Meeting -> Albert
    // Viewport: 390x844
    // =============================================================
    console.log("\n=============================================================");
    console.log("=== ROUTE A: Personal Myth -> Code -> Meeting -> Web Albert ===");
    console.log("=============================================================");

    const contextA = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
    });
    const pageA = await contextA.newPage();
    pageA.on("pageerror", (err) => consoleErrors.push(`[PageError Route A] ${err.message}`));
    pageA.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(`[ConsoleError Route A] ${msg.text()}`);
    });

    await pageA.goto(`http://localhost:${port}`);
    await pageA.waitForLoadState("networkidle");

    // Screenshot 1: Threshold
    console.log("[Screenshot 1/10] Capturing threshold (01-threshold-390x844.png)...");
    await pageA.screenshot({
      path: path.join(evidenceDir, "01-threshold-390x844.png"),
      clip: { x: 0, y: 0, width: 390, height: 844 },
    });

    // 1. Enter Personal Myth
    console.log("[Route A] Entering Personal Myth...");
    const toMythBtnA = pageA.locator('button:has-text("Войти в миф"), button:has-text("Миф")').first();
    await toMythBtnA.click();
    await pageA.waitForTimeout(500);

    const mythAData = await completeMythStepper(pageA, {
      q1: "поиск гармонии между структурой и творческим потоком",
      q2: "каменный маяк на скале посреди вечернего моря",
      q3: "тишина перед приближающейся грозой",
      q4: "уверенность, глубина и спокойное принятие",
    });

    recordedProvenance.routeA.myth = {
      status: mythAData.status,
      title: mythAData.story_result?.title,
      mainImage: mythAData.story_result?.mirror?.mainImage,
    };
    console.log("  ✓ Live Myth Result received:", recordedProvenance.routeA.myth.title);

    await pageA.waitForSelector('text=Символические истоки', { timeout: 15000 });
    const mythHero = pageA.locator('text=Личный миф').first();
    await mythHero.scrollIntoViewIfNeeded();
    await pageA.waitForTimeout(400);

    // Screenshot 2: Live Myth Result
    console.log("[Screenshot 2/10] Capturing live Myth (02-live-myth-result-390x844.png)...");
    await pageA.screenshot({
      path: path.join(evidenceDir, "02-live-myth-result-390x844.png"),
      clip: { x: 0, y: 0, width: 390, height: 844 },
    });

    // 2. Calculate Digital Code
    console.log("[Route A] Navigating to Digital Code...");
    const navCodeA = pageA.locator('nav button:has-text("Код")').first();
    await navCodeA.click();
    await pageA.waitForTimeout(500);

    await fillCode(pageA, "15", "08", "1990");
    const codeFormula = pageA.locator('text=Акт I · Личная формула').first();
    await codeFormula.scrollIntoViewIfNeeded();
    await pageA.waitForTimeout(400);

    // Screenshot 3: Live Code Result
    console.log("[Screenshot 3/10] Capturing live Code (03-live-code-result-390x844.png)...");
    await pageA.screenshot({
      path: path.join(evidenceDir, "03-live-code-result-390x844.png"),
      clip: { x: 0, y: 0, width: 390, height: 844 },
    });

    // 3. Meeting of Mirrors (Live Synthesis)
    console.log("[Route A] Navigating to Meeting of Mirrors and requesting LIVE synthesis...");
    const toMeetingA = pageA.locator('button:has-text("Открыть Встречу зеркал"), nav button:has-text("Встреча")').first();
    await toMeetingA.click();
    await pageA.waitForTimeout(500);

    const runSynthA = pageA.locator('button:has-text("Встречу"), button:has-text("Синтез")').first();
    
    const meetingPromiseA = pageA.waitForResponse(
      (res) => res.url().includes("/api/lab/meeting/generate") && res.status() === 200,
      { timeout: 90000 }
    );
    await runSynthA.click();
    console.log("  [Meeting] Waiting for LIVE /api/lab/meeting/generate response...");
    const meetingResA = await meetingPromiseA;
    const meetingJsonA = await meetingResA.json();

    recordedProvenance.routeA.meeting = {
      status: meetingJsonA.status,
      summary: meetingJsonA.result?.summary,
      parallelsCount: meetingJsonA.result?.parallels?.length,
      divergencesCount: meetingJsonA.result?.divergences?.length,
    };
    console.log("  ✓ Live Meeting Result received:", recordedProvenance.routeA.meeting.summary);

    await pageA.waitForSelector('text=Различия ракурсов', { timeout: 15000 });
    const meetingSummaryA = pageA.locator('text=Итог ·').first();
    await meetingSummaryA.scrollIntoViewIfNeeded();
    await pageA.waitForTimeout(400);

    // Screenshot 4: Live Meeting
    console.log("[Screenshot 4/10] Capturing live Meeting (04-live-meeting-390x844.png)...");
    await pageA.screenshot({
      path: path.join(evidenceDir, "04-live-meeting-390x844.png"),
      clip: { x: 0, y: 0, width: 390, height: 844 },
    });

    // 4. Web Albert (Live Dialogue)
    console.log("[Route A] Opening Web Albert and sending live question...");
    const openAlbertA = pageA.locator('button:has-text("Диалог на сайте")').first();
    await openAlbertA.scrollIntoViewIfNeeded();
    await openAlbertA.click();

    await pageA.waitForSelector('text=Альберт Вяземский', { timeout: 10000 });
    await pageA.waitForSelector('text=ДУША: 6', { timeout: 10000 });

    const albertJsonA = await sendAlbertMessage(pageA, "В чем главная точка опоры между моим кодом и мифом?");
    recordedProvenance.routeA.albert = {
      status: albertJsonA.status,
      messagePreview: albertJsonA.message?.slice(0, 80),
    };
    console.log("  ✓ Live Albert reply received:", recordedProvenance.routeA.albert.messagePreview);

    await pageA.waitForTimeout(1000);

    // Screenshot 5: Live Albert Reply
    console.log("[Screenshot 5/10] Capturing live Albert reply (05-live-albert-reply-390x844.png)...");
    await pageA.screenshot({
      path: path.join(evidenceDir, "05-live-albert-reply-390x844.png"),
      clip: { x: 0, y: 0, width: 390, height: 844 },
    });

    // Close Albert Modal
    const closeAlbertA = pageA.locator('button:has-text("✕"), button[aria-label="Close"], button:has(svg.lucide-x)').first();
    await closeAlbertA.click();
    await pageA.waitForTimeout(400);

    // -------------------------------------------------------------
    // My Mirror V0 Section inside Live Route A
    // -------------------------------------------------------------
    console.log("\n[Route A -> My Mirror] Testing My Mirror V0 persistence flow...");
    const noteFieldA = pageA.locator('textarea[placeholder*="заметки"], textarea').first();
    await noteFieldA.scrollIntoViewIfNeeded();
    await noteFieldA.fill("Моя личная заметка о встрече зеркал (Route A)");
    await pageA.waitForTimeout(300);

    const saveMirrorBtnA = pageA.locator('button:has-text("Сохранить на этом устройстве")').first();
    await saveMirrorBtnA.click();
    await pageA.waitForSelector('text=Сохранено в этом браузере', { timeout: 5000 });
    await pageA.waitForTimeout(400);

    // Screenshot 6: My Mirror Saved
    console.log("[Screenshot 6/10] Capturing My Mirror saved (06-my-mirror-saved-390x844.png)...");
    await pageA.screenshot({
      path: path.join(evidenceDir, "06-my-mirror-saved-390x844.png"),
      clip: { x: 0, y: 0, width: 390, height: 844 },
    });

    // Note Edit -> Unsaved Badge check
    console.log("  [My Mirror Check] Editing note without save -> must become unsaved...");
    await noteFieldA.fill("Моя отредактированная заметка (Route A, не сохранена)");
    await pageA.waitForTimeout(400);
    const unsavedCheck = await pageA.locator('text=Сохранено в этом браузере').count();
    if (unsavedCheck > 0) throw new Error("Badge stayed saved after note edit!");
    console.log("  ✓ Badge correctly became unsaved");

    // Update Note -> Saved Badge check
    const updateMirrorBtnA = pageA.locator('button:has-text("Обновить сохранённое"), button:has-text("Сохранить на этом устройстве")').first();
    await updateMirrorBtnA.click();
    await pageA.waitForSelector('text=Сохранено в этом браузере', { timeout: 5000 });
    console.log("  ✓ Badge restored after explicit update");

    // Real Page Reload
    console.log("  [My Mirror Check] Performing real page reload...");
    await pageA.reload();
    await pageA.waitForLoadState("networkidle");
    await pageA.waitForTimeout(800);

    // Non-auto-restore check
    const heroA = pageA.locator('h1:has-text("Зеркало себя")').first();
    await heroA.waitFor({ state: "visible", timeout: 10000 });

    const savedCardA = pageA.locator('text=Моё зеркало · Сохранено локально').first();
    await savedCardA.scrollIntoViewIfNeeded();
    await pageA.waitForTimeout(400);

    // Screenshot 7: Reload Saved Entry
    console.log("[Screenshot 7/10] Capturing reload saved entry (07-reload-saved-entry-390x844.png)...");
    await pageA.screenshot({
      path: path.join(evidenceDir, "07-reload-saved-entry-390x844.png"),
      clip: { x: 0, y: 0, width: 390, height: 844 },
    });

    // Explicit Restore with 0 Provider Calls Assertion
    console.log("  [My Mirror Check] Restoring saved mirror and asserting 0 provider calls...");
    const providerCallsOnRestore = [];
    pageA.on("request", (req) => {
      if (req.url().includes("/api/personal-myth") || req.url().includes("/api/lab/meeting/generate")) {
        providerCallsOnRestore.push(req.url());
      }
    });

    const openSavedA = pageA.locator('button:has-text("Открыть сохранённое")').first();
    await openSavedA.click();
    await pageA.waitForSelector('text=Встреча Зеркал', { timeout: 10000 });
    await pageA.waitForSelector('text=Различия ракурсов', { timeout: 10000 });
    await pageA.waitForTimeout(500);

    console.log(`  ✓ Provider calls on restore: ${providerCallsOnRestore.length}`);
    if (providerCallsOnRestore.length > 0) {
      throw new Error("Provider calls detected on restore: " + providerCallsOnRestore.join(", "));
    }

    // Screenshot 8: Restored Meeting
    console.log("[Screenshot 8/10] Capturing restored Meeting (08-restored-meeting-390x844.png)...");
    const restoredMeetingTitle = pageA.locator('text=Итог ·').first();
    await restoredMeetingTitle.scrollIntoViewIfNeeded();
    await pageA.waitForTimeout(400);
    await pageA.screenshot({
      path: path.join(evidenceDir, "08-restored-meeting-390x844.png"),
      clip: { x: 0, y: 0, width: 390, height: 844 },
    });

    // Delete Snapshot at end of Route A
    const deleteSavedBtnA = pageA.locator('button:has-text("Удалить сохранённое")').first();
    await deleteSavedBtnA.scrollIntoViewIfNeeded();
    await deleteSavedBtnA.click();
    await pageA.waitForTimeout(500);
    const keyAfterDelete = await pageA.evaluate(() => localStorage.getItem("zerkalo.myMirror.v1"));
    if (keyAfterDelete !== null) throw new Error("Storage key not removed after delete!");
    console.log("  ✓ Snapshot deleted cleanly");

    await contextA.close();

    // =============================================================
    // ROUTE B: Digital Code -> Personal Myth -> Meeting -> Albert
    // Viewport: 390x844
    // =============================================================
    console.log("\n=============================================================");
    console.log("=== ROUTE B: Code -> Personal Myth -> Meeting -> Web Albert ===");
    console.log("=============================================================");

    const contextB = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
    });
    const pageB = await contextB.newPage();
    pageB.on("pageerror", (err) => consoleErrors.push(`[PageError Route B] ${err.message}`));
    pageB.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(`[ConsoleError Route B] ${msg.text()}`);
    });

    await pageB.goto(`http://localhost:${port}`);
    await pageB.waitForLoadState("networkidle");

    // 1. Digital Code First (21.11.1988)
    console.log("[Route B] Calculating Digital Code (21.11.1988)...");
    await fillCode(pageB, "21", "11", "1988");
    await pageB.waitForSelector('text=Акт I · Личная формула', { timeout: 15000 });

    // 2. Personal Myth Second
    console.log("[Route B] Navigating to Personal Myth...");
    const toMythB = pageB.locator('button:has-text("Перейти к Личному мифу"), button:has-text("К зеркалам")').first();
    await toMythB.click();
    await pageB.waitForTimeout(500);

    const navMythB = pageB.locator('nav button:has-text("Миф")').first();
    if (await navMythB.isVisible()) {
      await navMythB.click();
      await pageB.waitForTimeout(500);
    }

    const mythBData = await completeMythStepper(pageB, {
      q1: "стремление создавать долговечные и ясные структуры",
      q2: "старинная обсерватория на вершине горы под звездным небом",
      q3: "ночной холод и чистое безмолвие пространства",
      q4: "точность, глубина понимания и внутренний покой",
    });

    recordedProvenance.routeB.myth = {
      status: mythBData.status,
      title: mythBData.story_result?.title,
      mainImage: mythBData.story_result?.mirror?.mainImage,
    };
    console.log("  ✓ Route B Live Myth Result received:", recordedProvenance.routeB.myth.title);

    // 3. Meeting of Mirrors (Live Synthesis)
    console.log("[Route B] Navigating to Meeting of Mirrors and requesting LIVE synthesis...");
    const toMeetingB = pageB.locator('button:has-text("Открыть Встречу зеркал"), button:has-text("К зеркалам"), nav button:has-text("Встреча")').first();
    await toMeetingB.click();
    await pageB.waitForTimeout(500);

    const navMeetingB = pageB.locator('nav button:has-text("Встреча")').first();
    if (await navMeetingB.isVisible()) {
      await navMeetingB.click();
      await pageB.waitForTimeout(500);
    }

    const runSynthB = pageB.locator('button:has-text("Встречу"), button:has-text("Синтез")').first();
    const meetingPromiseB = pageB.waitForResponse(
      (res) => res.url().includes("/api/lab/meeting/generate") && res.status() === 200,
      { timeout: 90000 }
    );
    await runSynthB.click();
    console.log("  [Meeting Route B] Waiting for LIVE /api/lab/meeting/generate response...");
    const meetingResB = await meetingPromiseB;
    const meetingJsonB = await meetingResB.json();

    recordedProvenance.routeB.meeting = {
      status: meetingJsonB.status,
      summary: meetingJsonB.result?.summary,
      parallelsCount: meetingJsonB.result?.parallels?.length,
      divergencesCount: meetingJsonB.result?.divergences?.length,
    };
    console.log("  ✓ Route B Live Meeting Result received:", recordedProvenance.routeB.meeting.summary);

    // 4. Web Albert (Live Dialogue)
    console.log("[Route B] Opening Web Albert and sending live question...");
    const openAlbertB = pageB.locator('button:has-text("Диалог на сайте")').first();
    await openAlbertB.scrollIntoViewIfNeeded();
    await openAlbertB.click();

    await pageB.waitForSelector('text=Альберт Вяземский', { timeout: 10000 });
    await pageB.waitForSelector('text=ДУША: 3', { timeout: 10000 });

    const albertJsonB = await sendAlbertMessage(pageB, "Как связать мою склонность к порядку с образами обсерватории?");
    recordedProvenance.routeB.albert = {
      status: albertJsonB.status,
      messagePreview: albertJsonB.message?.slice(0, 80),
    };
    console.log("  ✓ Route B Live Albert reply received:", recordedProvenance.routeB.albert.messagePreview);

    await contextB.close();

    // =============================================================
    // SECTION E: Controlled Failure Smoke
    // Explicit classification: SYNTHETIC_FAILURE_STATE
    // =============================================================
    console.log("\n=============================================================");
    console.log("=== SECTION E: Controlled Failure Smoke (SYNTHETIC_FAILURE) ===");
    console.log("=============================================================");

    const contextFail = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
    });
    const pageFail = await contextFail.newPage();
    await pageFail.goto(`http://localhost:${port}`);
    await pageFail.waitForLoadState("networkidle");

    // 1. Force Meeting 503 Failure
    console.log("[Failure Smoke 1] Restoring snapshot, invalidating in-memory meeting, and simulating Meeting 503 error...");
    
    // Inject full valid snapshot into localStorage
    const sampleSnapshotFailSetup = {
      version: 1,
      savedAt: new Date().toISOString(),
      codeDate: "15.08.1990",
      codeResult: {
        soul: 6,
        soulComposite: "15/6",
        path: 33,
        pathComposite: "33",
        direction: 3,
        directionComposite: "39/12/3",
        expression: 5,
        expressionComposite: "23/5",
        result: 6,
        resultComposite: "6",
        baseMatrix: { "1": 2, "5": 1 },
        detailedMatrix: { "1": 2, "5": 1, "8": 1 }
      },
      firstMirror: {
        title: "Ваш цифровой код собран",
        subtitle: "Архитектурный разбор матрицы",
        formula: {
          numbers: "6 / 5 / 33 / 3 / 6",
          planets: "Венера / Меркурий / Учитель / Юпитер / Венера",
          positions: "Душа / Выражение / Путь / Направление / Результат"
        },
        blocks: [
          { id: "main_pattern", title: "Главный узор", text: "Ядро матрицы опирается на связку 6 и 33" }
        ],
        keyInsight: "Главная тема этой архитектуры — не масштаб ради масштаба",
        strengthTags: ["Глубина"],
        tensionTags: ["Контроль"],
        practicalStep: "Оставить одно решение без немедленного контроля",
        cta: { title: "Переход", text: "Исследуйте", button: "Далее" },
        disclaimer: "Ориентировочно"
      },
      storyInputs: {
        q1: "поиск баланса",
        q2: "маяк",
        q3: "тишина",
        q4: "глубина"
      },
      storyResult: {
        title: "Хранитель маяка",
        story: "История о поиске внутренней тишины...",
        mirror: {
          mainImage: "Каменный маяк",
          innerTension: "Шторм и тишина",
          hiddenResource: "Непоколебимая ось",
          newView: "Доверие стихии"
        },
        meaning: ["Опора внутри"],
        one_step: "Сделать паузу",
        journal_question: "Что удерживает свет?",
        disclaimer: "Метафора"
      },
      meetingResult: {
        summary: "Встреча двух линз выявляет устойчивую связь между структурой и образом.",
        hasStrongParallels: true,
        confidenceNote: "Высокая согласованность",
        reflectiveQuestion: "Какая опора позволяет удерживать равновесие?",
        albertInsight: "Код фиксирует каркас, Миф дает дыхание.",
        disclaimer: "Синтез носит исследовательский характер",
        parallels: [
          {
            theme: "Удержание внутренней опоры",
            codeAnchor: "Число Души 6 и Путь 33",
            mythAnchor: "Образ маяка",
            synthesis: "Оба зеркала сходятся на необходимости оси."
          }
        ],
        divergences: [
          {
            theme: "Динамика контроля",
            codeAspect: "Стратегический контроль",
            mythAspect: "Созерцательное отпускание",
            reflection: "Две стороны единого процесса."
          }
        ]
      }
    };

    await pageFail.evaluate((snap) => {
      localStorage.setItem("zerkalo.myMirror.v1", JSON.stringify(snap));
    }, sampleSnapshotFailSetup);

    await pageFail.reload();
    await pageFail.waitForLoadState("networkidle");

    const restoreFailBtn1 = pageFail.locator('button:has-text("Открыть сохранённое")').first();
    await restoreFailBtn1.waitFor({ state: "visible", timeout: 10000 });
    await restoreFailBtn1.click();
    await pageFail.waitForSelector('text=Встреча Зеркал', { timeout: 10000 });

    // Recalculate code to invalidate active meeting in memory while preserving lenses
    const navCodeF = pageFail.locator('nav button:has-text("Код")').first();
    await navCodeF.click();
    await pageFail.waitForTimeout(500);

    const submitCodeBtnF = pageFail.locator('button:has-text("Рассчитать код"), button:has-text("Открыть свой код"), button:has-text("Другая дата")').first();
    if (await pageFail.locator('button:has-text("Другая дата")').isVisible()) {
      await pageFail.locator('button:has-text("Другая дата")').click();
      await pageFail.waitForTimeout(400);
      await fillCode(pageFail, "05", "05", "1985");
    }
    await pageFail.waitForTimeout(500);

    // Route Meeting to 503
    await pageFail.route("**/api/lab/meeting/generate", async (route) => {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          status: "error",
          ui: { safe_message: "Служба синтеза временно недоступна. Ваши линзы сохранены — попробуйте повторить запрос." },
        }),
      });
    });

    const backBtn = pageFail.locator('button:has-text("К зеркалам")').first();
    await backBtn.waitFor({ state: "visible", timeout: 10000 });
    await backBtn.click();
    await pageFail.waitForSelector('text=Встреча Зеркал', { timeout: 10000 });

    const navMeetingBtn = pageFail.locator('nav button:has-text("Встреча")').first();
    await navMeetingBtn.click({ force: true });
    await pageFail.waitForSelector('button:has-text("Провести Встречу зеркал")', { timeout: 10000 });

    const runSynthF = pageFail.locator('button:has-text("Провести Встречу зеркал")').first();
    await runSynthF.scrollIntoViewIfNeeded();
    await runSynthF.click();

    await pageFail.locator('text=Служба синтеза временно недоступна').first().waitFor({ state: "visible", timeout: 10000 });
    await pageFail.waitForTimeout(400);

    // Assert both lenses are intact
    await pageFail.waitForSelector('text=Сотворено', { timeout: 5000 });
    await pageFail.waitForSelector('text=Линза 1 · Цифровой код', { timeout: 5000 });
    console.log("  ✓ Controlled meeting failure: error displayed, both lenses preserved intact");

    // Screenshot 9: Meeting Failure preserves lenses (SYNTHETIC_FAILURE_STATE)
    console.log("[Screenshot 9/10] Capturing Meeting failure (09-meeting-failure-preserves-lenses-390x844.png)...");
    await pageFail.screenshot({
      path: path.join(evidenceDir, "09-meeting-failure-preserves-lenses-390x844.png"),
      clip: { x: 0, y: 0, width: 390, height: 844 },
    });

    // Unroute Meeting
    await pageFail.unroute("**/api/lab/meeting/generate");

    // For Albert failure test: inject complete snapshot into localStorage and restore
    console.log("[Failure Smoke 2] Restoring Meeting snapshot for Albert failure test...");
    const sampleSnapshotFail = {
      version: 1,
      savedAt: new Date().toISOString(),
      codeDate: "15.08.1990",
      codeResult: {
        soul: 6,
        soulComposite: "15/6",
        path: 33,
        pathComposite: "33",
        direction: 3,
        directionComposite: "39/12/3",
        expression: 5,
        expressionComposite: "23/5",
        result: 6,
        resultComposite: "6",
        baseMatrix: { "1": 2, "5": 1 },
        detailedMatrix: { "1": 2, "5": 1, "8": 1 }
      },
      firstMirror: {
        title: "Ваш цифровой код собран",
        subtitle: "Архитектурный разбор матрицы",
        formula: {
          numbers: "6 / 5 / 33 / 3 / 6",
          planets: "Венера / Меркурий / Учитель / Юпитер / Венера",
          positions: "Душа / Выражение / Путь / Направление / Результат"
        },
        blocks: [
          { id: "main_pattern", title: "Главный узор", text: "Ядро матрицы опирается на связку 6 и 33" }
        ],
        keyInsight: "Главная тема этой архитектуры — не масштаб ради масштаба",
        strengthTags: ["Глубина"],
        tensionTags: ["Контроль"],
        practicalStep: "Оставить одно решение без немедленного контроля",
        cta: { title: "Переход", text: "Исследуйте", button: "Далее" },
        disclaimer: "Ориентировочно"
      },
      storyInputs: {
        q1: "поиск баланса",
        q2: "маяк",
        q3: "тишина",
        q4: "глубина"
      },
      storyResult: {
        title: "Хранитель маяка",
        story: "История о поиске внутренней тишины...",
        mirror: {
          mainImage: "Каменный маяк",
          innerTension: "Шторм и тишина",
          hiddenResource: "Непоколебимая ось",
          newView: "Доверие стихии"
        },
        meaning: ["Опора внутри"],
        one_step: "Сделать паузу",
        journal_question: "Что удерживает свет?",
        disclaimer: "Метафора"
      },
      meetingResult: {
        summary: "Встреча двух линз выявляет устойчивую связь между структурой и образом.",
        hasStrongParallels: true,
        confidenceNote: "Высокая согласованность",
        reflectiveQuestion: "Какая опора позволяет удерживать равновесие?",
        albertInsight: "Код фиксирует каркас, Миф дает дыхание.",
        disclaimer: "Синтез носит исследовательский характер",
        parallels: [
          {
            theme: "Удержание внутренней опоры",
            codeAnchor: "Число Души 6 и Путь 33",
            mythAnchor: "Образ маяка",
            synthesis: "Оба зеркала сходятся на необходимости оси."
          }
        ],
        divergences: [
          {
            theme: "Динамика контроля",
            codeAspect: "Стратегический контроль",
            mythAspect: "Созерцательное отпускание",
            reflection: "Две стороны единого процесса."
          }
        ]
      }
    };

    await pageFail.evaluate((snap) => {
      localStorage.setItem("zerkalo.myMirror.v1", JSON.stringify(snap));
    }, sampleSnapshotFail);

    await pageFail.reload();
    await pageFail.waitForLoadState("networkidle");

    const restoreFailBtn = pageFail.locator('button:has-text("Открыть сохранённое")').first();
    await restoreFailBtn.waitFor({ state: "visible", timeout: 10000 });
    await restoreFailBtn.click();
    await pageFail.waitForSelector('text=Встреча Зеркал', { timeout: 10000 });
    await pageFail.waitForSelector('text=Различия ракурсов', { timeout: 10000 });

    // 2. Force Albert 503 Failure
    console.log("[Failure Smoke 2] Simulating Albert 503 error...");
    await pageFail.route("**/api/albert/dialogue", async (route) => {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          status: "error",
          ui: { safe_message: "Собеседник временно недоступен. Ваши вопросы и результаты сохранены — попробуйте повторить запрос." },
        }),
      });
    });

    const openAlbertF = pageFail.locator('button:has-text("Диалог на сайте")').first();
    await openAlbertF.scrollIntoViewIfNeeded();
    await openAlbertF.click();

    await pageFail.waitForSelector('text=Альберт Вяземский', { timeout: 10000 });
    const albertInputF = pageFail.locator('input[placeholder*="Альберту"], textarea[placeholder*="Альберту"]').first();
    await albertInputF.fill("Тестовый вопрос для проверки сбоя");
    
    const sendAlbertF = pageFail.locator('button:has(svg.lucide-send), button:has-text("Отправить")').first();
    await sendAlbertF.click();

    await pageFail.locator('text=Собеседник временно недоступен').first().waitFor({ state: "visible", timeout: 10000 });
    await pageFail.waitForTimeout(400);

    // Screenshot 10: Albert Failure preserves Meeting (SYNTHETIC_FAILURE_STATE)
    console.log("[Screenshot 10/10] Capturing Albert failure (10-albert-failure-preserves-meeting-390x844.png)...");
    await pageFail.screenshot({
      path: path.join(evidenceDir, "10-albert-failure-preserves-meeting-390x844.png"),
      clip: { x: 0, y: 0, width: 390, height: 844 },
    });

    await contextFail.close();

    // =============================================================
    // SECTION F: Desktop Smoke (1440x900, max 2 screenshots)
    // =============================================================
    console.log("\n=============================================================");
    console.log("=== SECTION F: Desktop Smoke (1440x900) ===");
    console.log("=============================================================");

    const contextDesk = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2,
    });
    const pageDesk = await contextDesk.newPage();
    await pageDesk.goto(`http://localhost:${port}`);
    await pageDesk.waitForLoadState("networkidle");

    // Screenshot 11: Desktop Threshold
    console.log("[Desktop Screenshot 1/2] Capturing desktop threshold (11-desktop-threshold-1440x900.png)...");
    await pageDesk.screenshot({
      path: path.join(evidenceDir, "11-desktop-threshold-1440x900.png"),
    });

    // Inject Meeting to capture completed Meeting on desktop
    const sampleSnapshotDesk = {
      version: 1,
      savedAt: new Date().toISOString(),
      codeDate: "15.08.1990",
      codeResult: {
        soul: 6,
        soulComposite: "15/6",
        path: 33,
        pathComposite: "33",
        direction: 3,
        directionComposite: "39/12/3",
        expression: 5,
        expressionComposite: "23/5",
        result: 6,
        resultComposite: "6",
        baseMatrix: { "1": 2, "5": 1 },
        detailedMatrix: { "1": 2, "5": 1, "8": 1 }
      },
      firstMirror: {
        title: "Ваш цифровой код собран",
        subtitle: "Архитектурный разбор матрицы",
        formula: {
          numbers: "6 / 5 / 33 / 3 / 6",
          planets: "Венера / Меркурий / Учитель / Юпитер / Венера",
          positions: "Душа / Выражение / Путь / Направление / Результат"
        },
        blocks: [
          { id: "main_pattern", title: "Главный узор", text: "Ядро матрицы опирается на связку 6 и 33" }
        ],
        keyInsight: "Главная тема этой архитектуры — не масштаб ради масштаба",
        strengthTags: ["Глубина"],
        tensionTags: ["Контроль"],
        practicalStep: "Оставить одно решение без немедленного контроля",
        cta: { title: "Переход", text: "Исследуйте", button: "Далее" },
        disclaimer: "Ориентировочно"
      },
      storyInputs: {
        q1: "поиск баланса",
        q2: "маяк",
        q3: "тишина",
        q4: "глубина"
      },
      storyResult: {
        title: "Хранитель маяка",
        story: "История о поиске внутренней тишины...",
        mirror: {
          mainImage: "Каменный маяк",
          innerTension: "Шторм и тишина",
          hiddenResource: "Непоколебимая ось",
          newView: "Доверие стихии"
        },
        meaning: ["Опора внутри"],
        one_step: "Сделать паузу",
        journal_question: "Что удерживает свет?",
        disclaimer: "Метафора"
      },
      meetingResult: {
        summary: "Встреча двух линз выявляет устойчивую связь между структурой и образом.",
        hasStrongParallels: true,
        confidenceNote: "Высокая согласованность",
        reflectiveQuestion: "Какая опора позволяет удерживать равновесие?",
        albertInsight: "Код фиксирует каркас, Миф дает дыхание.",
        disclaimer: "Синтез носит исследовательский характер",
        parallels: [
          {
            theme: "Удержание внутренней опоры",
            codeAnchor: "Число Души 6 и Путь 33",
            mythAnchor: "Образ маяка",
            synthesis: "Оба зеркала сходятся на необходимости оси."
          }
        ],
        divergences: [
          {
            theme: "Динамика контроля",
            codeAspect: "Стратегический контроль",
            mythAspect: "Созерцательное отпускание",
            reflection: "Две стороны единого процесса."
          }
        ]
      }
    };

    await pageDesk.evaluate((snap) => {
      localStorage.setItem("zerkalo.myMirror.v1", JSON.stringify(snap));
    }, sampleSnapshotDesk);

    await pageDesk.reload();
    await pageDesk.waitForLoadState("networkidle");

    const restoreDeskBtn = pageDesk.locator('button:has-text("Открыть сохранённое")').first();
    await restoreDeskBtn.click();
    await pageDesk.waitForSelector('text=Встреча Зеркал', { timeout: 10000 });
    await pageDesk.waitForSelector('text=Различия ракурсов', { timeout: 10000 });
    await pageDesk.waitForTimeout(600);

    // Screenshot 12: Desktop Completed Meeting
    console.log("[Desktop Screenshot 2/2] Capturing desktop completed Meeting (12-desktop-meeting-1440x900.png)...");
    await pageDesk.screenshot({
      path: path.join(evidenceDir, "12-desktop-meeting-1440x900.png"),
    });

    await contextDesk.close();

    console.log("\n====================================================================");
    console.log("=== RECORDED PROVENANCE ===");
    console.log("====================================================================");
    console.log(JSON.stringify(recordedProvenance, null, 2));

    console.log("\n====================================================================");
    console.log("=== CONSOLE ERRORS AUDIT ===");
    console.log("====================================================================");
    console.log(`Total Console Errors: ${consoleErrors.length}`);
    if (consoleErrors.length > 0) {
      console.log(consoleErrors.join("\n"));
    }

    // Save provenance to file for report
    fs.writeFileSync(
      path.join(evidenceDir, "provenance_summary.json"),
      JSON.stringify({ recordedProvenance, readyData, consoleErrors }, null, 2)
    );

    console.log("\n====================================================================");
    console.log("=== ALL RELEASE QA V1 RUNS PASSED SUCCESSFULLY ===");
    console.log("====================================================================\n");

  } finally {
    if (browser) await browser.close();
    serverProcess.kill("SIGTERM");
  }
}

runReleaseQA().catch((err) => {
  console.error("Release QA failed:", err);
  process.exit(1);
});
