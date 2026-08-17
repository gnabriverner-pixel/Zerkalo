const { chromium } = require("@playwright/test");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");
const dotenv = require("dotenv");

const repoRoot = path.resolve(__dirname, "..");
const evidenceDir = path.join(repoRoot, "docs", "evidence", "bounded-release-polish");
const port = 3030;

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
  console.log("=== ISSUE #19: BOUNDED RELEASE POLISH VISUAL ACCEPTANCE (390x844) ===");
  console.log("====================================================================\n");

  fs.mkdirSync(evidenceDir, { recursive: true });

  const envConfig = dotenv.parse(fs.readFileSync(path.join(repoRoot, ".env")));

  // Start Live Server on port 3030
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

    // =============================================================
    // PASS 1: Main Flow (Screenshots 1, 2, 3, 5, 6)
    // =============================================================
    const context1 = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
    });
    const page1 = await context1.newPage();
    await page1.goto(`http://localhost:${port}`);
    await page1.waitForLoadState("networkidle");

    // 1. Digital Code Act I: Early Reward
    console.log("[1/6] Capturing Code Act I Early Reward (01-code-act1-early-reward-390x844.png)...");
    await fillCode(page1, "15", "08", "1990");
    await page1.waitForSelector('text=Душа', { timeout: 5000 });
    await page1.waitForSelector('text=Выражение', { timeout: 5000 });
    await page1.waitForSelector('text=Путь', { timeout: 5000 });
    await page1.waitForTimeout(800);

    await page1.screenshot({
      path: path.join(evidenceDir, "01-code-act1-early-reward-390x844.png"),
      clip: { x: 0, y: 0, width: 390, height: 844 },
    });
    console.log("  ✓ Captured 01-code-act1-early-reward-390x844.png");

    // 2. Digital Code Act VII: FirstMirror Evidence Block
    console.log("[2/6] Capturing Code Act VII FirstMirror Evidence Block (02-code-firstmirror-evidence-390x844.png)...");
    const act7El = page1.locator('text=Смысловой узор Кода · Материал для Встречи зеркал').first();
    await act7El.scrollIntoViewIfNeeded();
    await page1.waitForTimeout(800);

    await page1.screenshot({
      path: path.join(evidenceDir, "02-code-firstmirror-evidence-390x844.png"),
      clip: { x: 0, y: 0, width: 390, height: 844 },
    });
    console.log("  ✓ Captured 02-code-firstmirror-evidence-390x844.png");

    // 3. Complete Myth
    console.log("  Completing Personal Myth for synthesis...");
    const toMythBtn = page1.locator('button:has-text("Перейти к Личному мифу"), button:has-text("К зеркалам")').first();
    await toMythBtn.click();
    await page1.waitForTimeout(500);

    const navMyth = page1.locator('nav button:has-text("Миф")').first();
    if (await navMyth.isVisible()) {
      await navMyth.click();
      await page1.waitForTimeout(500);
    }

    await completeMythStepper(page1, {
      q1: "поиск баланса между разумом и чувством",
      q2: "каменный маяк на скалистом берегу",
      q3: "вечерняя тишина перед грозой",
      q4: "уверенность и спокойная глубина",
    });
    await page1.waitForSelector('text=Символические истоки', { timeout: 45000 });

    // Mock Meeting Response for equal divergence inspection
    await page1.route("**/api/lab/meeting/generate", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          status: "ok",
          result: {
            summary: "Встреча двух линз выявляет устойчивую связь между структурным ядром Кода и образным пространством Мифа.",
            confidenceNote: "Высокая согласованность",
            reflectiveQuestion: "Какая опора позволяет удерживать равновесие между структурой и образом?",
            albertInsight: "Код фиксирует архитектурный каркас, а Миф наполняет его живым дыханием.",
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

    const toMeetingBtn = page1.locator('button:has-text("Открыть Встречу зеркал"), button:has-text("К зеркалам"), nav button:has-text("Встреча")').first();
    await toMeetingBtn.click();
    await page1.waitForTimeout(500);

    const navMeeting1 = page1.locator('nav button:has-text("Встреча")').first();
    if (await navMeeting1.isVisible()) {
      await navMeeting1.click();
      await page1.waitForTimeout(500);
    }

    const runSynthBtn = page1.locator('button:has-text("Встречу"), button:has-text("Синтез")').first();
    await runSynthBtn.click();
    await page1.waitForSelector('text=Различия ракурсов', { timeout: 15000 });

    // 3. Capture Divergence Equal Evidence Card
    console.log("[3/6] Capturing Meeting Divergence Equal Evidence Card (03-meeting-divergence-equal-evidence-390x844.png)...");
    const divSection = page1.locator('text=Различия ракурсов').first();
    await divSection.scrollIntoViewIfNeeded();
    await page1.waitForTimeout(600);

    await page1.screenshot({
      path: path.join(evidenceDir, "03-meeting-divergence-equal-evidence-390x844.png"),
      clip: { x: 0, y: 0, width: 390, height: 844 },
    });
    console.log("  ✓ Captured 03-meeting-divergence-equal-evidence-390x844.png");

    // 5. Capture Continuation CTA Block
    console.log("[5/6] Capturing Meeting Continuation Block (05-meeting-continuation-cta-390x844.png)...");
    const ctaSection = page1.locator('text=Исследовать синтез с Альбертом').first();
    await ctaSection.scrollIntoViewIfNeeded();
    await page1.waitForTimeout(600);

    await page1.screenshot({
      path: path.join(evidenceDir, "05-meeting-continuation-cta-390x844.png"),
      clip: { x: 0, y: 0, width: 390, height: 844 },
    });
    console.log("  ✓ Captured 05-meeting-continuation-cta-390x844.png");

    // 6. Capture Web Albert Modal Opened via Primary CTA
    console.log("[6/6] Capturing Context-Grounded Web Albert Modal (06-web-albert-open-after-meeting-390x844.png)...");
    const openAlbertBtn = page1.locator('button:has-text("Диалог на сайте")').first();
    await openAlbertBtn.click();
    await page1.waitForSelector('text=Альберт Вяземский', { timeout: 10000 });
    await page1.waitForTimeout(1000);

    await page1.screenshot({
      path: path.join(evidenceDir, "06-web-albert-open-after-meeting-390x844.png"),
      clip: { x: 0, y: 0, width: 390, height: 844 },
    });
    console.log("  ✓ Captured 06-web-albert-open-after-meeting-390x844.png");

    await context1.close();

    // =============================================================
    // PASS 2: Zero Resonance State (Screenshot 4)
    // =============================================================
    console.log("[4/6] Capturing Zero Resonance Complete Result Card (04-meeting-zero-resonance-390x844.png)...");
    const context2 = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
    });
    const page2 = await context2.newPage();
    await page2.goto(`http://localhost:${port}`);
    await page2.waitForLoadState("networkidle");

    await fillCode(page2, "07", "03", "1988");

    const toMyth2 = page2.locator('button:has-text("Перейти к Личному мифу"), button:has-text("К зеркалам")').first();
    await toMyth2.click();
    await page2.waitForTimeout(500);

    const navMyth2 = page2.locator('nav button:has-text("Миф")').first();
    if (await navMyth2.isVisible()) {
      await navMyth2.click();
      await page2.waitForTimeout(500);
    }

    await completeMythStepper(page2, {
      q1: "поиск новой опоры",
      q2: "сосновый лес ранним утром",
      q3: "момент тишины на вершине холма",
      q4: "ясность взгляда и спокойствие",
    });
    await page2.waitForSelector('text=Символические истоки', { timeout: 45000 });

    // Mock 0 Parallels Response
    await page2.route("**/api/lab/meeting/generate", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          status: "ok",
          result: {
            summary: "Две независимые линзы показывают непересекающиеся плоскости восприятия без поверхностных аналогий.",
            confidenceNote: "Честная автономия линз",
            reflectiveQuestion: "Как использовать несвязанность двух зеркал как свободу выбора направления?",
            albertInsight: "Отсутствие явных параллелей подтверждает независимость методов и предотвращает ложные совпадения.",
            parallels: [],
            divergences: [
              {
                theme: "Полная автономия фокусов внимания",
                codeAspect: "Код сосредоточен на точности логических алгоритмов и долге",
                mythAspect: "Миф обращен к чистой поэтической метафоре ветра и простора",
                reflection: "Каждая линза решает свою задачу, не пытаясь подстроиться под другую."
              }
            ]
          }
        }),
      });
    });

    const toMeeting2 = page2.locator('button:has-text("Открыть Встречу зеркал"), button:has-text("К зеркалам"), nav button:has-text("Встреча")').first();
    await toMeeting2.click();
    await page2.waitForTimeout(500);

    const navMeeting2 = page2.locator('nav button:has-text("Встреча")').first();
    if (await navMeeting2.isVisible()) {
      await navMeeting2.click();
      await page2.waitForTimeout(500);
    }

    const runSynth2 = page2.locator('button:has-text("Встречу"), button:has-text("Синтез")').first();
    await runSynth2.click();
    await page2.waitForSelector('text=Нулевая встреча — полноценный результат', { timeout: 15000 });

    const zeroResEl = page2.locator('text=Нулевая встреча — полноценный результат').first();
    await zeroResEl.scrollIntoViewIfNeeded();
    await page2.waitForTimeout(600);

    await page2.screenshot({
      path: path.join(evidenceDir, "04-meeting-zero-resonance-390x844.png"),
      clip: { x: 0, y: 0, width: 390, height: 844 },
    });
    console.log("  ✓ Captured 04-meeting-zero-resonance-390x844.png");

    await context2.close();

    console.log("\n====================================================================");
    console.log("=== ALL ISSUE #19 VISUAL SCREENSHOTS CAPTURED SUCCESSFULLY ===");
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
