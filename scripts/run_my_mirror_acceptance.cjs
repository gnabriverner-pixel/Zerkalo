const { chromium } = require("@playwright/test");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");
const dotenv = require("dotenv");

const repoRoot = path.resolve(__dirname, "..");
const evidenceDir = path.join(repoRoot, "docs", "evidence", "my-mirror-v0");
const port = 3040;

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

async function fillCode(page, d, m, y) {
  const codeBtn = page.locator('button:has-text("Код"), button:has-text("Цифровой код")').first();
  await codeBtn.click();
  await page.waitForTimeout(500);

  const dayInput = page.locator('input[placeholder="ДД"]').first();
  const monthInput = page.locator('input[placeholder="ММ"]').first();
  const yearInput = page.locator('input[placeholder="ГГГГ"]').first();

  await dayInput.fill(d);
  await monthInput.fill(m);
  await yearInput.fill(y);

  const submitBtn = page.locator('button:has-text("Открыть свой код")').first();
  await submitBtn.click();
  await page.waitForSelector('text=Акт I · Личная формула', { timeout: 15000 });
  await page.waitForTimeout(600);
}

async function runAcceptance() {
  console.log("====================================================================");
  console.log("=== ISSUE #20: MY MIRROR V0 LOCAL PERSISTENCE ACCEPTANCE (390x844) ===");
  console.log("====================================================================\n");

  fs.mkdirSync(evidenceDir, { recursive: true });

  const envConfig = dotenv.parse(fs.readFileSync(path.join(repoRoot, ".env")));

  // Start Live Server on port 3040
  const serverProcess = spawn("npx", ["tsx", "server.ts"], {
    cwd: repoRoot,
    env: { ...process.env, ...envConfig, PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"],
  });

  serverProcess.stdout.on("data", (d) => process.stdout.write(`[Server] ${d}`));
  serverProcess.stderr.on("data", (d) => process.stderr.write(`[Server ERR] ${d}`));

  let browser;

  try {
    // Wait for server health
    let healthy = false;
    for (let i = 0; i < 30; i++) {
      try {
        const res = await fetch(`http://localhost:${port}/health`);
        if (res.ok) {
          healthy = true;
          break;
        }
      } catch (e) {}
      await new Promise((r) => setTimeout(r, 500));
    }
    if (!healthy) throw new Error("Server failed to become healthy on port " + port);

    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();

    // -------------------------------------------------------------
    // Step 1: Complete Code + Myth -> Generate Meeting
    // -------------------------------------------------------------
    console.log("[Setup] Opening app and completing Code...");
    await page.goto(`http://localhost:${port}`);
    await page.waitForLoadState("networkidle");

    await fillCode(page, "15", "08", "1990");

    console.log("[Setup] Completing Personal Myth...");
    const toMythBtn = page.locator('button:has-text("Перейти к Личному мифу"), button:has-text("К зеркалам")').first();
    await toMythBtn.click();
    await page.waitForTimeout(500);

    const navMyth = page.locator('nav button:has-text("Миф")').first();
    if (await navMyth.isVisible()) {
      await navMyth.click();
      await page.waitForTimeout(500);
    }

    await completeMythStepper(page, {
      q1: "поиск баланса между разумом и чувством",
      q2: "каменный маяк на скалистом берегу",
      q3: "вечерняя тишина перед грозой",
      q4: "уверенность и спокойная глубина",
    });
    await page.waitForSelector('text=Символические истоки', { timeout: 45000 });

    // Mock Meeting Response for reproducible synthesis
    await page.route("**/api/lab/meeting/generate", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          status: "ok",
          result: {
            summary: "Встреча двух линз выявляет устойчивую связь между структурным ядром Кода и образным пространством Мифа.",
            hasStrongParallels: true,
            confidenceNote: "Высокая согласованность",
            reflectiveQuestion: "Какая опора позволяет удерживать равновесие между структурой и образом?",
            albertInsight: "Код фиксирует архитектурный каркас, а Миф наполняет его живым дыханием.",
            disclaimer: "Синтез носит исследовательский характер",
            parallels: [
              {
                theme: "Удержание внутренней опоры",
                codeAnchor: "Число Души 6 и Путь 8 требуют системной устойчивости",
                mythAnchor: "Образ каменного маяка посреди вечернего моря",
                synthesis: "Оба зеркала сходятся на необходимости несокрушимой внутренней оси."
              }
            ],
            divergences: [
              {
                theme: "Различие в динамике контроля",
                codeAspect: "Код ориентирован на стратегический контроль и нормативное планирование",
                mythAspect: "Миф отпускает контроль в пользу созерцательной тишины перед грозой",
                reflection: "Код ищет порядок в форме, а образное восприятие черпает ресурс в готовности к неопределенности."
              }
            ]
          }
        }),
      });
    });

    const toMeetingBtn = page.locator('button:has-text("Открыть Встречу зеркал"), button:has-text("К зеркалам"), nav button:has-text("Встреча")').first();
    await toMeetingBtn.click();
    await page.waitForTimeout(500);

    const navMeeting = page.locator('nav button:has-text("Встреча")').first();
    if (await navMeeting.isVisible()) {
      await navMeeting.click();
      await page.waitForTimeout(500);
    }

    const runSynthBtn = page.locator('button:has-text("Встречу"), button:has-text("Синтез")').first();
    await runSynthBtn.click();
    await page.waitForSelector('text=Различия ракурсов', { timeout: 15000 });

    // -------------------------------------------------------------
    // Screenshot 1: Save UI in completed Meeting (01-save-my-mirror-after-meeting-390x844.png)
    // -------------------------------------------------------------
    console.log("[1/6] Capturing Save UI in completed Meeting (01-save-my-mirror-after-meeting-390x844.png)...");
    const saveCard = page.locator('text=Моё зеркало · Локальное сохранение').first();
    await saveCard.scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);

    await page.screenshot({
      path: path.join(evidenceDir, "01-save-my-mirror-after-meeting-390x844.png"),
      clip: { x: 0, y: 0, width: 390, height: 844 },
    });
    console.log("  ✓ Captured 01-save-my-mirror-after-meeting-390x844.png");

    // -------------------------------------------------------------
    // Step 2: Click Explicit Save & Verify localStorage
    // -------------------------------------------------------------
    console.log("[2/6] Clicking Save and verifying localStorage...");
    const saveBtn = page.locator('button:has-text("Сохранить на этом устройстве")').first();
    await saveBtn.click();
    await page.waitForSelector('text=Сохранено в этом браузере', { timeout: 5000 });
    await page.waitForTimeout(600);

    const storageRaw = await page.evaluate(() => localStorage.getItem("zerkalo.myMirror.v1"));
    if (!storageRaw) throw new Error("localStorage key zerkalo.myMirror.v1 was NOT found after save!");
    const snapshot = JSON.parse(storageRaw);
    console.log(`  [Storage Check] Version: ${snapshot.version}, SavedAt: ${snapshot.savedAt}, CodeDate: ${snapshot.codeDate}`);
    if (snapshot.version !== 1 || snapshot.codeDate !== "15.08.1990" || !snapshot.meetingResult) {
      throw new Error("Invalid snapshot payload stored in localStorage: " + storageRaw);
    }

    // Screenshot 2: Save Confirmation
    await page.screenshot({
      path: path.join(evidenceDir, "02-save-confirmation-390x844.png"),
      clip: { x: 0, y: 0, width: 390, height: 844 },
    });
    console.log("  ✓ Captured 02-save-confirmation-390x844.png");

    // -------------------------------------------------------------
    // Step 3: Real Page Reload Proof & Non-Auto-Restore Assertion
    // -------------------------------------------------------------
    console.log("[3/6] Performing real page reload to test threshold entry without silent auto-restore...");
    await page.reload();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    // Verify we are on threshold entry view and NOT auto-navigated to meeting
    const entryHero = page.locator('h1:has-text("Зеркало себя")').first();
    await entryHero.waitFor({ state: "visible", timeout: 10000 });

    const savedMirrorCard = page.locator('text=Моё зеркало · Сохранено локально').first();
    await savedMirrorCard.scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);

    // Screenshot 3: Entry Threshold with Saved Mirror Entry
    await page.screenshot({
      path: path.join(evidenceDir, "03-entry-saved-mirror-390x844.png"),
      clip: { x: 0, y: 0, width: 390, height: 844 },
    });
    console.log("  ✓ Captured 03-entry-saved-mirror-390x844.png");

    // -------------------------------------------------------------
    // Step 4: Explicit Open -> Restores Meeting without Provider Calls
    // -------------------------------------------------------------
    console.log("[4/6] Explicitly restoring saved mirror and asserting 0 provider calls...");
    const providerCalls = [];
    page.on("request", (req) => {
      if (req.url().includes("/api/personal-myth") || req.url().includes("/api/lab/meeting/generate")) {
        providerCalls.push(req.url());
      }
    });

    const openSavedBtn = page.locator('button:has-text("Открыть сохранённое")').first();
    await openSavedBtn.click();
    await page.waitForSelector('text=Встреча Зеркал', { timeout: 10000 });
    await page.waitForSelector('text=Различия ракурсов', { timeout: 10000 });
    await page.waitForTimeout(800);

    console.log(`  [Provider Calls Count on Restore]: ${providerCalls.length}`);
    if (providerCalls.length > 0) {
      throw new Error(`Expected 0 provider calls on restore, but got: ${providerCalls.join(", ")}`);
    }

    // Screenshot 4: Restored Meeting View
    const restoredSummary = page.locator('text=Итог ·').first();
    await restoredSummary.scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);

    await page.screenshot({
      path: path.join(evidenceDir, "04-restored-meeting-390x844.png"),
      clip: { x: 0, y: 0, width: 390, height: 844 },
    });
    console.log("  ✓ Captured 04-restored-meeting-390x844.png");

    // -------------------------------------------------------------
    // Step 5: Open Web Albert from Restored Meeting with Full Context
    // -------------------------------------------------------------
    console.log("[5/6] Opening Web Albert from restored Meeting to verify formula context...");
    const openAlbertBtn = page.locator('button:has-text("Диалог на сайте")').first();
    await openAlbertBtn.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    await openAlbertBtn.click();

    await page.waitForSelector('text=Альберт Вяземский', { timeout: 10000 });
    await page.waitForSelector('text=ДУША: 6', { timeout: 5000 });
    await page.waitForTimeout(800);

    // Screenshot 5: Restored Albert Context
    await page.screenshot({
      path: path.join(evidenceDir, "05-restored-albert-context-390x844.png"),
      clip: { x: 0, y: 0, width: 390, height: 844 },
    });
    console.log("  ✓ Captured 05-restored-albert-context-390x844.png");

    // Close Albert Modal
    const closeAlbertBtn = page.locator('button:has-text("✕"), button[aria-label="Close"], button:has(svg.lucide-x)').first();
    if (await closeAlbertBtn.isVisible()) {
      await closeAlbertBtn.click();
      await page.waitForTimeout(400);
    }

    // -------------------------------------------------------------
    // Step 6: Delete Saved Mirror and Verify Storage Cleared
    // -------------------------------------------------------------
    console.log("[6/6] Testing Delete Saved Mirror control...");
    const deleteBtn = page.locator('button:has-text("Удалить сохранённое")').first();
    await deleteBtn.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    await deleteBtn.click();
    await page.waitForTimeout(600);

    const storageAfterDelete = await page.evaluate(() => localStorage.getItem("zerkalo.myMirror.v1"));
    if (storageAfterDelete !== null) {
      throw new Error("Expected localStorage key zerkalo.myMirror.v1 to be null after deletion, but got: " + storageAfterDelete);
    }
    console.log("  ✓ Confirmed localStorage key is null after delete");

    // Screenshot 6: Delete confirmation / clean state
    await page.screenshot({
      path: path.join(evidenceDir, "06-delete-saved-mirror-390x844.png"),
      clip: { x: 0, y: 0, width: 390, height: 844 },
    });
    console.log("  ✓ Captured 06-delete-saved-mirror-390x844.png");

    console.log("\n====================================================================");
    console.log("=== ALL ISSUE #20 ACCEPTANCE & RELOAD CHECKS PASSED SUCCESSFULLY ===");
    console.log("====================================================================\n");

  } finally {
    if (browser) await browser.close();
    serverProcess.kill("SIGTERM");
  }
}

runAcceptance().catch((err) => {
  console.error("Acceptance run failed:", err);
  process.exit(1);
});
