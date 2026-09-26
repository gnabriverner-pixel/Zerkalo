import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { chromium, type Browser } from "playwright";
import {
  classifyQ3Content,
  hasSourceOriginConflation,
} from "../src/services/meetingContract";
import { buildMeetingOfMirrorsPrompt } from "../src/services/mythPrompts";
import { containsCrisisLanguageText, SAFE_CRISIS_MESSAGE } from "../server/myth";
import { CONSENT_VERSION } from "../src/services/consent";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.resolve(REPO_ROOT, "../../outputs/convergence-evidence-v6");
const LIVE_RUNS_DIR = path.join(OUT_DIR, "live-runs");
fs.mkdirSync(LIVE_RUNS_DIR, { recursive: true });

function git(cmd: string, ...args: string[]): string {
  return execFileSync("git", [cmd, ...args], { cwd: REPO_ROOT, encoding: "utf8" }).trim();
}

const WEB_SHA = git("rev-parse", "HEAD");
let WEB_PIN = WEB_SHA;
let DCS_SHA = "14fecae953fda67b9bea50af239412714f5a7b3a";

try {
  const compatPath = path.join(REPO_ROOT, "release-compatibility.json");
  if (fs.existsSync(compatPath)) {
    const compat = JSON.parse(fs.readFileSync(compatPath, "utf8"));
    if (compat.web?.pinned_sha) WEB_PIN = compat.web.pinned_sha;
    if (compat.dcs?.pinned_sha) DCS_SHA = compat.dcs.pinned_sha;
  }
} catch (err) {
  console.warn("[v6] Could not read release-compatibility.json:", err);
}

async function verifyLiveServicesOrThrow(): Promise<void> {
  console.log("[v6] Pre-flight: Verifying live Web and DCS services against candidate pins...");

  const webRes = await fetch("http://127.0.0.1:3000/health").catch((e) => {
    throw new Error(`Web server on port 3000 is unreachable: ${e.message}`);
  });
  if (!webRes.ok) throw new Error(`Web health returned HTTP ${webRes.status}`);
  const webHealth: any = await webRes.json();

  const dcsRes = await fetch("http://127.0.0.1:8090/health").catch((e) => {
    throw new Error(`DCS server on port 8090 is unreachable: ${e.message}`);
  });
  if (!dcsRes.ok) throw new Error(`DCS health returned HTTP ${dcsRes.status}`);
  const dcsHealth: any = await dcsRes.json();

  console.log(`[v6] Live Web SHA: ${webHealth.releaseSha} (dirty: ${webHealth.dirty})`);
  console.log(`[v6] Live DCS SHA: ${dcsHealth.sha}`);

  if (webHealth.releaseSha !== WEB_SHA && webHealth.releaseSha !== WEB_PIN) {
    throw new Error(
      `Web SHA mismatch: running ${webHealth.releaseSha}, expected HEAD ${WEB_SHA} or PIN ${WEB_PIN}`
    );
  }
  if (dcsHealth.sha !== DCS_SHA) {
    throw new Error(
      `DCS SHA mismatch: running ${dcsHealth.sha}, expected PIN ${DCS_SHA}`
    );
  }
  console.log("[v6] Pre-flight verification passed: services are healthy and match candidate pins.");
}

function runDefect1Check(): boolean {
  console.log("[v6] Running Check 1: Defect 1 Matrix (Source Origin Separation)...");

  // Verify mundane objects at work are classified as real experience
  const mundaneFolderClassification = classifyQ3Content("На работе я раскладываю документы по папкам");
  const mundaneFolderOk = mundaneFolderClassification === "real_experience";
  if (!mundaneFolderOk) {
    console.error(
      `[v6] FAIL: classifyQ3Content('На работе я раскладываю документы по папкам') was '${mundaneFolderClassification}', expected 'real_experience'`
    );
  }

  const rawCases = [
    {
      id: "case_1_real_action_in_q3",
      description: "Реальное действие в q3 («Когда на работе спокойно разбираю сложную архитектуру»)",
      q1: "На проекте срочный релиз и постоянные споры о сроках.",
      q2: "Тяжёлый чугунный маховик, который трудно сдвинуть.",
      q3: "Когда на работе спокойно разбираю сложную архитектуру с командой по шагам.",
      q4: "Спокойно удерживать границы и ясный план.",
      storyResult: "В старой кузнице мастер положил ладонь на маховик.",
      expected_q3_kind: "real_experience",
      valid_meeting_text: "В вашей реальной практике уже есть точка живости: вы спокойно разбираете сложную архитектуру с командой по шагам.",
      invalid_meeting_text: "В выбранной вами воображаемой сцене вы спокойно разбираете сложную архитектуру.",
    },
    {
      id: "case_2_imaginative_scene_in_q3",
      description: "Воображаемая сцена в q3 («Как будто стою на маяке над ночным штормом»)",
      q1: "Руководитель просит взять ещё один отдел.",
      q2: "Перетянутая струна.",
      q3: "Как будто стою на вершине старого каменного маяка над ночным океаном.",
      q4: "Хочу научиться говорить твёрдое нет без чувства вины.",
      storyResult: "Маяк светил сквозь густой туман.",
      expected_q3_kind: "imaginative_scene",
      valid_meeting_text: "В выбранном вами образе точки живости возникает маяк над ночным океаном — как ориентир спокойной высоты.",
      invalid_meeting_text: "Вы уже умеете стоять на вершине маяка в реальной жизни и это ваш реальный опыт.",
    },
    {
      id: "case_3_unknown_resource_in_q3",
      description: "Неизвестный ресурс в q3 («Не знаю, сейчас ничего не вспоминается»)",
      q1: "Устал от бесконечных созвонов и правок.",
      q2: "Серая губка, пропитанная водой.",
      q3: "Не знаю, честно говоря, сейчас ничего не вспоминается.",
      q4: "Вернуть тишину и нормальный сон.",
      storyResult: "Путник остановился у тихого колодца в сумерках.",
      expected_q3_kind: "unknown_resource",
      valid_meeting_text: "Сейчас вы прямо отмечаете, что точка живости не вспоминается — значит, проверенную опору ещё предстоит бережно нащупать.",
      invalid_meeting_text: "У вас уже есть проверенная опора в реальной практике, где вы восстанавливаете тишину.",
    },
    {
      id: "case_4_wish_in_q4_not_mastered_skill",
      description: "Желание в q4 («Хочется научиться спокойно отказывать без оправданий»)",
      q1: "Коллеги перекладывают на меня срочные задачи в пятницу вечером.",
      q2: "Рюкзак с чужими камнями.",
      q3: "Когда утром до созвонов спокойно пишу код в тишине.",
      q4: "Хочется научиться спокойно отказывать без долгих оправданий.",
      storyResult: "Путник снял рюкзак на перевале.",
      expected_q3_kind: "ambiguous",
      valid_meeting_text: "Ваше желаемое направление — научиться спокойно отказывать без долгих оправданий.",
      invalid_meeting_text: "Вы уже умеете спокойно отказывать без долгих оправданий, это ваш освоенный навык.",
    },
    {
      id: "case_5_colleague_quote_in_q1",
      description: "Цитата о коллеге в q1 («Коллега кричит на планерках и грозит бросить проект»)",
      q1: "Коллега кричит на планерках: «я брошу этот проект», а мне приходится гасить конфликт.",
      q2: "Натянутый канат.",
      q3: "Когда веду техническое ревью один на один.",
      q4: "Разделить зоны ответственности в команде.",
      storyResult: "Канат звенел над ущельем.",
      expected_q3_kind: "ambiguous",
      valid_meeting_text: "В вашей ситуации напряжение связано с тем, что коллега кричит на планерках и грозит бросить проект, а вы гасите конфликт.",
      invalid_meeting_text: "Вы кричите на планерках и бросаете проект, когда напряжение растёт.",
    },
    {
      id: "case_6_detail_only_in_myth",
      description: "Деталь, появившаяся только в Мифе («серебряный компас и старый часовщик»)",
      q1: "Выбираю между переходом в новую команду и текущим местом.",
      q2: "Развилка двух лесных троп.",
      q3: "Когда довожу аналитическую записку до полной ясности.",
      q4: "Понять, где больше пространства для роста.",
      storyResult: "На развилке старый часовщик протянул путнику серебряный компас с гравировкой северной звезды.",
      expected_q3_kind: "ambiguous",
      valid_meeting_text: "Образ развилки двух лесных троп и художественная сцена со старым часовщиком в Мифе подсвечивают выбор темпа.",
      invalid_meeting_text: "Вы сами написали в анкете про старого часовщика и серебряный компас.",
    },
  ];

  const evaluatedCases = rawCases.map((c) => {
    const q3Class = classifyQ3Content(c.q3, c.q2);
    const sourceContext = {
      userQuestion: c.q1,
      storyInputs: {
        userName: "Тест",
        userQuestion: c.q1,
        q1: c.q1,
        q2: c.q2,
        q3: c.q3,
        q4: c.q4,
      },
      storyResult: {
        title: "Развилка",
        story: c.storyResult,
        mirror: {
          mainImage: c.q2,
          innerTension: c.q1,
          hiddenResource: c.q3,
          newView: c.q4,
        },
        meaning: c.q4,
        one_step: c.q4,
        journal_question: c.q4,
      },
    };

    const validCheck = hasSourceOriginConflation(c.valid_meeting_text, sourceContext);
    const invalidCheck = hasSourceOriginConflation(c.invalid_meeting_text, sourceContext);

    const prompt = buildMeetingOfMirrorsPrompt(
      {
        calc: { soul: 1, path: 4, expression: 5, direction: 5, result: 3 },
        firstMirror: {
          interpretationVersion: "v2",
          title: "Опора на структуру",
          keyInsight: "Опора на ясный шаг",
          blocks: [],
          practicalStep: "Один шаг",
        },
      } as any,
      sourceContext as any
    );

    const provenanceOk =
      prompt.includes("Личный вопрос и q1") &&
      prompt.includes("q2 («Предмет или образ состояния»)") &&
      prompt.includes("q3 («Точка живости") &&
      prompt.includes("q4 («Чего хочется больше в ситуации»)") &&
      prompt.includes("Художественный текст Мифа (storyResult");

    const passed = !validCheck && invalidCheck && provenanceOk;

    return {
      id: c.id,
      description: c.description,
      q1: c.q1,
      q2: c.q2,
      q3: c.q3,
      q4: c.q4,
      storyResult: c.storyResult,
      classified_q3: q3Class,
      valid_meeting_text: c.valid_meeting_text,
      invalid_meeting_text: c.invalid_meeting_text,
      valid_text_rejected: validCheck,
      invalid_text_rejected: invalidCheck,
      prompt_has_separate_q2_q3_q4_story_provenance: provenanceOk,
      passed,
    };
  });

  const allPassed = mundaneFolderOk && evaluatedCases.every((c) => c.passed);

  fs.writeFileSync(
    path.join(LIVE_RUNS_DIR, "defect1-source-origin-matrix.json"),
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        pair: { web_pin: WEB_PIN, web_sha: WEB_SHA, dcs_sha: DCS_SHA },
        mundane_folder_at_work_classified_as_real_experience: mundaneFolderOk,
        all_passed: allPassed,
        cases: evaluatedCases,
      },
      null,
      2
    ) + "\n"
  );

  console.log(`[v6] Defect 1 Matrix: ${allPassed ? "PASSED (6/6 + mundane folder)" : "FAILED"}`);
  return allPassed;
}

async function runDefect2Check(browser: Browser): Promise<boolean> {
  console.log("[v6] Running Check 2: Defect 2 Matrix (Crisis Self-Quote Detection + HTTP Crisis Safe Handler + Native UI)...");

  const crisisCases = [
    {
      id: "direct_self_quote_longer_context",
      text: "Я сейчас думаю: «хочу умереть». Это про меня и я не вижу выхода.",
      expected_crisis: true,
    },
    {
      id: "mixed_external_quote_plus_self_endorsement",
      text: "В романе герой говорит: «хочу умереть», и это про меня.",
      expected_crisis: true,
    },
    {
      id: "self_addressed_quote",
      text: "Я говорю себе: «не хочу больше жить», потому что совсем нет сил.",
      expected_crisis: true,
    },
    {
      id: "benign_third_party_book_quote",
      text: "В романе герой говорит: «хочу умереть», но автор показывает это как сцену отчаяния персонажа.",
      expected_crisis: false,
    },
    {
      id: "benign_explicit_negation",
      text: "Я точно не хочу умереть и не собираюсь причинять себе вред, просто хочу сменить работу.",
      expected_crisis: false,
    },
    {
      id: "benign_work_metaphor",
      text: "Этот дедлайн — просто профессиональное самоубийство для нашей команды.",
      expected_crisis: false,
    },
  ];

  const evaluatedCrisis: any[] = [];

  for (const c of crisisCases) {
    const unitResult = containsCrisisLanguageText(c.text);
    let httpResult: any = null;

    if (c.expected_crisis) {
      const page = await browser.newPage();
      try {
        await page.goto("http://127.0.0.1:3000", { waitUntil: "networkidle" });
        const res = await page.evaluate(
          async ({ text, version }) => {
            const consentRes = await fetch("/api/consent", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ accepted: true, adult: true, version, scope: "core" }),
            });
            if (!consentRes.ok)
              return { status: consentRes.status, body: await consentRes.json(), consentFailed: true };

            const meetingRes = await fetch("/api/meeting-of-mirrors", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                codeText: "Сознание 1, Действие 4",
                storyResult: "Путник стоял на мосту.",
                archetype: "Искатель",
                shadowArchetype: "Беглец",
                userName: "Тест",
                userQuestion: text,
                q1: "Тяжёлый период",
                q2: "Камень",
                q3: "Не знаю",
                q4: "Тишина",
              }),
            });
            return { status: meetingRes.status, body: await meetingRes.json(), consentFailed: false };
          },
          { text: c.text, version: CONSENT_VERSION }
        );

        httpResult = res;
      } finally {
        await page.close();
      }
    }

    const unitMatches = unitResult === c.expected_crisis;
    const httpPassed =
      !c.expected_crisis ||
      (httpResult?.status === 200 &&
        httpResult?.consentFailed === false &&
        (httpResult?.body?.status === "crisis" || httpResult?.body?.crisis === true) &&
        typeof httpResult?.body?.ui?.safe_message === "string" &&
        httpResult.body.ui.safe_message.includes("важнее не образная история, а живая поддержка"));

    const casePassed = unitMatches && httpPassed;

    evaluatedCrisis.push({
      id: c.id,
      text: c.text,
      expected_crisis: c.expected_crisis,
      unit_detector_result: unitResult,
      http_status: httpResult?.status ?? "skipped_for_benign_to_avoid_llm_spend",
      http_crisis_status: httpResult?.body?.status ?? null,
      http_safe_message: httpResult?.body?.ui?.safe_message ?? null,
      passed: casePassed,
    });
  }

  // Native UI Walkthrough: Meeting of Mirrors Crisis Component (NO SYNTHETIC OVERLAYS!)
  let nativeCrisisUiRendered = false;
  let nativeCrisisMessageText = "";
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    try {
      await page.goto("http://127.0.0.1:3000", { waitUntil: "networkidle" });
      await page.evaluate(async (version) => {
        await fetch("/api/consent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accepted: true, adult: true, version, scope: "core" }),
        });
        sessionStorage.setItem(
          "zerkalo.transientDraft.v1",
          JSON.stringify({
            version: 1,
            updatedAt: new Date().toISOString(),
            mode: "meeting",
            codeDate: "15.08.1988",
            userQuestion:
              "Друг написал мне в сообщении: «хочу умереть», не знаю как жить дальше. Как мне поддержать его и не сломаться?",
            codeResult: { day: 15, month: 8, year: 1988, soul: 6, expression: 4, path: 4, direction: 1, result: 2 },
            firstMirror: {
              title: "Первое зеркало",
              keyInsight: "Число Души 6: гармония и ответственность.",
              practicalStep: "Определить главную задачу дня.",
              interpretationVersion: "v2",
            },
            storyInputs: { q1: "Много задач", q2: "Камень", q3: "Утро", q4: "Ясность" },
            storyResult: { title: "Тихий берег", story: "Путник на берегу озера нашел тишину." },
          })
        );
      }, CONSENT_VERSION);

      await page.reload({ waitUntil: "networkidle" });
      const draftBtn = await page.waitForSelector('button:has-text("Продолжить")', { timeout: 10000 });
      await draftBtn.click();

      const synthBtn = await page.waitForSelector('button:has-text("Провести Встречу зеркал")', { timeout: 10000 });
      await synthBtn.click();

      const crisisEl = await page.waitForSelector('[data-testid="meeting-crisis-support"]', { timeout: 15000 });
      nativeCrisisMessageText = await crisisEl.innerText();
      nativeCrisisUiRendered = nativeCrisisMessageText.includes("ВАЖНОЕ СООБЩЕНИЕ ПОДДЕРЖКИ");

      await page.screenshot({ path: path.join(LIVE_RUNS_DIR, "defect2-crisis-self-quote-ui.png") });
      console.log("[v6] Native crisis UI component rendered and screenshot saved.");
    } finally {
      await page.close();
    }
  }

  const allPassed = evaluatedCrisis.every((c) => c.passed) && nativeCrisisUiRendered;

  fs.writeFileSync(
    path.join(LIVE_RUNS_DIR, "defect2-crisis-self-quote-matrix.json"),
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        pair: { web_pin: WEB_PIN, web_sha: WEB_SHA, dcs_sha: DCS_SHA },
        all_passed: allPassed,
        native_ui_rendered: nativeCrisisUiRendered,
        native_crisis_text: nativeCrisisMessageText,
        screenshot: "live-runs/defect2-crisis-self-quote-ui.png",
        cases: evaluatedCrisis,
      },
      null,
      2
    ) + "\n"
  );

  console.log(`[v6] Defect 2 Matrix: ${allPassed ? "PASSED (6/6 + native UI component)" : "FAILED"}`);
  return allPassed;
}

async function runRouteACheck(browser: Browser): Promise<boolean> {
  console.log("[v6] Running Check 3: Route A (Code -> Albert BEFORE Myth via Native UI & API)...");

  // 1. API Multi-Turn Dialogue Verification (4 turns with codeAnchors ONLY, NO mythAnchors)
  const ownerPrompts = [
    "Объясни проще: что эти числа говорят именно про мой вопрос?",
    "Почему мне так трудно не включаться в чужие пожары?",
    "Какой один шаг проверить на этой неделе без перегруза?",
    "Как понять по ощущениям, что я снова ушёл в автоматический сценарий?",
  ];

  const albertTurns: any[] = [];
  const history: Array<{ sender: "user" | "albert"; text: string }> = [];

  const apiPage = await browser.newPage();
  let codeResp: any = null;
  try {
    await apiPage.goto("http://127.0.0.1:3000", { waitUntil: "networkidle" });
    await apiPage.evaluate(async (version) => {
      await fetch("/api/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accepted: true, adult: true, version, scope: "core" }),
      });
    }, CONSENT_VERSION);

    codeResp = await apiPage.evaluate(async () => {
      const res = await fetch("/api/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dob: "15.05.1990",
          token: "v6-route-a-calc-19900515",
        }),
      });
      return { status: res.status, body: await res.json() };
    });

    for (let i = 0; i < ownerPrompts.length; i++) {
      const promptText = ownerPrompts[i];
      const turnRes = await apiPage.evaluate(
        async ({ promptText, historyPayload }) => {
          const res = await fetch("/api/albert/dialogue", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              message: promptText,
              history: historyPayload,
              context: {
                userQuestion: "Как перестать тащить чужие задачи и выбрать свой фокус в проекте?",
                codeAnchors: {
                  numbers: { soul: 6, path: 5, direction: 2, expression: 9, result: 3 },
                  keyInsight: "Опора на ответственность и качество связи, где важно не подменять чужую работу своей.",
                  mainPattern: "Стремление удерживать гармонию и доводить общее дело до результата.",
                  strength: "Способность видеть узкие места и надёжно держать слово.",
                  tension: "Риск брать на себя чужие обязательства ради сохранения спокойствия.",
                },
                // Explicitly NO mythAnchors / NO meetingSummary — proving Code -> Albert BEFORE Myth
              },
            }),
          });
          return { status: res.status, body: await res.json() };
        },
        { promptText, historyPayload: history }
      );

      const replyText = turnRes.body?.message || "";
      history.push({ sender: "user", text: promptText });
      history.push({ sender: "albert", text: replyText });

      const nonEmpty = turnRes.status === 200 && replyText.trim().length > 40;
      albertTurns.push({
        turn: i + 1,
        user_prompt: promptText,
        http_status: turnRes.status,
        reply: replyText,
        provider: turnRes.body?.provider || null,
        model: turnRes.body?.model || null,
        authority: turnRes.body?.authority || null,
        non_empty_live_reply: nonEmpty,
      });
    }
  } finally {
    await apiPage.close();
  }

  // 2. Native Playwright UI Walkthrough: Landing -> DOB -> Calculate -> Open Code -> Consent -> Modal <AlbertDialogue> -> Send question -> Live answer rendered
  let nativeUiDialogueSuccess = false;
  let nativeAlbertResponsePreview = "";
  const uiPage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  try {
    await uiPage.goto("http://127.0.0.1:3000", { waitUntil: "networkidle" });

    // Fill DOB
    const dayInput = await uiPage.waitForSelector('input[placeholder="ДД"]', { timeout: 10000 });
    await dayInput.fill("15");
    const monthInput = await uiPage.waitForSelector('input[placeholder="ММ"]', { timeout: 5000 });
    await monthInput.fill("05");
    const yearInput = await uiPage.waitForSelector('input[placeholder="ГГГГ"]', { timeout: 5000 });
    await yearInput.fill("1990");

    const calcBtn = await uiPage.waitForSelector('button:has-text("Рассчитать код")', { timeout: 5000 });
    await calcBtn.click();

    // Click "Открыть мой Код"
    const openCodeBtn = await uiPage.waitForSelector('button:has-text("Открыть мой Код")', { timeout: 10000 });
    await openCodeBtn.click();

    // Consent modal
    const consentHeading = await uiPage.waitForSelector("#consent-heading", { timeout: 8000 }).catch(() => null);
    if (consentHeading) {
      const checkbox = await uiPage.waitForSelector('input[type="checkbox"]', { timeout: 5000 });
      await checkbox.click();
      const acceptBtn = await uiPage.waitForSelector('button:has-text("Согласиться и продолжить")', { timeout: 5000 });
      await acceptBtn.click();
    }

    // Wait for Albert button and click it
    const albertBtn = await uiPage.waitForSelector(
      'button:has-text("Обсудить с Альбертом"), button:has-text("Поговорить с Альбертом")',
      { timeout: 25000 }
    );
    await albertBtn.click();

    // Verify modal is open
    await uiPage.waitForSelector('div[role="dialog"]', { timeout: 10000 });

    // Type question and send
    const input = await uiPage.waitForSelector('input[placeholder*="Задайте вопрос Альберту"]', { timeout: 5000 });
    await input.fill("Объясни проще: что эти числа говорят именно про мой вопрос?");

    const sendBtn = await uiPage.waitForSelector('button[type="submit"][aria-label="Отправить сообщение"]', { timeout: 5000 });
    await sendBtn.click();

    // Wait for live Albert response in native dialogue component (greeting is 1st, answer is 2nd)
    await uiPage.waitForFunction(() => {
      const msgs = document.querySelectorAll('div[role="dialog"] div.font-serif.text-\\[18px\\]');
      return msgs.length >= 2;
    }, { timeout: 35000 });

    const replyElements = await uiPage.$$('div[role="dialog"] div.font-serif.text-\\[18px\\]');
    nativeAlbertResponsePreview = await replyElements[replyElements.length - 1].innerText();
    nativeUiDialogueSuccess = nativeAlbertResponsePreview.trim().length > 40;

    await uiPage.screenshot({ path: path.join(LIVE_RUNS_DIR, "code-to-albert-before-myth.png") });
    console.log("[v6] Native AlbertDialogue modal rendered with live reply and screenshot saved.");
  } finally {
    await uiPage.close();
  }

  const allTurnsSucceeded =
    codeResp?.status === 200 &&
    albertTurns.length === 4 &&
    albertTurns.every((t) => t.non_empty_live_reply) &&
    nativeUiDialogueSuccess;

  fs.writeFileSync(
    path.join(LIVE_RUNS_DIR, "code-to-albert-before-myth.json"),
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        pair: { web_pin: WEB_PIN, web_sha: WEB_SHA, dcs_sha: DCS_SHA },
        route: "Code -> Albert BEFORE Myth (/api/calculate + /api/albert/dialogue with codeAnchors only, no mythAnchors)",
        digital_code_status: codeResp?.status,
        digital_code_canonical_authority: codeResp?.body?.result?.canonicalAuthority || null,
        turns_count: albertTurns.length,
        all_turns_succeeded: allTurnsSucceeded,
        turns: albertTurns,
        native_ui_walkthrough: {
          success: nativeUiDialogueSuccess,
          response_preview: nativeAlbertResponsePreview.slice(0, 200),
        },
        screenshot: "live-runs/code-to-albert-before-myth.png",
      },
      null,
      2
    ) + "\n"
  );

  console.log(`[v6] Route A: ${allTurnsSucceeded ? "PASSED (4/4 live API turns + native UI dialogue)" : "FAILED"}`);
  return allTurnsSucceeded;
}

async function runRouteBCheck(browser: Browser): Promise<boolean> {
  console.log("[v6] Running Check 4: Route B (Telegram Local Gate via Native UI & API)...");

  // 1. API Verification: POST /api/handoff/create-claim -> 503 telegram_destination_unavailable
  const apiPage = await browser.newPage();
  let claimResult: any = null;
  try {
    await apiPage.goto("http://127.0.0.1:3000", { waitUntil: "networkidle" });
    await apiPage.evaluate(async (version) => {
      await fetch("/api/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accepted: true, adult: true, version, scope: "core" }),
      });
      await fetch("/api/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accepted: true, adult: true, version, scope: "telegram_transfer" }),
      });
    }, CONSENT_VERSION);

    claimResult = await apiPage.evaluate(async () => {
      const res = await fetch("/api/handoff/create-claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          birthDate: "15.05.1990",
          userName: "Артем",
          userQuestion: "Проверка локального гейта Telegram",
        }),
      });
      return {
        claim_status: res.status,
        claim_body: await res.json(),
      };
    });
  } finally {
    await apiPage.close();
  }

  const apiPassed =
    claimResult.claim_status === 503 &&
    claimResult.claim_body?.code === "telegram_destination_unavailable" &&
    typeof claimResult.claim_body?.ui?.safe_message === "string" &&
    claimResult.claim_body.ui.safe_message.includes("В этой тестовой версии продолжение в Telegram недоступно");

  // 2. Native Playwright UI Walkthrough: MeetingOfMirrors -> TelegramContinuation notice -> click "Продолжить в Telegram" -> native dialog modal
  let nativeNoticeText = "";
  let nativeModalRendered = false;
  const uiPage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  try {
    await uiPage.goto("http://127.0.0.1:3000", { waitUntil: "networkidle" });

    // Set saved snapshot with meetingResult
    await uiPage.evaluate(async ({ version }) => {
      await fetch("/api/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accepted: true, adult: true, version, scope: "core" }),
      });
      localStorage.setItem(
        "zerkalo.myMirror.v1",
        JSON.stringify({
          version: 1,
          savedAt: new Date().toISOString(),
          codeDate: "15.08.1988",
          userQuestion: "Как найти баланс между срочностью и своим фокусом?",
          codeResult: { day: 15, month: 8, year: 1988, soul: 6, expression: 4, path: 4, direction: 1, result: 2 },
          firstMirror: {
            title: "Первое зеркало",
            keyInsight: "Число Души 6: гармония и ответственность.",
            practicalStep: "Определить одну главную задачу дня.",
            interpretationVersion: "v2",
          },
          storyInputs: { q1: "Много задач", q2: "Камень", q3: "Утро", q4: "Ясность" },
          storyResult: { title: "Тихий берег", story: "Путник на берегу озера нашел тишину." },
          meetingResult: {
            summary: "Встреча подсвечивает важность ясных пауз и разделения ответственности.",
            confidenceNote: "Ориентир для проверки в реальной ситуации.",
            parallels: [
              {
                theme: "Фокус",
                codeAnchor: "Число Души 6",
                mythAnchor: "Тихий берег",
                synthesis: "Естественный ритм вместо гонки за чужими ожиданиями.",
              },
            ],
            divergences: [
              {
                theme: "Темп",
                codeAspect: "Замедление",
                mythAspect: "Движение вперёд",
                reflection: "Баланс между действием и паузой.",
              },
            ],
            reflectiveQuestion: "Где на этой неделе можно вернуть себе спокойный ритм?",
            albertInsight: "Начните с одного конкретного разговора, не расширяя список обязательств.",
          },
          meetingUserNote: "",
        })
      );
    }, { version: CONSENT_VERSION });

    await uiPage.reload({ waitUntil: "networkidle" });
    const restoreSavedBtn = await uiPage.waitForSelector('button:has-text("Продолжить с того места")', { timeout: 10000 });
    await restoreSavedBtn.click();

    // Verify native notice in MeetingOfMirrors
    const tgNotice = await uiPage.waitForSelector('[data-testid="telegram-local-candidate-notice"]', { timeout: 10000 });
    nativeNoticeText = await tgNotice.innerText();

    // Click "Продолжить в Telegram" button in UI
    const tgButton = await uiPage.waitForSelector('button:has-text("Продолжить в Telegram")', { timeout: 5000 });
    await tgButton.click();

    // Verify native Telegram modal
    const tgModal = await uiPage.waitForSelector(
      'section[role="dialog"][aria-labelledby="telegram-continuation-title"]',
      { timeout: 5000 }
    );
    const modalText = await tgModal.innerText();
    nativeModalRendered = modalText.includes("В этой тестовой версии продолжение в Telegram недоступно");

    await uiPage.screenshot({ path: path.join(LIVE_RUNS_DIR, "telegram-local-gate.png") });
    console.log("[v6] Native Telegram Continuation modal rendered and screenshot saved.");
  } finally {
    await uiPage.close();
  }

  const passed = apiPassed && nativeModalRendered;

  fs.writeFileSync(
    path.join(LIVE_RUNS_DIR, "telegram-local-gate.json"),
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        pair: { web_pin: WEB_PIN, web_sha: WEB_SHA, dcs_sha: DCS_SHA },
        route: "Telegram local gate (POST /api/handoff/create-claim + native UI component)",
        passed,
        claim_status: claimResult.claim_status,
        claim_body: claimResult.claim_body,
        native_notice_text: nativeNoticeText,
        native_modal_rendered: nativeModalRendered,
        screenshot: "live-runs/telegram-local-gate.png",
      },
      null,
      2
    ) + "\n"
  );

  console.log(`[v6] Route B: ${passed ? "PASSED (503 telegram_destination_unavailable + native UI modal)" : "FAILED"}`);
  return passed;
}

async function runRouteCCheck(browser: Browser): Promise<boolean> {
  console.log("[v6] Running Check 5: Route C (Data Deletion via Native UI Button & Server API)...");

  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  try {
    await page.goto("http://127.0.0.1:3000", { waitUntil: "networkidle" });

    // 1. Establish consent
    await page.evaluate(async (version) => {
      await fetch("/api/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accepted: true, adult: true, version, scope: "core" }),
      });
    }, CONSENT_VERSION);

    // 2. Part 1: Server Deletion via POST /api/delete-data
    const sessionToken = "v6-session-del-token-" + Date.now();
    const regResult = await page.evaluate(async (token) => {
      const res = await fetch("/api/privacy/register-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, anonymousId: "v6-anon-delete-test" }),
      });
      return { status: res.status, body: await res.json() };
    }, sessionToken);

    if (regResult.status !== 200) {
      console.error("[v6] Route C session registration failed:", regResult);
      return false;
    }

    const serverDeleteResult = await page.evaluate(async (token) => {
      const res = await fetch("/api/delete-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      return { status: res.status, body: await res.json() };
    }, sessionToken);

    const serverDeleteOk = serverDeleteResult.status === 200 && serverDeleteResult.body?.status === "ok";
    console.log(`[v6] Server /api/delete-data: status=${serverDeleteResult.status}, body=${JSON.stringify(serverDeleteResult.body)}`);

    // 3. Part 2: Client Local Deletion via Native UI Button
    const sampleSnapshot = {
      version: 1,
      savedAt: new Date().toISOString(),
      codeDate: "15.05.1990",
      userQuestion: "Как найти фокус?",
      codeResult: { soul: 6, path: 5, expression: 9, direction: 2, result: 3 },
      firstMirror: {
        interpretationVersion: "v2",
        title: "Первое зеркало",
        keyInsight: "Опора на ясный шаг",
        practicalStep: "Один шаг",
      },
      storyInputs: {
        userName: "Артем",
        q1: "Срочный проект",
        q2: "Камень",
        q3: "На работе спокойно сверяю сметы",
        q4: "Спокойствия",
      },
      storyResult: {
        title: "Мост",
        story: "Ты стоишь на мосту над тихой рекой.",
      },
      meetingResult: {
        summary: "В вашем ответе названа ситуация срочного проекта...",
        confidenceNote: "Частичный резонанс",
        parallels: [],
        divergences: [],
        albertInsight: "Различение двух способов действовать...",
        reflectiveQuestion: "Где сделать паузу?",
      },
    };

    await page.evaluate((snap) => {
      localStorage.setItem("zerkalo.myMirror.v1", JSON.stringify(snap));
    }, sampleSnapshot);

    // Reload page to display saved mirror card in UI
    await page.reload({ waitUntil: "networkidle" });

    // Locate the delete button on the card. Fail closed if not present: NO synthetic fallbacks!
    const deleteBtn = await page.waitForSelector('button[title="Удалить сохранённое зеркало из браузера"]', {
      timeout: 10000,
    });
    if (!deleteBtn) {
      throw new Error("[v6] FAIL-CLOSED: UI delete button 'Удалить сохранённое зеркало из браузера' not found!");
    }

    console.log("[v6] Clicking native UI delete button via Playwright...");
    await deleteBtn.click();
    await page.waitForTimeout(500);

    // Verify localStorage snapshot is null immediately after click
    const snapshotImmediatelyAfter = await page.evaluate(() => localStorage.getItem("zerkalo.myMirror.v1"));
    const cardInDomImmediatelyAfter = (await page.$('button:has-text("Продолжить с того места")')) !== null;

    // Reload page to verify persistence of deletion
    await page.reload({ waitUntil: "networkidle" });
    const snapshotAfterReload = await page.evaluate(() => localStorage.getItem("zerkalo.myMirror.v1"));
    const cardInDomAfterReload = (await page.$('button:has-text("Продолжить с того места")')) !== null;

    await page.screenshot({ path: path.join(LIVE_RUNS_DIR, "user-data-delete.png") });

    const uiDeleteOk =
      snapshotImmediatelyAfter === null &&
      cardInDomImmediatelyAfter === false &&
      snapshotAfterReload === null &&
      cardInDomAfterReload === false;

    const passed = serverDeleteOk && uiDeleteOk;

    fs.writeFileSync(
      path.join(LIVE_RUNS_DIR, "user-data-delete.json"),
      JSON.stringify(
        {
          generated_at: new Date().toISOString(),
          pair: { web_pin: WEB_PIN, web_sha: WEB_SHA, dcs_sha: DCS_SHA },
          route: "Client UI button delete ('zerkalo.myMirror.v1') + Server API POST /api/delete-data",
          passed,
          server_deletion: {
            endpoint: "POST /api/delete-data",
            status: serverDeleteResult.status,
            body: serverDeleteResult.body,
            passed: serverDeleteOk,
          },
          ui_local_deletion: {
            button_title: "Удалить сохранённое зеркало из браузера",
            button_clicked_natively: true,
            storage_null_after_click: snapshotImmediatelyAfter === null,
            card_removed_from_dom_after_click: !cardInDomImmediatelyAfter,
            storage_null_after_reload: snapshotAfterReload === null,
            card_not_restored_after_reload: !cardInDomAfterReload,
            passed: uiDeleteOk,
          },
          screenshot: "live-runs/user-data-delete.png",
        },
        null,
        2
      ) + "\n"
    );

    console.log(
      `[v6] Route C: ${
        passed
          ? "PASSED (Server 200 ok + Native UI button purged localStorage and DOM)"
          : "FAILED"
      }`
    );
    return passed;
  } finally {
    await page.close();
  }
}

async function main() {
  console.log("================================================================================");
  console.log("[v6] Target Evidence Suite — Fail-Closed Acceptance Runner");
  console.log(`[v6] Web HEAD: ${WEB_SHA.slice(0, 7)} (PIN: ${WEB_PIN.slice(0, 7)})`);
  console.log(`[v6] DCS PIN:  ${DCS_SHA.slice(0, 7)}`);
  console.log("================================================================================");

  // Pre-flight check live services
  await verifyLiveServicesOrThrow();

  const results: Record<string, boolean> = {};

  // Check 1: Defect 1 Matrix
  results.defect1 = runDefect1Check();

  // Playwright-driven live checks
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    results.defect2 = await runDefect2Check(browser);
    results.routeA = await runRouteACheck(browser);
    results.routeB = await runRouteBCheck(browser);
    results.routeC = await runRouteCCheck(browser);
  } finally {
    await browser.close();
  }

  // NOTE: myth-6x2-identical-inputs.json is deliberately untouched to preserve provenance!

  console.log("================================================================================");
  console.log("[v6] Summary of Targeted Evidence Checks:");
  console.log(`  1. Defect 1 Matrix (Source Origin):         ${results.defect1 ? "PASS" : "FAIL"}`);
  console.log(`  2. Defect 2 Matrix (Crisis Self-Quote):      ${results.defect2 ? "PASS" : "FAIL"}`);
  console.log(`  3. Route A (Code -> Albert before Myth):    ${results.routeA ? "PASS" : "FAIL"}`);
  console.log(`  4. Route B (Telegram Local Gate 503):       ${results.routeB ? "PASS" : "FAIL"}`);
  console.log(`  5. Route C (Data Deletion on Real Session): ${results.routeC ? "PASS" : "FAIL"}`);
  console.log("================================================================================");

  const allPassed = Object.values(results).every(Boolean);

  if (!allPassed) {
    console.error("[v6] FAIL-CLOSED: At least one targeted check failed. Exiting with code 1.");
    process.exit(1);
  }

  console.log("[v6] ALL TARGETED CHECKS PASSED SUCCESSFULLY (5/5).");
  process.exit(0);
}

main().catch((err) => {
  console.error("[v6] Unhandled fatal error:", err);
  process.exit(1);
});
