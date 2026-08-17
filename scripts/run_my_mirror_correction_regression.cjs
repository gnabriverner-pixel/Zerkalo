const { chromium } = require("@playwright/test");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");
const dotenv = require("dotenv");

const repoRoot = path.resolve(__dirname, "..");
const port = 3042;

async function runRegressionProof() {
  console.log("====================================================================");
  console.log("=== ISSUE #20 CORRECTION: TARGETED SESSION INTEGRITY REGRESSION ===");
  console.log("====================================================================\n");

  const envConfig = dotenv.parse(fs.readFileSync(path.join(repoRoot, ".env")));

  const serverProcess = spawn("npx", ["tsx", "server.ts"], {
    cwd: repoRoot,
    env: { ...process.env, ...envConfig, PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let browser;

  try {
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
    });
    const page = await context.newPage();

    // 1. Initial Load & Setup Meeting A in localStorage
    console.log("[1] Setting up initial Meeting A snapshot...");
    await page.goto(`http://localhost:${port}`);
    await page.waitForLoadState("networkidle");

    const sampleSnapshotA = {
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
        summary: "Встреча двух линз выявляет устойчивую связь между структурой и образом (Meeting A).",
        hasStrongParallels: true,
        confidenceNote: "Высокая согласованность",
        reflectiveQuestion: "Какая опора позволяет удерживать равновесие?",
        albertInsight: "Код фиксирует каркас, Миф дает дыхание.",
        disclaimer: "Синтез носит исследовательский характер",
        parallels: [
          {
            theme: "Удержание внутренней опоры",
            codeAnchor: "Число Души 6",
            mythAnchor: "Образ маяка",
            synthesis: "Оба зеркала сходятся на оси."
          }
        ],
        divergences: [
          {
            theme: "Динамика контроля",
            codeAspect: "Стратегический контроль",
            mythAspect: "Созерцание",
            reflection: "Две стороны единого процесса."
          }
        ]
      },
      meetingUserNote: "Личная заметка A"
    };

    await page.evaluate((snap) => {
      localStorage.setItem("zerkalo.myMirror.v1", JSON.stringify(snap));
    }, sampleSnapshotA);

    await page.reload();
    await page.waitForLoadState("networkidle");

    // 2. Restore Meeting A from localStorage
    console.log("[2] Restoring Meeting A from localStorage...");
    const restoreBtn = page.locator('button:has-text("Открыть сохранённое")').first();
    await restoreBtn.waitFor({ state: "visible" });
    await restoreBtn.click();
    await page.waitForSelector('text=Встреча двух линз выявляет устойчивую связь между структурой и образом (Meeting A).', { timeout: 10000 });
    console.log("  ✓ Meeting A active and rendered in memory");

    // Check saved badge for Meeting A: must be true
    const savedBadge = page.locator('text=Сохранено в этом браузере').first();
    await savedBadge.waitFor({ state: "visible", timeout: 5000 });
    console.log("  ✓ Save badge is truthful (active Meeting A matches saved snapshot)");

    // 3. User calculates a NEW code with a different DOB
    console.log("[3] Calculating new Code with different DOB (05.05.1985)...");
    const navCode = page.locator('nav button:has-text("Код")').first();
    await navCode.click();
    await page.waitForTimeout(600);

    const otherDateBtn = page.locator('button:has-text("Другая дата")').first();
    await otherDateBtn.scrollIntoViewIfNeeded();
    await otherDateBtn.waitFor({ state: "visible", timeout: 8000 });
    await otherDateBtn.click();
    await page.waitForTimeout(400);

    const dayInput = page.locator('input[placeholder="ДД"]').first();
    const monthInput = page.locator('input[placeholder="ММ"]').first();
    const yearInput = page.locator('input[placeholder="ГГГГ"]').first();

    await dayInput.waitFor({ state: "visible", timeout: 10000 });
    await dayInput.fill("05");
    await monthInput.fill("05");
    await yearInput.fill("1985");

    const submitBtn = page.locator('button[type="submit"]').first();
    await submitBtn.click();
    await page.waitForSelector('text=Акт I · Личная формула', { timeout: 15000 });
    console.log("  ✓ New Code calculated (05.05.1985)");

    // 4. Navigate to Meeting -> Verify Stale Meeting A is INVALIDATED
    console.log("[4] Verifying active Meeting is invalidated in memory after Code change...");
    const toMeetingBtn = page.locator('button:has-text("Открыть Встречу зеркал"), button:has-text("К зеркалам")').first();
    await toMeetingBtn.scrollIntoViewIfNeeded();
    await toMeetingBtn.click();
    await page.waitForTimeout(600);

    const navMeeting = page.locator('nav button:has-text("Встреча")').first();
    if (await navMeeting.isVisible()) {
      await navMeeting.click();
      await page.waitForTimeout(600);
    }

    // Stale Meeting A text should NOT be present
    const staleTextCount = await page.locator('text=Meeting A').count();
    if (staleTextCount > 0) {
      throw new Error("Stale Meeting A was NOT invalidated after new Code calculation!");
    }
    // Synthesis button should be visible to prompt a new synthesis
    const synthPrompt = page.locator('button:has-text("Встречу"), button:has-text("Синтез")').first();
    await synthPrompt.waitFor({ state: "visible", timeout: 5000 });
    console.log("  ✓ Stale Meeting A is null in memory; new synthesis prompt displayed");

    // 5. Verify localStorage snapshot for Meeting A was NOT deleted
    console.log("[5] Verifying localStorage snapshot was preserved unchanged...");
    const storageRaw = await page.evaluate(() => localStorage.getItem("zerkalo.myMirror.v1"));
    if (!storageRaw) throw new Error("localStorage snapshot was wiped prematurely!");
    const stored = JSON.parse(storageRaw);
    if (stored.codeDate !== "15.08.1990" || !stored.meetingResult.summary.includes("Meeting A")) {
      throw new Error("localStorage snapshot was corrupted!");
    }
    console.log("  ✓ localStorage snapshot for 15.08.1990 preserved intact");

    // 6. Go to Entry threshold and restore original Meeting A again
    console.log("[6] Restoring original Meeting A from threshold...");
    const navLogo = page.locator('header button[title="Главная"], header button').first();
    await navLogo.click({ force: true });
    await page.waitForTimeout(600);

    const restoreAgainBtn = page.locator('button:has-text("Открыть сохранённое")').first();
    await restoreAgainBtn.scrollIntoViewIfNeeded();
    await restoreAgainBtn.waitFor({ state: "visible", timeout: 10000 });
    await restoreAgainBtn.click();
    await page.waitForSelector('text=Meeting A', { timeout: 10000 });
    console.log("  ✓ Meeting A restored cleanly again from preserved snapshot");

    console.log("\n====================================================================");
    console.log("=== ALL SESSION INTEGRITY REGRESSION PROOFS PASSED SUCCESSFULLY ===");
    console.log("====================================================================\n");

  } finally {
    if (browser) await browser.close();
    serverProcess.kill("SIGTERM");
  }
}

runRegressionProof().catch((err) => {
  console.error("Regression proof failed:", err);
  process.exit(1);
});
