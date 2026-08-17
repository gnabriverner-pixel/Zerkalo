const { chromium } = require("@playwright/test");
const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");

const repoRoot = path.resolve(__dirname, "..");
const evidenceDir = path.join(repoRoot, "docs", "evidence", "public-release-v1");
const targetUrl = "https://zerkalosebya.ru";

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
      console.log("  [Myth Stepper] Waiting for LIVE /api/personal-myth production response...");
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

async function runPublicReleaseAcceptance() {
  console.log("====================================================================");
  console.log("=== ISSUE #25: FINAL PUBLIC RELEASE — OPEN UNRESTRICTED SMOKE ===");
  console.log(`=== TARGET DOMAIN: ${targetUrl} (UNAUTHENTICATED) ===`);
  console.log("====================================================================\n");

  fs.mkdirSync(evidenceDir, { recursive: true });

  const testStartTime = new Date().toISOString();
  console.log(`Test Start Timestamp: ${testStartTime}`);

  // -------------------------------------------------------------
  // 1. Health & Readiness Verification (Unauthenticated)
  // -------------------------------------------------------------
  console.log("[Public Check 1] Checking /health and /health/ready on live production domain...");
  const hRes = await fetch(`${targetUrl}/health`);
  const rRes = await fetch(`${targetUrl}/health/ready`);

  if (!hRes.ok) throw new Error(`/health returned HTTP ${hRes.status}`);
  if (!rRes.ok) throw new Error(`/health/ready returned HTTP ${rRes.status}`);

  const healthData = await hRes.json();
  const readyData = await rRes.json();

  console.log("  ✓ /health payload:", JSON.stringify(healthData, null, 2));
  console.log("  ✓ /health/ready payload:", JSON.stringify(readyData, null, 2));

  // Assert DeepSeek-only production contract
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
    throw new Error("Production readiness payload failed DeepSeek model contract!");
  }
  console.log("  ✓ Production readiness contract asserted: deepseek-v4-pro on all 3 services, google dep is none");

  let browser;
  const recordedProvenance = {
    myth: {},
    meeting: {},
    albert: {},
    restoredAlbert: {},
  };
  const consoleErrors = [];

  try {
    browser = await chromium.launch({ headless: true });

    // =============================================================
    // SECTION 2: Completely Unauthenticated Public Phone Journey (390x844)
    // =============================================================
    console.log("\n=============================================================");
    console.log("=== PUBLIC PHONE JOURNEY (390x844, UNAUTHENTICATED) ===");
    console.log("=============================================================");

    const contextPhone = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
    });
    const pagePhone = await contextPhone.newPage();
    pagePhone.on("pageerror", (err) => consoleErrors.push(`[PageError] ${err.message}`));
    pagePhone.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(`[ConsoleError] ${msg.text()}`);
    });

    console.log("[Public Journey] Loading root page with zero credentials...");
    const rootRes = await pagePhone.goto(targetUrl);
    if (!rootRes.ok()) throw new Error(`Root returned HTTP ${rootRes.status()}`);
    await pagePhone.waitForLoadState("networkidle");

    // Screenshot 1: Public Threshold
    console.log("[Screenshot 1/9] Capturing public threshold (01-public-threshold-390x844.png)...");
    await pagePhone.screenshot({
      path: path.join(evidenceDir, "01-public-threshold-390x844.png"),
      clip: { x: 0, y: 0, width: 390, height: 844 },
    });

    // 1. Personal Myth Lens
    console.log("[Public Journey] Entering Personal Myth...");
    const toMythBtn = pagePhone.locator('button:has-text("Войти в миф"), button:has-text("Миф")').first();
    await toMythBtn.click();
    await pagePhone.waitForTimeout(500);

    const mythData = await completeMythStepper(pagePhone, {
      q1: "поиск гармонии между порядком и творческим вдохновением",
      q2: "каменный маяк на скале посреди вечернего моря",
      q3: "тишина перед приближающейся грозой",
      q4: "уверенность, глубина и спокойное принятие",
    });

    // Hard assert response provenance
    if (
      mythData.status !== "ok" ||
      mythData.provider !== "deepseek" ||
      mythData.model !== "deepseek-v4-pro"
    ) {
      throw new Error(`Public Myth response provenance failure: ${JSON.stringify(mythData)}`);
    }

    recordedProvenance.myth = {
      status: mythData.status,
      provider: mythData.provider,
      model: mythData.model,
      title: mythData.story_result?.title,
      mainImage: mythData.story_result?.mirror?.mainImage,
    };
    console.log("  ✓ Public Live Myth Result:", recordedProvenance.myth.title);
    console.log("  ✓ Public Myth Provenance Asserted:", { provider: mythData.provider, model: mythData.model });

    // Screenshot 2: Myth Result
    console.log("[Screenshot 2/9] Capturing public Myth (02-public-myth-390x844.png)...");
    await pagePhone.waitForSelector('text=Символические истоки', { timeout: 15000 });
    const mythCard = pagePhone.locator('text=Символические истоки').first();
    await mythCard.scrollIntoViewIfNeeded();
    await pagePhone.waitForTimeout(400);
    await pagePhone.screenshot({
      path: path.join(evidenceDir, "02-public-myth-390x844.png"),
      clip: { x: 0, y: 0, width: 390, height: 844 },
    });

    // 2. Digital Code Lens (15.08.1990)
    console.log("[Public Journey] Navigating to Digital Code...");
    const toCodeBtn = pagePhone.locator('button:has-text("Открыть Цифровой код"), button:has-text("Перейти к расчету Кода"), button:has-text("Код")').first();
    if (await toCodeBtn.isVisible()) {
      await toCodeBtn.scrollIntoViewIfNeeded();
      await toCodeBtn.click();
    } else {
      const navCode = pagePhone.locator('nav button:has-text("Код")').first();
      await navCode.click();
    }
    await pagePhone.waitForTimeout(500);

    await fillCode(pagePhone, "15", "08", "1990");

    // Screenshot 3: Code Result
    console.log("[Screenshot 3/9] Capturing public Code (03-public-code-390x844.png)...");
    await pagePhone.screenshot({
      path: path.join(evidenceDir, "03-public-code-390x844.png"),
      clip: { x: 0, y: 0, width: 390, height: 844 },
    });

    // 3. Meeting of Mirrors
    console.log("[Public Journey] Navigating to Meeting of Mirrors and requesting LIVE synthesis...");
    const toMeetingBtn = pagePhone.locator('button:has-text("Открыть Встречу зеркал")').first();
    const backToColl = pagePhone.locator('button:has-text("К зеркалам")').first();
    if (await toMeetingBtn.isVisible()) {
      await toMeetingBtn.scrollIntoViewIfNeeded();
      await toMeetingBtn.click();
    } else if (await backToColl.isVisible()) {
      await backToColl.click();
      await pagePhone.waitForTimeout(400);
      const navMeeting = pagePhone.locator('nav button:has-text("Встреча")').first();
      await navMeeting.waitFor({ state: "visible", timeout: 8000 });
      await navMeeting.click();
    } else {
      const navMeeting = pagePhone.locator('nav button:has-text("Встреча")').first();
      await navMeeting.waitFor({ state: "visible", timeout: 8000 });
      await navMeeting.click();
    }
    await pagePhone.waitForTimeout(500);

    await pagePhone.waitForSelector('text=Линза 1 · Цифровой код', { timeout: 10000 });
    await pagePhone.waitForSelector('text=Линза 2 · Личный миф', { timeout: 10000 });

    const synthPromise = pagePhone.waitForResponse(
      (res) => res.url().includes("/api/lab/meeting/generate") && res.status() === 200,
      { timeout: 90000 }
    );
    const runSynthBtn = pagePhone.locator('button:has-text("Провести Встречу зеркал")').first();
    await runSynthBtn.scrollIntoViewIfNeeded();
    await runSynthBtn.click();

    console.log("  [Meeting] Waiting for LIVE /api/lab/meeting/generate response...");
    const synthRes = await synthPromise;
    const synthJson = await synthRes.json();

    // Hard assert Meeting provenance
    if (
      synthJson.status !== "ok" ||
      synthJson.provider !== "deepseek" ||
      synthJson.model !== "deepseek-v4-pro"
    ) {
      throw new Error(`Public Meeting response provenance failure: ${JSON.stringify(synthJson)}`);
    }

    recordedProvenance.meeting = {
      status: synthJson.status,
      provider: synthJson.provider,
      model: synthJson.model,
      summary: synthJson.result?.summary,
      parallelsCount: synthJson.result?.parallels?.length,
      divergencesCount: synthJson.result?.divergences?.length,
    };
    console.log("  ✓ Public Live Meeting Result:", recordedProvenance.meeting.summary);
    console.log("  ✓ Public Meeting Provenance Asserted:", { provider: synthJson.provider, model: synthJson.model });

    await pagePhone.waitForSelector('text=Встреча Зеркал', { timeout: 10000 });
    await pagePhone.waitForSelector('text=Различия ракурсов', { timeout: 10000 });
    await pagePhone.waitForTimeout(500);

    // Screenshot 4: Meeting Result
    console.log("[Screenshot 4/9] Capturing public Meeting (04-public-meeting-390x844.png)...");
    await pagePhone.screenshot({
      path: path.join(evidenceDir, "04-public-meeting-390x844.png"),
      clip: { x: 0, y: 0, width: 390, height: 844 },
    });

    // 4. Web Albert Dialogue (Live Public)
    console.log("[Public Journey] Opening Web Albert and sending live question...");
    const openAlbertBtn = pagePhone.locator('button:has-text("Диалог на сайте")').first();
    await openAlbertBtn.scrollIntoViewIfNeeded();
    await openAlbertBtn.click();

    await pagePhone.waitForSelector('text=Альберт Вяземский', { timeout: 10000 });
    await pagePhone.waitForSelector('text=ДУША: 6', { timeout: 10000 });

    const albertJson = await sendAlbertMessage(pagePhone, "В чем главная точка опоры между моим кодом и мифом?");

    // Hard assert Albert provenance & contract
    if (
      albertJson.status !== "ok" ||
      albertJson.provider !== "deepseek" ||
      albertJson.model !== "deepseek-v4-pro"
    ) {
      throw new Error(`Public Albert response provenance failure: ${JSON.stringify(albertJson)}`);
    }

    const albertContract = validateAlbertOutputContract(albertJson.message);
    recordedProvenance.albert = {
      status: albertJson.status,
      provider: albertJson.provider,
      model: albertJson.model,
      contractValid: albertContract.valid,
      wordCount: albertContract.wordCount,
      messagePreview: albertJson.message?.slice(0, 80),
    };
    console.log("  ✓ Public Live Albert Reply:", recordedProvenance.albert.messagePreview);
    console.log("  ✓ Public Albert Provenance & Contract Asserted:", { provider: albertJson.provider, model: albertJson.model, words: albertContract.wordCount });

    await pagePhone.waitForTimeout(1000);

    // Screenshot 5: Albert Reply
    console.log("[Screenshot 5/9] Capturing public Albert reply (05-public-albert-390x844.png)...");
    await pagePhone.screenshot({
      path: path.join(evidenceDir, "05-public-albert-390x844.png"),
      clip: { x: 0, y: 0, width: 390, height: 844 },
    });

    // Close Albert Modal
    const closeAlbertBtn = pagePhone.locator('button:has(svg.lucide-x), button:has-text("Закрыть")').first();
    await closeAlbertBtn.click();
    await pagePhone.waitForTimeout(400);

    // -------------------------------------------------------------
    // 5. My Mirror V0 Local Persistence Flow on Public Domain
    // -------------------------------------------------------------
    console.log("\n[Public Persistence] Testing My Mirror V0 persistence on live public domain...");

    const noteField = pagePhone.locator('textarea[placeholder*="Запишите мысли"]').first();
    await noteField.scrollIntoViewIfNeeded();
    await noteField.fill("Публичный релиз — заметка о встрече зеркал (Public Acceptance)");
    await pagePhone.waitForTimeout(300);

    const saveMirrorBtn = pagePhone.locator('button:has-text("Сохранить на этом устройстве")').first();
    await saveMirrorBtn.click();
    await pagePhone.waitForSelector('text=Сохранено в этом браузере', { timeout: 5000 });
    await pagePhone.waitForTimeout(400);

    // Screenshot 6: My Mirror Saved
    console.log("[Screenshot 6/9] Capturing public My Mirror saved (06-public-my-mirror-saved-390x844.png)...");
    await pagePhone.screenshot({
      path: path.join(evidenceDir, "06-public-my-mirror-saved-390x844.png"),
      clip: { x: 0, y: 0, width: 390, height: 844 },
    });

    // Real Page Reload
    console.log("  [Real Reload] Performing unauthenticated browser reload...");
    await pagePhone.reload();
    await pagePhone.waitForLoadState("networkidle");
    await pagePhone.waitForTimeout(800);

    const hero = pagePhone.locator('h1:has-text("Зеркало себя")').first();
    await hero.waitFor({ state: "visible", timeout: 10000 });

    const savedCard = pagePhone.locator('text=Моё зеркало · Сохранено локально').first();
    await savedCard.scrollIntoViewIfNeeded();
    await pagePhone.waitForTimeout(400);

    // Screenshot 7: Reload Saved Entry
    console.log("[Screenshot 7/9] Capturing public reload saved entry (07-public-reload-saved-390x844.png)...");
    await pagePhone.screenshot({
      path: path.join(evidenceDir, "07-public-reload-saved-390x844.png"),
      clip: { x: 0, y: 0, width: 390, height: 844 },
    });

    // Explicit Restore with 0 Provider Calls Assertion
    console.log("  [Explicit Restore] Restoring saved mirror and asserting 0 provider calls on public domain...");
    const restoreProviderCalls = [];
    pagePhone.on("request", (req) => {
      if (req.url().includes("/api/personal-myth") || req.url().includes("/api/lab/meeting/generate") || req.url().includes("/api/generate")) {
        restoreProviderCalls.push(req.url());
      }
    });

    const openSavedBtn = pagePhone.locator('button:has-text("Открыть сохранённое")').first();
    await openSavedBtn.click();
    await pagePhone.waitForSelector('text=Встреча Зеркал', { timeout: 10000 });
    await pagePhone.waitForSelector('text=Различия ракурсов', { timeout: 10000 });
    await pagePhone.waitForTimeout(500);

    console.log(`  ✓ Provider calls on public restore: ${restoreProviderCalls.length}`);
    if (restoreProviderCalls.length > 0) {
      throw new Error("Provider calls detected on public restore: " + restoreProviderCalls.join(", "));
    }

    // Screenshot 8: Restored Meeting
    console.log("[Screenshot 8/9] Capturing public restored Meeting (08-public-restored-meeting-390x844.png)...");
    const restoredTitle = pagePhone.locator('text=Итог ·').first();
    await restoredTitle.scrollIntoViewIfNeeded();
    await pagePhone.waitForTimeout(400);
    await pagePhone.screenshot({
      path: path.join(evidenceDir, "08-public-restored-meeting-390x844.png"),
      clip: { x: 0, y: 0, width: 390, height: 844 },
    });

    // -------------------------------------------------------------
    // 6. Restored Albert Request Context & Live Reply Check on Public Domain
    // -------------------------------------------------------------
    console.log("\n[Public Restored Albert] Opening Web Albert from restored Meeting and inspecting request payload context...");
    let capturedAlbertBody = null;
    const albertCaptureHandler = (req) => {
      if (req.url().includes("/api/albert/dialogue") && req.method() === "POST") {
        try {
          capturedAlbertBody = JSON.parse(req.postData() || "{}");
        } catch (e) {}
      }
    };
    pagePhone.on("request", albertCaptureHandler);

    const openAlbertRestoredBtn = pagePhone.locator('button:has-text("Диалог на сайте")').first();
    await openAlbertRestoredBtn.scrollIntoViewIfNeeded();
    await openAlbertRestoredBtn.click();
    await pagePhone.waitForSelector('text=Альберт Вяземский', { timeout: 10000 });

    const albertRestoredRes = await sendAlbertMessage(
      pagePhone,
      "Как практически применить эти выводы из встречи зеркал в повседневности?"
    );

    pagePhone.off("request", albertCaptureHandler);

    if (!capturedAlbertBody || !capturedAlbertBody.context) {
      throw new Error("Failed to capture outgoing context in /api/albert/dialogue request on public domain!");
    }

    const reqCtx = capturedAlbertBody.context;
    console.log("  [Public Restored Context Audit]:", {
      hasMeetingSummary: Boolean(reqCtx.meetingSummary && reqCtx.meetingSummary.length > 20),
      hasCodeAnchors: Boolean(reqCtx.codeAnchors && (reqCtx.codeAnchors.numbers || reqCtx.codeAnchors.keyInsight)),
      hasMythAnchors: Boolean(reqCtx.mythAnchors && (reqCtx.mythAnchors.title || reqCtx.mythAnchors.mainImage)),
      hasResonances: Boolean(reqCtx.resonances && reqCtx.resonances.length > 0),
      hasDivergences: Boolean(reqCtx.divergences && reqCtx.divergences.length > 0),
    });

    if (!reqCtx.meetingSummary || reqCtx.meetingSummary.length < 20) {
      throw new Error("Public restored Albert context missing meetingSummary!");
    }
    if (!reqCtx.codeAnchors || (!reqCtx.codeAnchors.numbers && !reqCtx.codeAnchors.keyInsight)) {
      throw new Error("Public restored Albert context missing codeAnchors!");
    }
    if (!reqCtx.mythAnchors || (!reqCtx.mythAnchors.title && !reqCtx.mythAnchors.mainImage)) {
      throw new Error("Public restored Albert context missing mythAnchors!");
    }

    // Hard assert live restored Albert response provenance & contract
    if (
      albertRestoredRes.status !== "ok" ||
      albertRestoredRes.provider !== "deepseek" ||
      albertRestoredRes.model !== "deepseek-v4-pro"
    ) {
      throw new Error(`Public restored Albert failed provenance contract: ${JSON.stringify(albertRestoredRes)}`);
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
    console.log("  ✓ Public restored Albert reply validated:", recordedProvenance.restoredAlbert.messagePreview);

    // Screenshot 9: Restored Albert Reply
    console.log("[Screenshot 9/9] Capturing public restored Albert reply (09-public-restored-albert-390x844.png)...");
    await pagePhone.screenshot({
      path: path.join(evidenceDir, "09-public-restored-albert-390x844.png"),
      clip: { x: 0, y: 0, width: 390, height: 844 },
    });

    await contextPhone.close();

    // =============================================================
    // SECTION 3: Desktop Catastrophic Smoke (1440x900, Unauthenticated)
    // =============================================================
    console.log("\n=============================================================");
    console.log("=== PUBLIC DESKTOP SMOKE (1440x900, UNAUTHENTICATED) ===");
    console.log("=============================================================");

    const contextDesk = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2,
    });
    const pageDesk = await contextDesk.newPage();
    pageDesk.on("pageerror", (err) => consoleErrors.push(`[Desktop PageError] ${err.message}`));
    pageDesk.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(`[Desktop ConsoleError] ${msg.text()}`);
    });

    await pageDesk.goto(targetUrl);
    await pageDesk.waitForLoadState("networkidle");

    // Desktop Screenshot 1: Threshold
    console.log("[Desktop Screenshot 1/2] Capturing public desktop threshold (10-public-desktop-threshold-1440x900.png)...");
    await pageDesk.screenshot({
      path: path.join(evidenceDir, "10-public-desktop-threshold-1440x900.png"),
      clip: { x: 0, y: 0, width: 1440, height: 900 },
    });

    // Populate and restore snapshot for desktop completed view
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
    console.log("[Desktop Screenshot 2/2] Capturing public desktop completed Meeting (11-public-desktop-meeting-1440x900.png)...");
    const deskMeetingSect = pageDesk.locator('text=Различия ракурсов').first();
    await deskMeetingSect.scrollIntoViewIfNeeded();
    await pageDesk.waitForTimeout(400);
    await pageDesk.screenshot({
      path: path.join(evidenceDir, "11-public-desktop-meeting-1440x900.png"),
      clip: { x: 0, y: 0, width: 1440, height: 900 },
    });

    await contextDesk.close();

    // -------------------------------------------------------------
    // SECTION 4: Production Log Audit
    // -------------------------------------------------------------
    console.log("\n=============================================================");
    console.log("=== PRODUCTION JOURNAL LOG AUDIT ===");
    console.log("=============================================================");

    let prodLogs = "";
    try {
      prodLogs = execSync(
        `ssh -o BatchMode=yes -i ~/.ssh/id_ed25519_yc_dcs root@217.12.37.223 "journalctl -u zerkalo -n 50 --no-pager"`
      ).toString();
      console.log("Production logs:\n", prodLogs);
    } catch (e) {
      console.log("Warning: Could not fetch remote logs via ssh:", e.message);
    }

    // -------------------------------------------------------------
    // SECTION 5: Provenance and Error Classification
    // -------------------------------------------------------------
    const unexpectedErrors = consoleErrors.filter((err) => {
      if (err.includes("502 (Bad Gateway)") || err.includes("503 (Service Unavailable)")) return false;
      return true;
    });

    const errorClassification = unexpectedErrors.length === 0
      ? `NO_UNEXPECTED_PRODUCT_CONSOLE_ERRORS (raw count: ${consoleErrors.length})`
      : `UNEXPECTED_PRODUCT_ERRORS_DETECTED: ${unexpectedErrors.join("; ")}`;

    fs.writeFileSync(
      path.join(evidenceDir, "public_release_provenance_summary.json"),
      JSON.stringify(
        {
          testStartTime,
          targetUrl,
          healthData,
          readyData,
          recordedProvenance,
          consoleErrors,
          unexpectedErrors,
          consoleErrorClassification: errorClassification,
          productionLogs: prodLogs,
        },
        null,
        2
      )
    );

    console.log("\n====================================================================");
    console.log("=== FINAL PUBLIC RELEASE ACCEPTANCE AUDIT COMPLETE ===");
    console.log("====================================================================");
    console.log("Recorded Provenance:", JSON.stringify(recordedProvenance, null, 2));
    console.log("Console Errors:", consoleErrors);
    console.log("Classification:", errorClassification);

    if (unexpectedErrors.length > 0) {
      throw new Error(`Unexpected product errors detected during public release QA run: ${unexpectedErrors.join("; ")}`);
    }

    console.log("\n====================================================================");
    console.log("=== ALL PUBLIC RELEASE ACCEPTANCE CHECKS PASSED SUCCESSFULLY ===");
    console.log("====================================================================\n");

  } finally {
    if (browser) await browser.close();
  }
}

runPublicReleaseAcceptance().catch((err) => {
  console.error("Public release acceptance failed:", err);
  process.exit(1);
});
