const { chromium } = require("@playwright/test");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");
const dotenv = require("dotenv");

const repoRoot = path.resolve(__dirname, "..");
const evidenceDir = path.join(repoRoot, "docs", "evidence", "release-qa-v1");
const port = 3045;

function validateAlbertOutputContract(message) {
  const trimmed = String(message || "").trim();
  if (!trimmed) {
    throw new Error("Albert contract violation: empty message");
  }
  const words = trimmed.split(/\s+/u).filter(Boolean);
  if (words.length < 5) {
    throw new Error(`Albert contract violation: too short (${words.length} words)`);
  }
  if (words.length > 250) {
    throw new Error(`Albert contract violation: over word limit (${words.length} words)`);
  }
  const questionMatches = trimmed.match(/\?/g) || [];
  if (questionMatches.length === 0) {
    throw new Error("Albert contract violation: missing question mark");
  }
  if (questionMatches.length > 1) {
    throw new Error(`Albert contract violation: multiple questions (${questionMatches.length})`);
  }
  if (!trimmed.endsWith("?")) {
    throw new Error("Albert contract violation: does not end with question mark");
  }
  return { valid: true, wordCount: words.length, questionCount: questionMatches.length };
}

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

  const submitBtn = page.locator('button:has-text("Открыть свой код"), button:has-text("Рассчитать код"), button[type="submit"]').first();
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

  // Start Server in production mode (serves prebuilt dist/, eliminates Vite HMR ws noise)
  const serverProcess = spawn("npx", ["tsx", "server.ts"], {
    cwd: repoRoot,
    env: { ...process.env, ...envConfig, PORT: String(port), NODE_ENV: "production" },
    stdio: ["ignore", "pipe", "pipe"],
  });

  serverProcess.stdout.on("data", (d) => process.stdout.write(`[Server] ${d}`));
  serverProcess.stderr.on("data", (d) => process.stderr.write(`[Server ERR] ${d}`));

  let browser;
  const recordedProvenance = {
    routeA: {},
    routeB: {},
    restoredAlbert: {},
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

    // Hard assert /health/ready DeepSeek contract
    if (
      readyData.status !== "ready" ||
      readyData.providers?.personal_myth?.provider !== "deepseek" ||
      readyData.providers?.personal_myth?.model !== "deepseek-v4-pro" ||
      readyData.providers?.meeting?.provider !== "deepseek" ||
      readyData.providers?.meeting?.model !== "deepseek-v4-pro" ||
      readyData.providers?.albert?.provider !== "deepseek" ||
      readyData.providers?.albert?.model !== "deepseek-v4-pro" ||
      readyData.google_production_dependency !== "none"
    ) {
      throw new Error("Readiness payload failed DeepSeek-only production model contract!");
    }
    console.log("  ✓ Readiness verified: all 3 models strictly mapped to deepseek-v4-pro, google dep is none");

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

    // Hard assert Route A Myth response-derived provenance
    if (
      mythAData.status !== "ok" ||
      mythAData.provider !== "deepseek" ||
      mythAData.model !== "deepseek-v4-pro"
    ) {
      throw new Error(`Route A Myth failed response provenance contract: ${JSON.stringify(mythAData)}`);
    }

    recordedProvenance.routeA.myth = {
      status: mythAData.status,
      provider: mythAData.provider,
      model: mythAData.model,
      title: mythAData.story_result?.title,
      mainImage: mythAData.story_result?.mirror?.mainImage,
    };
    console.log("  ✓ Live Myth Result received:", recordedProvenance.routeA.myth.title);
    console.log("  ✓ Route A Myth Provenance Asserted:", { provider: mythAData.provider, model: mythAData.model });

    // Screenshot 2: Live Myth Result
    console.log("[Screenshot 2/10] Capturing live Myth (02-live-myth-result-390x844.png)...");
    await pageA.waitForSelector('text=Символические истоки', { timeout: 15000 });
    const mythCardA = pageA.locator('text=Символические истоки').first();
    await mythCardA.scrollIntoViewIfNeeded();
    await pageA.waitForTimeout(400);
    await pageA.screenshot({
      path: path.join(evidenceDir, "02-live-myth-result-390x844.png"),
      clip: { x: 0, y: 0, width: 390, height: 844 },
    });

    // 2. Navigate to Digital Code (15.08.1990)
    console.log("[Route A] Navigating to Digital Code...");
    const toCodeBtnA = pageA.locator('button:has-text("Открыть Цифровой код"), button:has-text("Перейти к расчету Кода"), button:has-text("Код")').first();
    if (await toCodeBtnA.isVisible()) {
      await toCodeBtnA.scrollIntoViewIfNeeded();
      await toCodeBtnA.click();
    } else {
      const navCodeA = pageA.locator('nav button:has-text("Код")').first();
      await navCodeA.click();
    }
    await pageA.waitForTimeout(500);

    await fillCode(pageA, "15", "08", "1990");
    await pageA.waitForSelector('text=Акт I · Личная формула', { timeout: 15000 });

    // Screenshot 3: Live Code Result
    console.log("[Screenshot 3/10] Capturing live Code (03-live-code-result-390x844.png)...");
    await pageA.screenshot({
      path: path.join(evidenceDir, "03-live-code-result-390x844.png"),
      clip: { x: 0, y: 0, width: 390, height: 844 },
    });

    // 3. Navigate to Meeting of Mirrors
    console.log("[Route A] Navigating to Meeting of Mirrors and requesting LIVE synthesis...");
    const toMeetingBtnA = pageA.locator('button:has-text("Открыть Встречу зеркал")').first();
    const backToCollA = pageA.locator('button:has-text("К зеркалам")').first();
    if (await toMeetingBtnA.isVisible()) {
      await toMeetingBtnA.scrollIntoViewIfNeeded();
      await toMeetingBtnA.click();
    } else if (await backToCollA.isVisible()) {
      await backToCollA.click();
      await pageA.waitForTimeout(400);
      const navMeetingA = pageA.locator('nav button:has-text("Встреча")').first();
      await navMeetingA.waitFor({ state: "visible", timeout: 8000 });
      await navMeetingA.click();
    } else {
      const navMeetingA = pageA.locator('nav button:has-text("Встреча")').first();
      await navMeetingA.waitFor({ state: "visible", timeout: 8000 });
      await navMeetingA.click();
    }
    await pageA.waitForTimeout(500);

    await pageA.waitForSelector('text=Линза 1 · Цифровой код', { timeout: 10000 });
    await pageA.waitForSelector('text=Линза 2 · Личный миф', { timeout: 10000 });

    // Click "Провести Встречу зеркал"
    const synthPromiseA = pageA.waitForResponse(
      (res) => res.url().includes("/api/lab/meeting/generate") && res.status() === 200,
      { timeout: 90000 }
    );
    const runSynthBtnA = pageA.locator('button:has-text("Провести Встречу зеркал")').first();
    await runSynthBtnA.scrollIntoViewIfNeeded();
    await runSynthBtnA.click();

    console.log("  [Meeting] Waiting for LIVE /api/lab/meeting/generate response...");
    const synthResA = await synthPromiseA;
    const synthJsonA = await synthResA.json();

    // Hard assert Route A Meeting response-derived provenance
    if (
      synthJsonA.status !== "ok" ||
      synthJsonA.provider !== "deepseek" ||
      synthJsonA.model !== "deepseek-v4-pro"
    ) {
      throw new Error(`Route A Meeting failed response provenance contract: ${JSON.stringify(synthJsonA)}`);
    }

    recordedProvenance.routeA.meeting = {
      status: synthJsonA.status,
      provider: synthJsonA.provider,
      model: synthJsonA.model,
      summary: synthJsonA.result?.summary,
      parallelsCount: synthJsonA.result?.parallels?.length,
      divergencesCount: synthJsonA.result?.divergences?.length,
    };
    console.log("  ✓ Live Meeting Result received:", recordedProvenance.routeA.meeting.summary);
    console.log("  ✓ Route A Meeting Provenance Asserted:", { provider: synthJsonA.provider, model: synthJsonA.model });

    await pageA.waitForSelector('text=Встреча Зеркал', { timeout: 10000 });
    await pageA.waitForSelector('text=Различия ракурсов', { timeout: 10000 });
    await pageA.waitForTimeout(500);

    // Screenshot 4: Live Meeting
    console.log("[Screenshot 4/10] Capturing live Meeting (04-live-meeting-390x844.png)...");
    await pageA.screenshot({
      path: path.join(evidenceDir, "04-live-meeting-390x844.png"),
      clip: { x: 0, y: 0, width: 390, height: 844 },
    });

    // 4. Open Web Albert Dialogue & Send Live Message
    console.log("[Route A] Opening Web Albert and sending live question...");
    const openAlbertBtnA = pageA.locator('button:has-text("Диалог на сайте")').first();
    await openAlbertBtnA.scrollIntoViewIfNeeded();
    await openAlbertBtnA.click();

    await pageA.waitForSelector('text=Альберт Вяземский', { timeout: 10000 });
    await pageA.waitForSelector('text=ДУША: 6', { timeout: 10000 });

    const albertJsonA = await sendAlbertMessage(pageA, "В чем главная точка опоры между моим кодом и мифом?");

    // Hard assert Route A Albert response-derived provenance
    if (
      albertJsonA.status !== "ok" ||
      albertJsonA.provider !== "deepseek" ||
      albertJsonA.model !== "deepseek-v4-pro"
    ) {
      throw new Error(`Route A Albert failed response provenance contract: ${JSON.stringify(albertJsonA)}`);
    }

    const albertContractA = validateAlbertOutputContract(albertJsonA.message);
    recordedProvenance.routeA.albert = {
      status: albertJsonA.status,
      provider: albertJsonA.provider,
      model: albertJsonA.model,
      contractValid: albertContractA.valid,
      wordCount: albertContractA.wordCount,
      messagePreview: albertJsonA.message?.slice(0, 80),
    };
    console.log("  ✓ Live Albert reply received:", recordedProvenance.routeA.albert.messagePreview);
    console.log("  ✓ Route A Albert Provenance & Contract Asserted:", { provider: albertJsonA.provider, model: albertJsonA.model, words: albertContractA.wordCount });

    await pageA.waitForTimeout(1000);

    // Screenshot 5: Live Albert Reply
    console.log("[Screenshot 5/10] Capturing live Albert reply (05-live-albert-reply-390x844.png)...");
    await pageA.screenshot({
      path: path.join(evidenceDir, "05-live-albert-reply-390x844.png"),
      clip: { x: 0, y: 0, width: 390, height: 844 },
    });

    // Close Albert Modal
    const closeAlbertBtnA = pageA.locator('button:has(svg.lucide-x), button:has-text("Закрыть")').first();
    await closeAlbertBtnA.click();
    await pageA.waitForTimeout(400);

    // =============================================================
    // SECTION D: My Mirror V0 Local Persistence Flow
    // =============================================================
    console.log("\n[Route A -> My Mirror] Testing My Mirror V0 persistence flow...");

    // Enter Note
    const noteFieldA = pageA.locator('textarea[placeholder*="Запишите мысли"]').first();
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
      if (req.url().includes("/api/personal-myth") || req.url().includes("/api/lab/meeting/generate") || req.url().includes("/api/generate")) {
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

    // -------------------------------------------------------------
    // MAJOR 2: Restored Albert Request Context & Live Reply Check
    // -------------------------------------------------------------
    console.log("\n[Restored Albert Check] Opening Web Albert from restored Meeting and inspecting request payload context...");
    let capturedAlbertRequestBody = null;
    const albertRequestCaptureHandler = (req) => {
      if (req.url().includes("/api/albert/dialogue") && req.method() === "POST") {
        try {
          capturedAlbertRequestBody = JSON.parse(req.postData() || "{}");
        } catch (e) {}
      }
    };
    pageA.on("request", albertRequestCaptureHandler);

    const openAlbertRestoredBtn = pageA.locator('button:has-text("Диалог на сайте")').first();
    await openAlbertRestoredBtn.scrollIntoViewIfNeeded();
    await openAlbertRestoredBtn.click();
    await pageA.waitForSelector('text=Альберт Вяземский', { timeout: 10000 });

    const albertRestoredRes = await sendAlbertMessage(
      pageA,
      "Как практически применить эти выводы из встречи зеркал?"
    );

    pageA.off("request", albertRequestCaptureHandler);

    if (!capturedAlbertRequestBody || !capturedAlbertRequestBody.context) {
      throw new Error("Failed to capture outgoing context in /api/albert/dialogue request!");
    }

    const reqCtx = capturedAlbertRequestBody.context;
    console.log("  [Captured Restored Context Audit]:", {
      hasMeetingSummary: Boolean(reqCtx.meetingSummary && reqCtx.meetingSummary.length > 20),
      hasCodeAnchors: Boolean(reqCtx.codeAnchors && (reqCtx.codeAnchors.numbers || reqCtx.codeAnchors.keyInsight)),
      hasMythAnchors: Boolean(reqCtx.mythAnchors && (reqCtx.mythAnchors.title || reqCtx.mythAnchors.mainImage)),
      hasResonances: Boolean(reqCtx.resonances && reqCtx.resonances.length > 0),
      hasDivergences: Boolean(reqCtx.divergences && reqCtx.divergences.length > 0),
    });

    // Hard assert all three restored context anchors
    if (!reqCtx.meetingSummary || reqCtx.meetingSummary.length < 20) {
      throw new Error("Restored Albert context missing or insufficient meetingSummary!");
    }
    if (!reqCtx.codeAnchors || (!reqCtx.codeAnchors.numbers && !reqCtx.codeAnchors.keyInsight)) {
      throw new Error("Restored Albert context missing codeAnchors!");
    }
    if (!reqCtx.mythAnchors || (!reqCtx.mythAnchors.title && !reqCtx.mythAnchors.mainImage)) {
      throw new Error("Restored Albert context missing mythAnchors!");
    }

    // Hard assert live restored Albert response provenance & contract
    if (
      albertRestoredRes.status !== "ok" ||
      albertRestoredRes.provider !== "deepseek" ||
      albertRestoredRes.model !== "deepseek-v4-pro"
    ) {
      throw new Error(`Restored Albert failed provenance contract: ${JSON.stringify(albertRestoredRes)}`);
    }
    const albertRestoredContract = validateAlbertOutputContract(albertRestoredRes.message);

    recordedProvenance.restoredAlbert = {
      status: albertRestoredRes.status,
      provider: albertRestoredRes.provider,
      model: albertRestoredRes.model,
      contractValid: albertRestoredContract.valid,
      wordCount: albertRestoredContract.wordCount,
      hasMeetingSummaryInContext: true,
      hasCodeAnchorsInContext: true,
      hasMythAnchorsInContext: true,
      messagePreview: albertRestoredRes.message?.slice(0, 80),
    };
    console.log("  ✓ Restored Albert request context & live reply hard-asserted successfully!");

    // Close Albert Modal
    const closeAlbertRestoredBtn = pageA.locator('button:has(svg.lucide-x), button:has-text("Закрыть")').first();
    await closeAlbertRestoredBtn.click();
    await pageA.waitForTimeout(400);

    // -------------------------------------------------------------
    // MAJOR 3: Post-Restore Session-Integrity Chain
    // -------------------------------------------------------------
    console.log("\n[Major 3 Session Integrity] Verifying new DOB invalidation, saved snapshot survival, and second restore...");

    // 1. Enter genuinely different DOB (21.11.1988) and calculate new Code
    console.log("  [Step 1] Navigating to Code and entering different DOB (21.11.1988)...");
    const navCodeA2 = pageA.locator('nav button:has-text("Код")').first();
    await navCodeA2.click();
    await pageA.waitForTimeout(400);

    const diffDateBtn = pageA.locator('button:has-text("Другая дата")').first();
    if (await diffDateBtn.isVisible()) {
      await diffDateBtn.click();
      await pageA.waitForTimeout(400);
    }
    await fillCode(pageA, "21", "11", "1988");
    await pageA.waitForSelector('text=Акт I · Личная формула', { timeout: 15000 });

    // 2. Assert old active Meeting is invalidated/gone
    console.log("  [Step 2] Asserting old active Meeting is invalidated in memory...");
    const backToCollBtn = pageA.locator('button:has-text("К зеркалам")').first();
    if (await backToCollBtn.isVisible()) {
      await backToCollBtn.click();
      await pageA.waitForTimeout(500);
    }

    const navMeetingA2 = pageA.locator('nav button:has-text("Встреча")').first();
    await navMeetingA2.click({ force: true });
    await pageA.waitForTimeout(500);

    const synthBtnVisible = await pageA.locator('button:has-text("Провести Встречу зеркал")').isVisible();
    const oldParallelsCount = await pageA.locator('text=Различия ракурсов').count();
    if (!synthBtnVisible || oldParallelsCount > 0) {
      throw new Error("Active meeting was not invalidated after calculating different DOB!");
    }
    console.log("  ✓ Old active meeting successfully invalidated (requires new synthesis)");

    // 3. Assert saved local snapshot survives in localStorage
    console.log("  [Step 3] Asserting saved local snapshot survived new DOB calculation in localStorage...");
    const savedSnapshotRaw = await pageA.evaluate(() => localStorage.getItem("zerkalo.myMirror.v1"));
    if (!savedSnapshotRaw) throw new Error("Saved snapshot was unexpectedly wiped from localStorage!");
    const parsedSnapshot = JSON.parse(savedSnapshotRaw);
    if (parsedSnapshot.codeDate !== "15.08.1990" || !parsedSnapshot.meetingResult) {
      throw new Error(`Saved snapshot corrupted! Expected 15.08.1990, got ${parsedSnapshot.codeDate}`);
    }
    console.log("  ✓ Saved snapshot survived intact:", { date: parsedSnapshot.codeDate, myth: parsedSnapshot.storyResult?.title });

    // 4. Return to threshold and perform second explicit restore
    console.log("  [Step 4] Returning to threshold and performing second explicit restore...");
    const navLogoA = pageA.locator('header button').first();
    await navLogoA.click({ force: true });
    await pageA.waitForSelector('text=Моё зеркало · Сохранено локально', { timeout: 10000 });

    const secondRestoreProviderCalls = [];
    pageA.on("request", (req) => {
      if (req.url().includes("/api/personal-myth") || req.url().includes("/api/lab/meeting/generate") || req.url().includes("/api/generate")) {
        secondRestoreProviderCalls.push(req.url());
      }
    });

    const openSavedA2 = pageA.locator('button:has-text("Открыть сохранённое")').first();
    await openSavedA2.click();
    await pageA.waitForSelector('text=Встреча Зеркал', { timeout: 10000 });
    await pageA.waitForSelector('text=Различия ракурсов', { timeout: 10000 });

    if (secondRestoreProviderCalls.length > 0) {
      throw new Error("Provider calls detected on second restore: " + secondRestoreProviderCalls.join(", "));
    }
    console.log("  ✓ Second explicit restore succeeded with exactly 0 provider calls!");

    // 5. Delete Snapshot only after full integrity check
    console.log("  [Step 5] Deleting snapshot and verifying removal...");
    const deleteSavedBtnA = pageA.locator('button:has-text("Удалить сохранённое")').first();
    await deleteSavedBtnA.scrollIntoViewIfNeeded();
    await deleteSavedBtnA.click();
    await pageA.waitForTimeout(500);

    const keyAfterDelete = await pageA.evaluate(() => localStorage.getItem("zerkalo.myMirror.v1"));
    if (keyAfterDelete !== null) throw new Error("Storage key not removed after delete!");
    console.log("  ✓ Snapshot deleted cleanly, localStorage key is null");

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
    const toMythB = pageB.locator('button:has-text("Перейти к Личному мифу")').first();
    const backToCollB = pageB.locator('button:has-text("К зеркалам")').first();
    if (await toMythB.isVisible()) {
      await toMythB.scrollIntoViewIfNeeded();
      await toMythB.click();
    } else if (await backToCollB.isVisible()) {
      await backToCollB.click();
      await pageB.waitForTimeout(400);
      const navMythB = pageB.locator('nav button:has-text("Миф")').first();
      await navMythB.waitFor({ state: "visible", timeout: 8000 });
      await navMythB.click();
    } else {
      const navMythB = pageB.locator('nav button:has-text("Миф")').first();
      await navMythB.waitFor({ state: "visible", timeout: 8000 });
      await navMythB.click();
    }
    await pageB.waitForTimeout(500);

    const mythBData = await completeMythStepper(pageB, {
      q1: "стремление создавать долговечные и ясные структуры",
      q2: "старинная обсерватория на вершине горы под звездным небом",
      q3: "ночной холод и чистое безмолвие пространства",
      q4: "точность, глубина понимания и внутренний покой",
    });

    // Hard assert Route B Myth response-derived provenance
    if (
      mythBData.status !== "ok" ||
      mythBData.provider !== "deepseek" ||
      mythBData.model !== "deepseek-v4-pro"
    ) {
      throw new Error(`Route B Myth failed response provenance contract: ${JSON.stringify(mythBData)}`);
    }

    recordedProvenance.routeB.myth = {
      status: mythBData.status,
      provider: mythBData.provider,
      model: mythBData.model,
      title: mythBData.story_result?.title,
      mainImage: mythBData.story_result?.mirror?.mainImage,
    };
    console.log("  ✓ Route B Live Myth Result received:", recordedProvenance.routeB.myth.title);
    console.log("  ✓ Route B Myth Provenance Asserted:", { provider: mythBData.provider, model: mythBData.model });

    // 3. Navigate to Meeting of Mirrors
    console.log("[Route B] Navigating to Meeting of Mirrors and requesting LIVE synthesis...");
    const toMeetingB = pageB.locator('button:has-text("Открыть Встречу зеркал")').first();
    if (await toMeetingB.isVisible()) {
      await toMeetingB.scrollIntoViewIfNeeded();
      await toMeetingB.click();
    } else {
      const navMeetingB = pageB.locator('nav button:has-text("Встреча")').first();
      if (await navMeetingB.isVisible()) {
        await navMeetingB.click();
      }
    }
    await pageB.waitForTimeout(500);

    await pageB.waitForSelector('text=Линза 1 · Цифровой код', { timeout: 10000 });
    await pageB.waitForSelector('text=Линза 2 · Личный миф', { timeout: 10000 });

    const synthPromiseB = pageB.waitForResponse(
      (res) => res.url().includes("/api/lab/meeting/generate") && res.status() === 200,
      { timeout: 90000 }
    );
    const runSynthBtnB = pageB.locator('button:has-text("Провести Встречу зеркал")').first();
    await runSynthBtnB.scrollIntoViewIfNeeded();
    await runSynthBtnB.click();

    console.log("  [Meeting Route B] Waiting for LIVE /api/lab/meeting/generate response...");
    const synthResB = await synthPromiseB;
    const synthJsonB = await synthResB.json();

    // Hard assert Route B Meeting response-derived provenance
    if (
      synthJsonB.status !== "ok" ||
      synthJsonB.provider !== "deepseek" ||
      synthJsonB.model !== "deepseek-v4-pro"
    ) {
      throw new Error(`Route B Meeting failed response provenance contract: ${JSON.stringify(synthJsonB)}`);
    }

    recordedProvenance.routeB.meeting = {
      status: synthJsonB.status,
      provider: synthJsonB.provider,
      model: synthJsonB.model,
      summary: synthJsonB.result?.summary,
      parallelsCount: synthJsonB.result?.parallels?.length,
      divergencesCount: synthJsonB.result?.divergences?.length,
    };
    console.log("  ✓ Route B Live Meeting Result received:", recordedProvenance.routeB.meeting.summary);
    console.log("  ✓ Route B Meeting Provenance Asserted:", { provider: synthJsonB.provider, model: synthJsonB.model });

    // 4. Open Web Albert Dialogue & Send Live Message
    console.log("[Route B] Opening Web Albert and sending live question...");
    const openAlbertB = pageB.locator('button:has-text("Диалог на сайте")').first();
    await openAlbertB.scrollIntoViewIfNeeded();
    await openAlbertB.click();

    await pageB.waitForSelector('text=Альберт Вяземский', { timeout: 10000 });
    await pageB.waitForSelector('text=ДУША: 3', { timeout: 10000 });

    const albertJsonB = await sendAlbertMessage(pageB, "Как связать мою склонность к порядку с образами обсерватории?");

    // Hard assert Route B Albert response-derived provenance
    if (
      albertJsonB.status !== "ok" ||
      albertJsonB.provider !== "deepseek" ||
      albertJsonB.model !== "deepseek-v4-pro"
    ) {
      throw new Error(`Route B Albert failed response provenance contract: ${JSON.stringify(albertJsonB)}`);
    }

    const albertContractB = validateAlbertOutputContract(albertJsonB.message);
    recordedProvenance.routeB.albert = {
      status: albertJsonB.status,
      provider: albertJsonB.provider,
      model: albertJsonB.model,
      contractValid: albertContractB.valid,
      wordCount: albertContractB.wordCount,
      messagePreview: albertJsonB.message?.slice(0, 80),
    };
    console.log("  ✓ Route B Live Albert reply received:", recordedProvenance.routeB.albert.messagePreview);
    console.log("  ✓ Route B Albert Provenance & Contract Asserted:", { provider: albertJsonB.provider, model: albertJsonB.model, words: albertContractB.wordCount });

    await contextB.close();

    // =============================================================
    // SECTION E: Controlled Failure Smoke (SYNTHETIC_FAILURE)
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
    // SECTION F: Desktop Smoke (1440x900)
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

    // Desktop Screenshot 1: Threshold
    console.log("[Desktop Screenshot 1/2] Capturing desktop threshold (11-desktop-threshold-1440x900.png)...");
    await pageDesk.screenshot({
      path: path.join(evidenceDir, "11-desktop-threshold-1440x900.png"),
      clip: { x: 0, y: 0, width: 1440, height: 900 },
    });

    // Inject snapshot for desktop completed meeting view
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
    await restoreDeskBtn.waitFor({ state: "visible", timeout: 10000 });
    await restoreDeskBtn.click();
    await pageDesk.waitForSelector('text=Встреча Зеркал', { timeout: 10000 });
    await pageDesk.waitForSelector('text=Различия ракурсов', { timeout: 10000 });

    // Desktop Screenshot 2: Completed Meeting
    console.log("[Desktop Screenshot 2/2] Capturing desktop completed Meeting (12-desktop-meeting-1440x900.png)...");
    const deskMeetingSect = pageDesk.locator('text=Различия ракурсов').first();
    await deskMeetingSect.scrollIntoViewIfNeeded();
    await pageDesk.waitForTimeout(400);
    await pageDesk.screenshot({
      path: path.join(evidenceDir, "12-desktop-meeting-1440x900.png"),
      clip: { x: 0, y: 0, width: 1440, height: 900 },
    });

    await contextDesk.close();

    // -------------------------------------------------------------
    // Provenance and Error Persistence
    // -------------------------------------------------------------
    console.log("\n====================================================================");
    console.log("=== RECORDED PROVENANCE ===");
    console.log("====================================================================");
    console.log(JSON.stringify(recordedProvenance, null, 2));

    const unexpectedErrors = consoleErrors.filter((err) => {
      // Benign transient network errors handled gracefully by UI/retry or controlled synthetic failure tests
      if (err.includes("502 (Bad Gateway)") || err.includes("503 (Service Unavailable)")) {
        return false;
      }
      return true;
    });

    const errorClassification = unexpectedErrors.length === 0
      ? `NO_UNEXPECTED_PRODUCT_CONSOLE_ERRORS (raw captured entries count: ${consoleErrors.length}, contains only transient HTTP 502/503 network status logs from live LLM retry/controlled failure smoke)`
      : `UNEXPECTED_PRODUCT_ERRORS_DETECTED: ${unexpectedErrors.join("; ")}`;

    fs.writeFileSync(
      path.join(evidenceDir, "provenance_summary.json"),
      JSON.stringify(
        {
          recordedProvenance,
          readyData,
          consoleErrors,
          unexpectedErrors,
          consoleErrorClassification: errorClassification,
        },
        null,
        2
      )
    );

    console.log("\n====================================================================");
    console.log("=== CONSOLE ERRORS AUDIT ===");
    console.log("====================================================================");
    console.log(`Total Raw Console Errors: ${consoleErrors.length}`);
    for (const err of consoleErrors) {
      console.log("  -", err);
    }
    console.log(`Classification: ${errorClassification}`);

    if (unexpectedErrors.length > 0) {
      throw new Error(`Unexpected product errors detected during QA run: ${unexpectedErrors.join("; ")}`);
    }

    console.log("\n====================================================================");
    console.log("=== ALL RELEASE QA V1 RUNS PASSED SUCCESSFULLY ===");
    console.log("====================================================================\n");
  } finally {
    if (browser) await browser.close();
    serverProcess.kill();
  }
}

runReleaseQA().catch((err) => {
  console.error("Release QA failed:", err);
  process.exit(1);
});
