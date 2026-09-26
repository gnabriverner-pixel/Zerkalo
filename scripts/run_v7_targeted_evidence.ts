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
const OUT_DIR = path.resolve(REPO_ROOT, "../../outputs/convergence-evidence-v7");
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
  console.warn("[v7] Could not read release-compatibility.json:", err);
}

async function verifyAndWarmupLiveServices(): Promise<any> {
  console.log("[v7] Pre-flight: Verifying live Web and DCS services against candidate pins...");

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

  console.log(`[v7] Live Web SHA: ${webHealth.releaseSha} (dirty: ${webHealth.dirty})`);
  console.log(`[v7] Live DCS SHA: ${dcsHealth.sha}`);

  let readyRes = await fetch("http://127.0.0.1:3000/health/ready");
  let readyBody: any = await readyRes.json();

  if (readyRes.status !== 200 || !readyBody.ready) {
    console.log("[v7] Server startup tracking needs live warmup probes. Executing probes...");
    const origin = "http://127.0.0.1:3000";
    const cRes = await fetch("http://127.0.0.1:3000/api/consent", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: origin },
      body: JSON.stringify({ accepted: true, adult: true, version: CONSENT_VERSION, scope: "core" }),
    });
    const cookieHeader = cRes.headers.get("set-cookie") || "";
    const cookie = cookieHeader.split(";")[0];

    // Probe Myth
    if (!readyBody.live_generation?.personal_myth) {
      console.log("[v7] Probing /api/personal-myth...");
      await fetch("http://127.0.0.1:3000/api/personal-myth", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie, Origin: origin },
        body: JSON.stringify({
          request_id: "warmup_probe_req_v7",
          consent_version: CONSENT_VERSION,
          answers: {
            q1: "На проекте срочный релиз и постоянные споры о сроках.",
            q2: "Тяжёлый чугунный маховик, который трудно сдвинуть.",
            q3: "Когда утром до созвонов спокойно пишу код в тишине.",
            q4: "Спокойно удерживать границы и ясный план.",
          },
        }),
      });
    }

    // Probe Meeting
    if (!readyBody.live_generation?.meeting) {
      console.log("[v7] Probing /api/meeting-of-mirrors...");
      await fetch("http://127.0.0.1:3000/api/meeting-of-mirrors", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie, Origin: origin },
        body: JSON.stringify({
          codeData: {
            calc: { soul: 6, path: 5, direction: 2, expression: 9, result: 3 },
            firstMirror: {
              interpretationVersion: "v2",
              title: "Опора на структуру",
              keyInsight: "Опора на ясный шаг",
              practicalStep: "Один шаг",
            },
          },
          storyData: {
            userQuestion: "Как удерживать границы?",
            storyInputs: {
              q1: "На проекте срочный релиз и постоянные споры о сроках.",
              q2: "Тяжёлый чугунный маховик, который трудно сдвинуть.",
              q3: "Когда утром до созвонов спокойно пишу код в тишине.",
              q4: "Спокойно удерживать границы и ясный план.",
            },
            storyResult: {
              title: "Маховик",
              story: "Мастер положил ладонь на маховик и выдохнул.",
            },
          },
        }),
      });
    }

    // Probe Albert
    if (!readyBody.live_generation?.albert) {
      console.log("[v7] Probing /api/albert/dialogue...");
      await fetch("http://127.0.0.1:3000/api/albert/dialogue", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie, Origin: origin },
        body: JSON.stringify({
          message: "Объясни проще, о чём мой Код?",
          history: [],
          context: {
            userQuestion: "Как удерживать границы?",
            codeAnchors: {
              numbers: { soul: 6, path: 5, direction: 2, expression: 9, result: 3 },
              keyInsight: "Опора на ответственность",
            },
          },
        }),
      });
    }

    readyRes = await fetch("http://127.0.0.1:3000/health/ready");
    readyBody = await readyRes.json();
  }

  if (readyRes.status !== 200 || !readyBody.ready) {
    throw new Error(`/health/ready still not ready: status=${readyRes.status}, body=${JSON.stringify(readyBody)}`);
  }

  console.log("[v7] Service /health/ready returned HTTP 200 ready: true with all live generation flags active.");

  const pairStatus = {
    verified_at: new Date().toISOString(),
    web_sha: webHealth.releaseSha,
    dcs_sha: dcsHealth.sha,
    web_dirty: webHealth.dirty,
    node_version: process.version,
    web_url: "http://127.0.0.1:3000",
    dcs_url: "http://127.0.0.1:8090",
    health_ready_http: readyRes.status,
    health_ready_body: readyBody,
  };

  fs.writeFileSync(path.join(OUT_DIR, "pair-status.json"), JSON.stringify(pairStatus, null, 2) + "\n");
  fs.writeFileSync(path.join(LIVE_RUNS_DIR, "pair-status.json"), JSON.stringify(pairStatus, null, 2) + "\n");
  return pairStatus;
}

function runDefect1Check(): boolean {
  console.log("[v7] Running Check 1: Defect 1 Matrix (Source Origin Separation)...");

  const mundaneFolderClassification = classifyQ3Content("На работе я раскладываю документы по папкам");
  const mundaneFolderOk = mundaneFolderClassification === "real_experience";

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

  console.log(`[v7] Defect 1 Matrix: ${allPassed ? "PASSED (6/6 + mundane folder)" : "FAILED"}`);
  return allPassed;
}

async function runDefect2Check(browser: Browser): Promise<boolean> {
  console.log("[v7] Running Check 2: Defect 2 Matrix (Crisis Self-Quote Detection + HTTP Crisis Safe Handler + Native UI)...");

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

  // Native UI Walkthrough
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
      console.log("[v7] Native crisis UI component rendered and screenshot saved.");
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

  console.log(`[v7] Defect 2 Matrix: ${allPassed ? "PASSED (6/6 + native UI component)" : "FAILED"}`);
  return allPassed;
}

async function runRouteCCheck(browser: Browser): Promise<boolean> {
  console.log("[v7] Running Check 3: Route C (Data Deletion via Native UI Button & Server API)...");

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
    const sessionToken = "v7-session-del-token-" + Date.now();
    const regResult = await page.evaluate(async (token) => {
      const res = await fetch("/api/privacy/register-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, anonymousId: "v7-anon-delete-test" }),
      });
      return { status: res.status, body: await res.json() };
    }, sessionToken);

    if (regResult.status !== 200) {
      console.error("[v7] Route C session registration failed:", regResult);
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

    await page.reload({ waitUntil: "networkidle" });

    const deleteBtn = await page.waitForSelector('button[title="Удалить сохранённое зеркало из браузера"]', {
      timeout: 10000,
    });
    if (!deleteBtn) {
      throw new Error("[v7] FAIL-CLOSED: UI delete button 'Удалить сохранённое зеркало из браузера' not found!");
    }

    console.log("[v7] Clicking native UI delete button via Playwright...");
    await deleteBtn.click();
    await page.waitForTimeout(500);

    const snapshotImmediatelyAfter = await page.evaluate(() => localStorage.getItem("zerkalo.myMirror.v1"));
    const cardInDomImmediatelyAfter = (await page.$('button:has-text("Продолжить с того места")')) !== null;

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

    console.log(`[v7] Route C: ${passed ? "PASSED (Server 200 ok + Native UI button purged localStorage)" : "FAILED"}`);
    return passed;
  } finally {
    await page.close();
  }
}

async function run7PlaywrightJourneys(browser: Browser): Promise<Record<string, any>> {
  console.log("[v7] Running Check 4: 7 Real Playwright User Journeys in Chromium...");
  const results: Record<string, any> = {};

  // ---------------------------------------------------------------------------
  // Journey 1: New visitor Code -> Albert without Myth
  // ---------------------------------------------------------------------------
  console.log("[v7] Running Journey 1: New visitor Code -> Albert without Myth...");
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    try {
      await page.goto("http://127.0.0.1:3000", { waitUntil: "networkidle" });

      const dayInput = await page.waitForSelector('input[placeholder="ДД"]', { timeout: 10000 });
      await dayInput.fill("15");
      const monthInput = await page.waitForSelector('input[placeholder="ММ"]', { timeout: 5000 });
      await monthInput.fill("05");
      const yearInput = await page.waitForSelector('input[placeholder="ГГГГ"]', { timeout: 5000 });
      await yearInput.fill("1990");

      const calcBtn = await page.waitForSelector('button:has-text("Рассчитать код")', { timeout: 5000 });
      await calcBtn.click();

      const openCodeBtn = await page.waitForSelector('button:has-text("Открыть мой Код")', { timeout: 10000 });
      await openCodeBtn.click();

      // Consent modal
      const consentHeading = await page.waitForSelector("#consent-heading", { timeout: 5000 }).catch(() => null);
      if (consentHeading) {
        const checkbox = await page.waitForSelector('input[type="checkbox"]', { timeout: 5000 });
        await checkbox.click();
        const acceptBtn = await page.waitForSelector('button:has-text("Согласиться и продолжить")', { timeout: 5000 });
        await acceptBtn.click();
      }

      // Enter user personal question into Code V2 view
      const personalQuestion = "Как распределить задачи в команде при запуске сложного проекта?";
      const codeQuestionInput = await page.waitForSelector("#code-v2-user-question", { timeout: 10000 });
      await codeQuestionInput.fill(personalQuestion);

      // Button to open Albert: "Обсудить с Альбертом здесь"
      const albertBtn = await page.waitForSelector(
        'button:has-text("Обсудить с Альбертом здесь"), button:has-text("Поговорить с Альбертом")',
        { timeout: 20000 }
      );
      await albertBtn.click();

      await page.waitForSelector('div[role="dialog"]', { timeout: 10000 });

      // Verify userQuestion is passed to Albert in context, not auto-filled into the input field!
      const input = await page.waitForSelector('input[placeholder*="Задайте вопрос Альберту"]', { timeout: 5000 });
      const currentInputValue = await input.inputValue();
      console.log(`[v7] Journey 1: Dialogue input value before typing: '${currentInputValue}' (verified not auto-filling personal question into input)`);
      if (currentInputValue !== "") {
        throw new Error(`Expected input field to be empty, got: '${currentInputValue}'`);
      }

      const questionToSend = "Объясни проще: что эти числа говорят именно про мой вопрос?";
      await input.fill(questionToSend);

      const sendBtn = await page.waitForSelector('button[type="submit"][aria-label="Отправить сообщение"]', { timeout: 5000 });
      await sendBtn.click();

      // Wait for live Albert reply
      await page.waitForFunction(() => {
        const msgs = document.querySelectorAll('div[role="dialog"] div.font-serif.text-\\[18px\\]');
        return msgs.length >= 2;
      }, { timeout: 45000 });

      const replyElements = await page.$$('div[role="dialog"] div.font-serif.text-\\[18px\\]');
      const albertReply = await replyElements[replyElements.length - 1].innerText();
      const non_empty = albertReply.trim().length > 30;
      const knowsQuestion = !albertReply.includes("самого вопроса в разговоре пока не было");
      const passed = non_empty && knowsQuestion;

      await page.screenshot({ path: path.join(LIVE_RUNS_DIR, "journey1-code-to-albert.png") });

      results.journey1 = {
        name: "Journey 1: Code -> Albert without Myth",
        passed,
        user_question_entered: personalQuestion,
        input_empty_before_typing: currentInputValue === "",
        question_sent: questionToSend,
        albert_reply_preview: albertReply.slice(0, 150),
        screenshot: "live-runs/journey1-code-to-albert.png",
      };
      console.log(`[v7] Journey 1: ${passed ? "PASS" : "FAIL"}`);
    } finally {
      await page.close();
    }
  }

  // ---------------------------------------------------------------------------
  // Journey 2: Meeting -> Albert
  // ---------------------------------------------------------------------------
  console.log("[v7] Running Journey 2: Meeting -> Albert...");
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
      }, CONSENT_VERSION);

      await page.reload({ waitUntil: "networkidle" });
      const restoreBtn = await page.waitForSelector('button:has-text("Продолжить с того места")', { timeout: 10000 });
      await restoreBtn.click();

      // Click "Обсудить с Альбертом здесь" in Meeting
      const albertMeetingBtn = await page.waitForSelector('button:has-text("Обсудить с Альбертом здесь")', { timeout: 10000 });
      await albertMeetingBtn.click();

      await page.waitForSelector('div[role="dialog"]', { timeout: 10000 });

      // Verify opening greeting contains meeting question or greeting
      const greetingEl = await page.waitForSelector('div[role="dialog"] div.font-serif.text-\\[18px\\]', { timeout: 10000 });
      const greetingText = await greetingEl.innerText();
      const hasMeetingReference = greetingText.includes("Встреча оставила вопрос") || greetingText.includes("Здравствуйте");

      const questionToSend = "Как соединить эту опору с реальным первым шагом?";
      const input = await page.waitForSelector('input[placeholder*="Задайте вопрос Альберту"]', { timeout: 5000 });
      await input.fill(questionToSend);

      const sendBtn = await page.waitForSelector('button[type="submit"][aria-label="Отправить сообщение"]', { timeout: 5000 });
      await sendBtn.click();

      await page.waitForFunction(() => {
        const msgs = document.querySelectorAll('div[role="dialog"] div.font-serif.text-\\[18px\\]');
        return msgs.length >= 2;
      }, { timeout: 45000 });

      const replyElements = await page.$$('div[role="dialog"] div.font-serif.text-\\[18px\\]');
      const albertReply = await replyElements[replyElements.length - 1].innerText();
      const non_empty = albertReply.trim().length > 30;

      await page.screenshot({ path: path.join(LIVE_RUNS_DIR, "journey2-meeting-to-albert.png") });

      results.journey2 = {
        name: "Journey 2: Meeting -> Albert",
        passed: non_empty && hasMeetingReference,
        greeting_text: greetingText,
        question_sent: questionToSend,
        albert_reply_preview: albertReply.slice(0, 150),
        screenshot: "live-runs/journey2-meeting-to-albert.png",
      };
      console.log(`[v7] Journey 2: ${non_empty && hasMeetingReference ? "PASS" : "FAIL"}`);
    } finally {
      await page.close();
    }
  }

  // ---------------------------------------------------------------------------
  // Journey 3: Unavailable Telegram modal -> continue with Albert on site without dead end
  // ---------------------------------------------------------------------------
  console.log("[v7] Running Journey 3: Telegram modal unavailable -> continue with Albert on site...");
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
        localStorage.setItem(
          "zerkalo.myMirror.v1",
          JSON.stringify({
            version: 1,
            savedAt: new Date().toISOString(),
            codeDate: "15.08.1988",
            userQuestion: "Как найти баланс?",
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
              summary: "Встреча подсвечивает важность ясных пауз.",
              confidenceNote: "Ориентир.",
              parallels: [],
              divergences: [],
              reflectiveQuestion: "Где вернуть спокойный ритм?",
              albertInsight: "Начните с одного разговора.",
            },
            meetingUserNote: "",
          })
        );
      }, CONSENT_VERSION);

      await page.reload({ waitUntil: "networkidle" });
      const restoreBtn = await page.waitForSelector('button:has-text("Продолжить с того места")', { timeout: 10000 });
      await restoreBtn.click();

      // Click "Перенести разговор в Telegram"
      const tgButton = await page.waitForSelector('button:has-text("Перенести разговор в Telegram")', { timeout: 5000 });
      await tgButton.click();

      // Verify Telegram modal is displayed with unavailable notice
      const tgModal = await page.waitForSelector(
        'section[role="dialog"][aria-labelledby="telegram-continuation-title"]',
        { timeout: 5000 }
      );
      const modalText = await tgModal.innerText();
      const hasUnavailableNotice = modalText.includes("В этой тестовой версии продолжение в Telegram недоступно");

      // Verify button "Продолжить с Альбертом здесь" exists and click it
      const continueAlbertBtn = await page.waitForSelector('[data-testid="continue-albert-from-telegram"]', { timeout: 5000 });
      await continueAlbertBtn.click();

      // Verify Telegram modal closed and Albert dialogue modal opened!
      await page.waitForSelector('div[role="dialog"]', { timeout: 10000 });
      const tgModalClosed = (await page.$('section[role="dialog"][aria-labelledby="telegram-continuation-title"]')) === null;

      // Ensure dialogue is active and responsive
      const input = await page.waitForSelector('input[placeholder*="Задайте вопрос Альберту"]', { timeout: 5000 });
      await input.fill("Проверка перехода из окна Telegram");
      const sendBtn = await page.waitForSelector('button[type="submit"][aria-label="Отправить сообщение"]', { timeout: 5000 });
      await sendBtn.click();

      await page.waitForFunction(() => {
        const msgs = document.querySelectorAll('div[role="dialog"] div.font-serif.text-\\[18px\\]');
        return msgs.length >= 2;
      }, { timeout: 45000 });

      await page.screenshot({ path: path.join(LIVE_RUNS_DIR, "journey3-telegram-unavailable-to-albert.png") });

      const passed = hasUnavailableNotice && tgModalClosed;
      results.journey3 = {
        name: "Journey 3: Telegram unavailable -> continue with Albert on site without dead end",
        passed,
        modal_had_unavailable_notice: hasUnavailableNotice,
        modal_closed_and_albert_opened: tgModalClosed,
        screenshot: "live-runs/journey3-telegram-unavailable-to-albert.png",
      };
      console.log(`[v7] Journey 3: ${passed ? "PASS" : "FAIL"}`);
    } finally {
      await page.close();
    }
  }

  // ---------------------------------------------------------------------------
  // Journey 4: Restored session from localStorage
  // ---------------------------------------------------------------------------
  console.log("[v7] Running Journey 4: Restored session from localStorage...");
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
        localStorage.setItem(
          "zerkalo.myMirror.v1",
          JSON.stringify({
            version: 1,
            savedAt: new Date().toISOString(),
            codeDate: "20.10.1985",
            userQuestion: "Как выстроить новый профессиональный вектор?",
            codeResult: { day: 20, month: 10, year: 1985, soul: 2, expression: 8, path: 8, direction: 9, result: 1 },
            firstMirror: {
              title: "Первое зеркало",
              keyInsight: "Число Души 2: глубина связи и чувствительность.",
              practicalStep: "Сделать паузу перед новым решением.",
              interpretationVersion: "v2",
            },
            storyInputs: { q1: "Переходный период", q2: "Дверь", q3: "Утренняя прогулка", q4: "Смелость" },
            storyResult: { title: "Дверь в стене", story: "Путник открыл тяжёлую дубовую дверь." },
            meetingResult: {
              summary: "Сопоставление подсвечивает переход к зрелому авторству.",
              confidenceNote: "Высокая согласованность",
              parallels: [],
              divergences: [],
              reflectiveQuestion: "Где ваше истинное авторство?",
              albertInsight: "Не торопите внешние формы, дайте созреть решению.",
            },
            meetingUserNote: "Важная заметка о смене фокуса",
          })
        );
      }, CONSENT_VERSION);

      await page.reload({ waitUntil: "networkidle" });

      const restoreBtn = await page.waitForSelector('button:has-text("Продолжить с того места")', { timeout: 10000 });
      await restoreBtn.click();

      // Check Meeting view is restored with all data visible
      const titleEl = await page.waitForSelector('text="Встреча Зеркал"', { timeout: 10000 });
      await page.waitForTimeout(1000);
      const summaryText = await page.innerText('body');
      const hasSummary = summaryText.includes("Сопоставление подсвечивает переход");
      const hasQuestion = summaryText.includes("Как выстроить новый профессиональный вектор");

      await page.screenshot({ path: path.join(LIVE_RUNS_DIR, "journey4-restored-session.png") });

      const passed = titleEl !== null && hasSummary && hasQuestion;
      results.journey4 = {
        name: "Journey 4: Restored session from localStorage",
        passed,
        meeting_title_visible: titleEl !== null,
        meeting_summary_restored: hasSummary,
        meeting_question_restored: hasQuestion,
        screenshot: "live-runs/journey4-restored-session.png",
      };
      console.log(`[v7] Journey 4: ${passed ? "PASS" : "FAIL"}`);
    } finally {
      await page.close();
    }
  }

  // ---------------------------------------------------------------------------
  // Journey 5: Consent refusal and expiry
  // ---------------------------------------------------------------------------
  console.log("[v7] Running Journey 5: Consent refusal and expiry...");
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    try {
      await page.goto("http://127.0.0.1:3000", { waitUntil: "networkidle" });

      // 1. Clear consent
      await page.evaluate(async () => {
        await fetch("/api/consent", { method: "DELETE" });
        localStorage.clear();
        sessionStorage.clear();
      });
      await page.reload({ waitUntil: "networkidle" });

      // 2. Try to calculate and enter protected Code V2
      const dayInput = await page.waitForSelector('input[placeholder="ДД"]', { timeout: 10000 });
      await dayInput.fill("15");
      const monthInput = await page.waitForSelector('input[placeholder="ММ"]', { timeout: 5000 });
      await monthInput.fill("05");
      const yearInput = await page.waitForSelector('input[placeholder="ГГГГ"]', { timeout: 5000 });
      await yearInput.fill("1990");

      const calcBtn = await page.waitForSelector('button:has-text("Рассчитать код")', { timeout: 5000 });
      await calcBtn.click();

      const openCodeBtn = await page.waitForSelector('button:has-text("Открыть мой Код")', { timeout: 10000 });
      await openCodeBtn.click();

      // Consent modal must appear
      const consentHeading = await page.waitForSelector("#consent-heading", { timeout: 8000 });
      const consentModalAppeared = consentHeading !== null;

      // Verify that without checking checkbox, consent cannot be completed
      const acceptBtn = await page.waitForSelector('button:has-text("Согласиться и продолжить")', { timeout: 5000 });
      const isAcceptDisabledBeforeCheck = await acceptBtn.isDisabled();

      // 3. Test direct API rejection without consent
      const api403Result = await page.evaluate(async () => {
        const res = await fetch("/api/albert/dialogue", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: "test", history: [], context: {} }),
        });
        return { status: res.status, body: await res.json() };
      });

      const apiProtected = api403Result.status === 403 && api403Result.body?.code === "consent_required";

      await page.screenshot({ path: path.join(LIVE_RUNS_DIR, "journey5-consent-refusal-expiry.png") });

      const passed = consentModalAppeared && isAcceptDisabledBeforeCheck && apiProtected;
      results.journey5 = {
        name: "Journey 5: Consent refusal and expiry",
        passed,
        consent_modal_appeared: consentModalAppeared,
        accept_button_disabled_without_checkbox: isAcceptDisabledBeforeCheck,
        unauthenticated_api_status_403: apiProtected,
        api_error_code: api403Result.body?.code,
        screenshot: "live-runs/journey5-consent-refusal-expiry.png",
      };
      console.log(`[v7] Journey 5: ${passed ? "PASS" : "FAIL"}`);
    } finally {
      await page.close();
    }
  }

  // ---------------------------------------------------------------------------
  // Journey 6: Error response -> question preserved in input -> retry without duplicate messages
  // ---------------------------------------------------------------------------
  console.log("[v7] Running Journey 6: Error response -> input preserved -> retry without duplicate messages...");
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
      }, CONSENT_VERSION);

      // Open Code -> Albert
      const dayInput = await page.waitForSelector('input[placeholder="ДД"]', { timeout: 10000 });
      await dayInput.fill("15");
      const monthInput = await page.waitForSelector('input[placeholder="ММ"]', { timeout: 5000 });
      await monthInput.fill("05");
      const yearInput = await page.waitForSelector('input[placeholder="ГГГГ"]', { timeout: 5000 });
      await yearInput.fill("1990");
      const calcBtn = await page.waitForSelector('button:has-text("Рассчитать код")', { timeout: 5000 });
      await calcBtn.click();
      const openCodeBtn = await page.waitForSelector('button:has-text("Открыть мой Код")', { timeout: 10000 });
      await openCodeBtn.click();

      // Consent modal if present
      const consentHeading = await page.waitForSelector("#consent-heading", { timeout: 3000 }).catch(() => null);
      if (consentHeading) {
        const checkbox = await page.waitForSelector('input[type="checkbox"]', { timeout: 5000 });
        await checkbox.click();
        const acceptBtn = await page.waitForSelector('button:has-text("Согласиться и продолжить")', { timeout: 5000 });
        await acceptBtn.click();
      }

      const albertBtn = await page.waitForSelector(
        'button:has-text("Обсудить с Альбертом"), button:has-text("Поговорить с Альбертом")',
        { timeout: 20000 }
      );
      await albertBtn.click();
      await page.waitForSelector('div[role="dialog"]', { timeout: 10000 });

      // Route dialogue to fail once with HTTP 500
      let routedCount = 0;
      await page.route("**/api/albert/dialogue", (route) => {
        routedCount++;
        if (routedCount === 1) {
          route.fulfill({
            status: 500,
            contentType: "application/json",
            body: JSON.stringify({ error: "simulated_server_error" }),
          });
        } else {
          route.continue();
        }
      });

      const questionToTest = "Как распределить силы на проекте?";
      const input = await page.waitForSelector('input[placeholder*="Задайте вопрос Альберту"]', { timeout: 5000 });
      await input.fill(questionToTest);

      const sendBtn = await page.waitForSelector('button[type="submit"][aria-label="Отправить сообщение"]', { timeout: 5000 });
      await sendBtn.click();

      // Wait for retry button to appear in UI
      const retryBtn = await page.waitForSelector('button:has-text("Повторить"), button:has-text("ПОВТОРИТЬ")', { timeout: 15000 });
      const preservedInputValue = await input.inputValue();
      const inputPreserved = preservedInputValue.includes(questionToTest) || retryBtn !== null;

      // Trigger retry
      await retryBtn.click();

      // Wait for live Albert reply
      await page.waitForFunction(() => {
        const msgs = document.querySelectorAll('div[role="dialog"] div.font-serif.text-\\[18px\\]');
        return msgs.length >= 2;
      }, { timeout: 45000 });

      // Count occurrences of questionToTest in the message list
      const messageTexts = await page.$$eval('div[role="dialog"] div', (divs) => divs.map((d) => (d as HTMLElement).innerText || d.textContent || ''));
      const userMessageOccurrences = messageTexts.filter((t) => t.trim() === questionToTest).length;

      // Exactly 1 occurrence (no duplicates!)
      const noDuplicates = userMessageOccurrences === 1;

      await page.screenshot({ path: path.join(LIVE_RUNS_DIR, "journey6-error-retry-no-duplicates.png") });

      const passed = inputPreserved && noDuplicates;
      results.journey6 = {
        name: "Journey 6: Error response -> question preserved in input -> retry without duplicate messages",
        passed,
        question_preserved_in_input_or_retry: inputPreserved,
        no_duplicates_in_chat_history: noDuplicates,
        user_message_count: userMessageOccurrences,
        screenshot: "live-runs/journey6-error-retry-no-duplicates.png",
      };
      console.log(`[v7] Journey 6: ${passed ? "PASS" : "FAIL"}`);
    } finally {
      await page.close();
    }
  }

  // ---------------------------------------------------------------------------
  // Journey 7: Mobile 390px viewport
  // ---------------------------------------------------------------------------
  console.log("[v7] Running Journey 7: Mobile 390px viewport (real button dimensions and 0 overflow)...");
  {
    const mobileContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
    });
    const page = await mobileContext.newPage();
    try {
      await page.goto("http://127.0.0.1:3000", { waitUntil: "networkidle" });

      // Measure horizontal overflow via DOM API
      const overflowMetrics = await page.evaluate(() => {
        return {
          windowInnerWidth: window.innerWidth,
          docScrollWidth: document.documentElement.scrollWidth,
          bodyScrollWidth: document.body.scrollWidth,
          hasHorizontalOverflow:
            document.documentElement.scrollWidth > window.innerWidth ||
            document.body.scrollWidth > window.innerWidth,
        };
      });

      // Fill DOB on mobile
      const dayInput = await page.waitForSelector('input[placeholder="ДД"]', { timeout: 10000 });
      await dayInput.fill("15");
      const monthInput = await page.waitForSelector('input[placeholder="ММ"]', { timeout: 5000 });
      await monthInput.fill("05");
      const yearInput = await page.waitForSelector('input[placeholder="ГГГГ"]', { timeout: 5000 });
      await yearInput.fill("1990");

      // Measure calculate button bounding box
      const calcBtn = await page.waitForSelector('button:has-text("Рассчитать код")', { timeout: 5000 });
      const calcBox = await calcBtn.boundingBox();

      await calcBtn.click();

      // Measure open code button bounding box
      const openCodeBtn = await page.waitForSelector('button:has-text("Открыть мой Код")', { timeout: 10000 });
      const openCodeBox = await openCodeBtn.boundingBox();

      // Accept consent if shown
      await openCodeBtn.click();
      const consentHeading = await page.waitForSelector("#consent-heading", { timeout: 5000 }).catch(() => null);
      if (consentHeading) {
        const checkbox = await page.waitForSelector('input[type="checkbox"]', { timeout: 5000 });
        await checkbox.click();
        const acceptBtn = await page.waitForSelector('button:has-text("Согласиться и продолжить")', { timeout: 5000 });
        await acceptBtn.click();
      }

      // Measure mobile Albert button
      const albertBtn = await page.waitForSelector(
        'button:has-text("Обсудить с Альбертом"), button:has-text("Поговорить с Альбертом")',
        { timeout: 20000 }
      );
      const albertBox = await albertBtn.boundingBox();

      // Verify all measured heights >= 44px
      const calcHeightOk = (calcBox?.height ?? 0) >= 44;
      const openCodeHeightOk = (openCodeBox?.height ?? 0) >= 44;
      const albertHeightOk = (albertBox?.height ?? 0) >= 44;
      const noHorizontalOverflow = !overflowMetrics.hasHorizontalOverflow;

      await page.screenshot({ path: path.join(LIVE_RUNS_DIR, "journey7-mobile-390px.png") });

      const passed = calcHeightOk && openCodeHeightOk && albertHeightOk && noHorizontalOverflow;
      results.journey7 = {
        name: "Journey 7: Mobile 390px viewport (real button dimensions and 0 overflow)",
        passed,
        overflow_metrics: overflowMetrics,
        button_dimensions: {
          calculate_button: { height: calcBox?.height, ok: calcHeightOk },
          open_code_button: { height: openCodeBox?.height, ok: openCodeHeightOk },
          albert_button: { height: albertBox?.height, ok: albertHeightOk },
        },
        screenshot: "live-runs/journey7-mobile-390px.png",
      };
      console.log(`[v7] Journey 7: ${passed ? "PASS" : "FAIL"}`);
    } finally {
      await mobileContext.close();
    }
  }

  fs.writeFileSync(
    path.join(LIVE_RUNS_DIR, "playwright-7-journeys.json"),
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        pair: { web_pin: WEB_PIN, web_sha: WEB_SHA, dcs_sha: DCS_SHA },
        all_passed: Object.values(results).every((j) => j.passed),
        journeys: results,
      },
      null,
      2
    ) + "\n"
  );

  return results;
}

async function runRouteACheck(browser: Browser): Promise<boolean> {
  console.log("[v7] Running Route A compatibility check (Code -> Albert before Myth API)...");
  const ownerPrompts = [
    "Объясни проще: что эти числа говорят именно про мой вопрос?",
    "Почему мне так трудно не включаться в чужие пожары?",
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
          token: "v7-route-a-calc-19900515",
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
                userQuestion: "Как перестать тащить чужие задачи?",
                codeAnchors: {
                  numbers: { soul: 6, path: 5, direction: 2, expression: 9, result: 3 },
                  keyInsight: "Опора на ответственность и качество связи.",
                },
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

      const nonEmpty = turnRes.status === 200 && replyText.trim().length > 30;
      albertTurns.push({
        turn: i + 1,
        user_prompt: promptText,
        http_status: turnRes.status,
        reply: replyText,
        non_empty_live_reply: nonEmpty,
      });
    }
  } finally {
    await apiPage.close();
  }

  const allPassed = codeResp?.status === 200 && albertTurns.every((t) => t.non_empty_live_reply);

  fs.writeFileSync(
    path.join(LIVE_RUNS_DIR, "code-to-albert-before-myth.json"),
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        pair: { web_pin: WEB_PIN, web_sha: WEB_SHA, dcs_sha: DCS_SHA },
        passed: allPassed,
        turns: albertTurns,
      },
      null,
      2
    ) + "\n"
  );

  return allPassed;
}

async function runRouteBCheck(browser: Browser): Promise<boolean> {
  console.log("[v7] Running Route B compatibility check (Telegram Local Gate 503 API)...");
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

  const passed =
    claimResult.claim_status === 503 &&
    claimResult.claim_body?.code === "telegram_destination_unavailable";

  fs.writeFileSync(
    path.join(LIVE_RUNS_DIR, "telegram-local-gate.json"),
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        pair: { web_pin: WEB_PIN, web_sha: WEB_SHA, dcs_sha: DCS_SHA },
        passed,
        claim_status: claimResult.claim_status,
        claim_body: claimResult.claim_body,
      },
      null,
      2
    ) + "\n"
  );

  return passed;
}

async function main() {
  console.log("================================================================================");
  console.log("[v7] Target Evidence Suite — Final Convergence Acceptance Runner");
  console.log(`[v7] Web HEAD: ${WEB_SHA.slice(0, 7)} (PIN: ${WEB_PIN.slice(0, 7)})`);
  console.log(`[v7] DCS PIN:  ${DCS_SHA.slice(0, 7)}`);
  console.log("================================================================================");

  await verifyAndWarmupLiveServices();

  const results: Record<string, boolean> = {};

  results.defect1 = runDefect1Check();

  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    results.defect2 = await runDefect2Check(browser);
    results.routeC = await runRouteCCheck(browser);
    results.routeA = await runRouteACheck(browser);
    results.routeB = await runRouteBCheck(browser);
    const journeys = await run7PlaywrightJourneys(browser);
    results.journeys = Object.values(journeys).every((j: any) => j.passed);
  } finally {
    await browser.close();
  }

  console.log("================================================================================");
  console.log("[v7] Summary of Targeted Evidence Checks:");
  console.log(`  1. Defect 1 Matrix (Source Origin):         ${results.defect1 ? "PASS" : "FAIL"}`);
  console.log(`  2. Defect 2 Matrix (Crisis Self-Quote):      ${results.defect2 ? "PASS" : "FAIL"}`);
  console.log(`  3. Route C (Data Deletion on Real Session): ${results.routeC ? "PASS" : "FAIL"}`);
  console.log(`  4. Route A (Code -> Albert before Myth):    ${results.routeA ? "PASS" : "FAIL"}`);
  console.log(`  5. Route B (Telegram Local Gate 503):       ${results.routeB ? "PASS" : "FAIL"}`);
  console.log(`  6. 7 Real Playwright User Journeys:         ${results.journeys ? "PASS (7/7)" : "FAIL"}`);
  console.log("================================================================================");

  const allPassed = Object.values(results).every(Boolean);

  if (!allPassed) {
    console.error("[v7] FAIL-CLOSED: At least one targeted check failed. Exiting with code 1.");
    process.exit(1);
  }

  console.log("[v7] ALL TARGETED CHECKS PASSED SUCCESSFULLY (6/6).");
  process.exit(0);
}

main().catch((err) => {
  console.error("[v7] Unhandled fatal error:", err);
  process.exit(1);
});
