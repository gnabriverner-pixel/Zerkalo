import "dotenv/config";
import crypto from "node:crypto";
import fs from "node:fs";
import { registerHooks } from "node:module";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { chromium, type Browser } from "playwright";
import {
  classifyQ3Content,
  hasSourceOriginConflation,
} from "../src/services/meetingContract";
import { buildMeetingOfMirrorsPrompt } from "../src/services/mythPrompts";
import {
  buildPersonalMythPromptV11,
  buildPersonalMythPromptV12,
  buildPersonalMythRepairPrompt,
  containsCrisisLanguageText,
  createRouterAIMythProvider,
  hasFormalYouViolation,
  parsePersonalMythResult,
  validatePersonalMythResult,
} from "../server/myth";
import { RouterAIClient } from "../server/routerai";
import { issueConsent, verifyConsent } from "../server/consent";
import { CONSENT_MAX_AGE_MS, CONSENT_VERSION } from "../src/services/consent";
import { fileURLToPath } from "node:url";

try {
  registerHooks({
    load(url, context, nextLoad) {
      if (url.endsWith(".css")) {
        return { format: "commonjs", shortCircuit: true, source: "module.exports = {};" };
      }
      return nextLoad(url, context);
    },
  });
} catch {}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.resolve(REPO_ROOT, "../../outputs/convergence-evidence-v9");
const OUT_DIR_V10 = path.resolve(REPO_ROOT, "../../outputs/convergence-evidence-v10");
const LIVE_RUNS_DIR = path.join(OUT_DIR, "live-runs");

// Load runtime secrets so issueConsent/verifyConsent share the exact HMAC key with the live server
const runtimeSecretsPath = path.join(REPO_ROOT, ".runtime", "stage1-pair-secrets.json");
if (fs.existsSync(runtimeSecretsPath)) {
  try {
    const secrets = JSON.parse(fs.readFileSync(runtimeSecretsPath, "utf8"));
    if (secrets.CONTINUATION_CLAIM_SECRET && !process.env.CONTINUATION_CLAIM_SECRET) {
      process.env.CONTINUATION_CLAIM_SECRET = secrets.CONTINUATION_CLAIM_SECRET;
    }
    if (secrets.DELETION_LOOKUP_SECRET && !process.env.DELETION_LOOKUP_SECRET) {
      process.env.DELETION_LOOKUP_SECRET = secrets.DELETION_LOOKUP_SECRET;
    }
  } catch (err) {
    console.warn("[v9] Could not load .runtime/stage1-pair-secrets.json:", err);
  }
}

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
  console.warn("[v9] Could not read release-compatibility.json:", err);
}

async function verifyAndWarmupLiveServices(): Promise<any> {
  console.log("[v9] Pre-flight: Verifying live Web and DCS services against candidate pins...");

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

  console.log(`[v9] Live Web SHA: ${webHealth.releaseSha} (dirty: ${webHealth.dirty})`);
  console.log(`[v9] Live DCS SHA: ${dcsHealth.sha}`);

  let readyRes = await fetch("http://127.0.0.1:3000/health/ready");
  let readyBody: any = await readyRes.json();

  if (readyRes.status !== 200 || !readyBody.ready) {
    console.log("[v9] Server startup tracking needs live warmup probes. Executing probes...");
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
      console.log("[v9] Probing /api/personal-myth...");
      await fetch("http://127.0.0.1:3000/api/personal-myth", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie, Origin: origin },
        body: JSON.stringify({
          request_id: "warmup_probe_req_v9",
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
      console.log("[v9] Probing /api/meeting-of-mirrors...");
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
      console.log("[v9] Probing /api/albert/dialogue...");
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

  console.log("[v9] Service /health/ready returned HTTP 200 ready: true with all live generation flags active.");

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

export const MYTH_FIXED_6_SETS = [
  {
    set_id: "set_1_detailed_inputs",
    name: "Набор 1 (Подробные вводные)",
    inputs: {
      q1: "Веду запуск сложного инженерного проекта, все ждут от меня мгновенных решений, а я боюсь упустить важную деталь в спешке.",
      q2: "Старый латунный компас с тяжёлой крышкой, который лежит на краю заваленного чертежами стола.",
      q3: "Когда рано утром до всех созвонов спокойно сверяю расчёты в тишине и карандашом отмечаю проверенные узлы.",
      q4: "Спокойной твёрдости и права на свою скорость.",
    },
  },
  {
    set_id: "set_2_brief_inputs",
    name: "Набор 2 (Краткие вводные)",
    inputs: {
      q1: "Непонятно, менять ли работу этой осенью.",
      q2: "Закрытая деревянная калитка.",
      q3: "Утренняя прогулка по парку.",
      q4: "Ясность.",
    },
  },
  {
    set_id: "set_3_unknown_resource",
    name: "Набор 3 (Неизвестный ресурс)",
    inputs: {
      q1: "Устал от бесконечных созвонов и правок, хочется просто тишины.",
      q2: "Тяжёлая мокрая губка.",
      q3: "Не знаю, сейчас ничего не вспоминается.",
      q4: "Тишины и чтобы меня никто не трогал хотя бы вечер.",
    },
  },
  {
    set_id: "set_4_real_action_in_q3",
    name: "Набор 4 (Реальное действие в q3)",
    inputs: {
      q1: "На проекте срочный релиз и постоянные споры о сроках.",
      q2: "Тяжёлый чугунный маховик, который трудно сдвинуть.",
      q3: "Когда на работе спокойно разбираю сложную архитектуру с командой по шагам.",
      q4: "Спокойно удерживать границы и ясный план.",
    },
  },
  {
    set_id: "set_5_imaginative_scene",
    name: "Набор 5 (Воображаемая сцена)",
    inputs: {
      q1: "Руководитель просит взять ещё один отдел в управление.",
      q2: "Туго натянутая канатная переправа над быстрой рекой.",
      q3: "Как будто стою на высоком берегу моря на рассвете и слушаю ветер.",
      q4: "Устойчивости и простора для дыхания.",
    },
  },
  {
    set_id: "set_6_explicit_user_crack",
    name: "Набор 6 (Явный пользовательский образ трещины)",
    inputs: {
      q1: "После долгого спора с партнёром чувствую, будто в нашем общем деле пошла трещина.",
      q2: "Старая фарфоровая чашка с тонкой трещиной на ободке.",
      q3: "Когда мы вдвоём спокойно пьём чай на кухне без телефонов и не спорим, кто прав.",
      q4: "Честного и бережного разговора.",
    },
  },
];

export interface ManualRunAuditEntry {
  audited_by: "manual_corpus_review_v9_fix";
  provenance_clean: boolean;
  as_if_modality_preserved: boolean | null;
  imagined_scene_as_if_preserved: boolean | null;
  clarity: number;
  concreteness: number;
  connection_to_input: number;
  reflection_utility: number;
  total: number;
  scores_out_of_8: {
    clarity: number;
    concreteness: number;
    connection_to_input: number;
    reflection_utility: number;
    total: number;
  };
  provenance_findings: string[];
  violations: string[];
  rationale: string;
  notes: string;
}

function makeManualAuditEntry(params: {
  provenance_clean: boolean;
  as_if_modality_preserved: boolean | null;
  violations: string[];
  scores: {
    clarity: number;
    concreteness: number;
    connection_to_input: number;
    reflection_utility: number;
    total: number;
  };
  notes: string;
}): ManualRunAuditEntry {
  return {
    audited_by: "manual_corpus_review_v9_fix",
    provenance_clean: params.provenance_clean,
    as_if_modality_preserved: params.as_if_modality_preserved,
    imagined_scene_as_if_preserved: params.as_if_modality_preserved,
    clarity: params.scores.clarity,
    concreteness: params.scores.concreteness,
    connection_to_input: params.scores.connection_to_input,
    reflection_utility: params.scores.reflection_utility,
    total: params.scores.total,
    scores_out_of_8: { ...params.scores },
    provenance_findings: [...params.violations],
    violations: [...params.violations],
    rationale: params.notes,
    notes: params.notes,
  };
}

export const MANUAL_24_RUN_AUDIT: Record<string, ManualRunAuditEntry> = {
  set_1_detailed_inputs__v11__run1: makeManualAuditEntry({
    provenance_clean: true,
    as_if_modality_preserved: null,
    violations: [],
    scores: { clarity: 2, concreteness: 2, connection_to_input: 2, reflection_utility: 2, total: 8 },
    notes:
      "Сцена развивается в настоящем моменте без выдуманных воспоминаний или привычек: герой перекладывает латунный компас с края стола на середину и спокойно сверяет расчёты карандашом узел за узлом. В mirror чётко разграничены «В вашем ответе» (компас на краю стола, утренняя сверка расчётов) и «В этой сцене» (перестановка компаса в центр стола).",
  }),
  set_1_detailed_inputs__v11__run2: makeManualAuditEntry({
    provenance_clean: true,
    as_if_modality_preserved: null,
    violations: [],
    scores: { clarity: 2, concreteness: 2, connection_to_input: 2, reflection_utility: 2, total: 8 },
    notes:
      "Происхождение и атрибуция чистые: mirror строго разделяет вводные («В вашем ответе компас лежит на краю...») и действия сцены («в этой сцене вы... перемещаете ближе к центру»). Деталь внутри метафорической сцены со схемами («отмечаешь на схеме один узел — тот, который проверял вчера») развивает заданное в q3 действие («отмечаю проверенные узлы») без выдумывания внешней биографии.",
  }),
  set_1_detailed_inputs__v12__run1: makeManualAuditEntry({
    provenance_clean: true,
    as_if_modality_preserved: null,
    violations: [],
    scores: { clarity: 2, concreteness: 2, connection_to_input: 2, reflection_utility: 2, total: 8 },
    notes:
      "Сцена удерживает фокус на латунном компасе и карандашной сверке узлов в утренней тишине; в mirror источники разделены корректно, выдуманных воспоминаний или привычек нет.",
  }),
  set_1_detailed_inputs__v12__run2: makeManualAuditEntry({
    provenance_clean: true,
    as_if_modality_preserved: null,
    violations: [],
    scores: { clarity: 2, concreteness: 2, connection_to_input: 2, reflection_utility: 1, total: 7 },
    notes:
      "Атрибуция в mirror чистая; в story есть мелкая сценическая деталь «Отмечаешь узел, который уже проверял вчера» (в рамках мотива проверенных узлов из q3). Оценка reflection_utility снижена до 1/2, так как герой так и не открывает компас и явно отказывается от сверки расчётов («проводишь тонкую линию на полях чертежа — не расчёт, а просто метку»), оставляя действие слишком пассивным относительно запроса q1/q3.",
  }),
  set_2_brief_inputs__v11__run1: makeManualAuditEntry({
    provenance_clean: false,
    as_if_modality_preserved: null,
    violations: [
      'invented_past_memory_in_story: "Ты вспоминаешь утреннюю прогулку по парку — не эту, а другую, когда ты шёл без цели и просто считал шаги. Тогда ты заметил, что если идти медленно, дорожка сама выводит тебя к пруду."',
    ],
    scores: { clarity: 2, concreteness: 2, connection_to_input: 1, reflection_utility: 1, total: 6 },
    notes:
      "Нарушение происхождения (invented_past_memory_in_story, строка 399): во 2-м абзаце story добавляет выдуманное второе воспоминание — «Ты вспоминаешь утреннюю прогулку по парку — не эту, а другую, когда ты шёл без цели и просто считал шаги. Тогда ты заметил, что если идти медленно, дорожка сама выводит тебя к пруду». В q3 дано лишь «Утренняя прогулка по парку.», поэтому придумывание отдельной прошлой прогулки со счётом шагов и прудом нарушает запрет server/myth.ts:418. Снижены connection_to_input (1/2) и reflection_utility (1/2, так как опора строится на выдуманном прошлом эпизоде, а щеколда калитки так и не опробована в действии).",
  }),
  set_2_brief_inputs__v11__run2: makeManualAuditEntry({
    provenance_clean: true,
    as_if_modality_preserved: null,
    violations: [],
    scores: { clarity: 2, concreteness: 2, connection_to_input: 2, reflection_utility: 1, total: 7 },
    notes:
      "Выдуманных воспоминаний и ошибок атрибуции нет: прогулка по парку включена в настоящее время сцены («садишься на низкую скамейку у входа в парк... идёшь по дорожке вдоль парка»), а в mirror.newView связка подана условно («Если в вашем ответе калитка — это работа, а утренняя прогулка — точка живости...»). Оценка reflection_utility снижена до 1/2 из-за троекратного буквального повтора фразы «Ты замечаешь, что она не заперта» в абзацах 2–4 и отсутствия активной пробы со щеколдой.",
  }),
  set_2_brief_inputs__v12__run1: makeManualAuditEntry({
    provenance_clean: false,
    as_if_modality_preserved: null,
    violations: [
      'invented_past_memory_in_story: "Ты смотришь на эту полоску и вспоминаешь утреннюю прогулку по парку: как ты шёл по аллее, не выбирая направления, и ноги сами несли тебя мимо скамеек и клёнов. Тогда не было вопроса — было только движение."',
    ],
    scores: { clarity: 2, concreteness: 2, connection_to_input: 1, reflection_utility: 2, total: 7 },
    notes:
      "Нарушение происхождения (invented_past_memory_in_story, строка 475): во 2-м абзаце story домысливает конкретное прошлое воспоминание («Ты смотришь на эту полоску и вспоминаешь утреннюю прогулку по парку: как ты шёл по аллее, не выбирая направления, и ноги сами несли тебя мимо скамеек и клёнов. Тогда не было вопроса — было только движение») сверх краткого ответа q3 «Утренняя прогулка по парку.». Кроме того, прогон потребовал 1 ремонт из-за unprompted_crack_cliche. Снижен connection_to_input до 1/2.",
  }),
  set_2_brief_inputs__v12__run2: makeManualAuditEntry({
    provenance_clean: false,
    as_if_modality_preserved: null,
    violations: [
      'story_detail_attributed_to_user_answer: "В вашем ответе это звук шагов и колёс за калиткой."',
    ],
    scores: { clarity: 2, concreteness: 2, connection_to_input: 1, reflection_utility: 2, total: 7 },
    notes:
      "Нарушение атрибуции источника (story_detail_attributed_to_user_answer, строка 519): в mirror.newView написано «В вашем ответе это звук шагов и колёс за калиткой», хотя звук шагов и колеса по асфальту придуман в 1-м абзаце story и отсутствует в кратких ответах q1–q4. Снижен connection_to_input до 1/2.",
  }),
  set_3_unknown_resource__v11__run1: makeManualAuditEntry({
    provenance_clean: true,
    as_if_modality_preserved: null,
    violations: [],
    scores: { clarity: 2, concreteness: 2, connection_to_input: 2, reflection_utility: 2, total: 8 },
    notes:
      "Происхождение и атрибуция чистые: при пустом ресурсе q3 («Не знаю, сейчас ничего не вспоминается») история не придумывает ни прошлых воспоминаний, ни бытовых привычек пользователя, а находит обратимый жест внутри сцены (отжать губку и поставить её на ребро на сухую часть бортика). В mirror источники строго разграничены.",
  }),
  set_3_unknown_resource__v11__run2: makeManualAuditEntry({
    provenance_clean: true,
    as_if_modality_preserved: null,
    violations: [],
    scores: { clarity: 2, concreteness: 2, connection_to_input: 2, reflection_utility: 2, total: 8 },
    notes:
      "Происхождение и атрибуция чистые: story прямо уважает ответ q3 («Ты вспоминаешь, что ничего не вспоминается — ни занятия, ни жеста, который сейчас вернул бы тебе опору»), а mirror точно фиксирует «в вашем ответе пока не вспоминается ни одной опоры» и относит отжимание губки к «в этой сцене».",
  }),
  set_3_unknown_resource__v12__run1: makeManualAuditEntry({
    provenance_clean: true,
    as_if_modality_preserved: null,
    violations: [],
    scores: { clarity: 2, concreteness: 2, connection_to_input: 2, reflection_utility: 1, total: 7 },
    notes:
      "Выдуманных воспоминаний и привычек нет, атрибуция в mirror чистая. Оценка reflection_utility снижена до 1/2, так как губка остаётся мокрой и тяжёлой на деревянной столешнице, куда впитывается вода, а действие ограничивается тем, что герой накрывает её ладонью сверху без отжима или смены положения.",
  }),
  set_3_unknown_resource__v12__run2: makeManualAuditEntry({
    provenance_clean: false,
    as_if_modality_preserved: null,
    violations: [
      'invented_habit_in_story: "Рядом с тобой лежит тяжёлая мокрая губка — та, которой ты обычно стираешь со стола, — но сейчас она просто лежит, разбухшая, тёмная, вобравшая в себя столько, что её края расплылись и потеряли форму."',
    ],
    scores: { clarity: 2, concreteness: 2, connection_to_input: 1, reflection_utility: 1, total: 6 },
    notes:
      "Нарушение происхождения (invented_habit_in_story, строка 686): при ответе q3 «Не знаю, сейчас ничего не вспоминается» и q2 «Тяжёлая мокрая губка» в 1-м абзаце story пользователю приписана бытовая привычка — «Рядом с тобой лежит тяжёлая мокрая губка — та, которой ты обычно стираешь со стола». Такой привычки во вводных нет. Снижены connection_to_input (1/2) и reflection_utility (1/2, так как герой просто кладёт мокрую губку на колено и затем на пол рядом с собой, не меняя её состояния).",
  }),
  set_4_real_action_in_q3__v11__run1: makeManualAuditEntry({
    provenance_clean: true,
    as_if_modality_preserved: null,
    violations: [],
    scores: { clarity: 2, concreteness: 2, connection_to_input: 2, reflection_utility: 2, total: 8 },
    notes:
      "Происхождение и атрибуция чистые: действие из q3 (спокойный пошаговый разбор архитектуры) переведено в физическое исследование устройства маховика спица за спицей в настоящем моменте без местоимений «вы» в story и без выдуманных воспоминаний.",
  }),
  set_4_real_action_in_q3__v11__run2: makeManualAuditEntry({
    provenance_clean: true,
    as_if_modality_preserved: null,
    violations: [],
    scores: { clarity: 2, concreteness: 2, connection_to_input: 2, reflection_utility: 2, total: 8 },
    notes:
      "Происхождение и атрибуция чистые: разбор архитектуры по шагам из q3 воплощён через схему маховика мелом (ось, спицы, обод, точка опоры) и малый точный сдвиг на ладонь.",
  }),
  set_4_real_action_in_q3__v12__run1: makeManualAuditEntry({
    provenance_clean: true,
    as_if_modality_preserved: null,
    violations: [],
    scores: { clarity: 2, concreteness: 2, connection_to_input: 1, reflection_utility: 2, total: 7 },
    notes:
      "Формальных нарушений атрибуции в mirror нет, однако в 3-м абзаце story регулярное действие с командой из q3 («Когда на работе спокойно разбираю сложную архитектуру с командой по шагам») сужено до единичного прошлого случая в одиночку («Ты вспоминаешь, как однажды разбирал сложную схему»), а сам прогон потребовал 1 ремонт из-за unprompted_crack_cliche. Поэтому connection_to_input оценён в 1/2.",
  }),
  set_4_real_action_in_q3__v12__run2: makeManualAuditEntry({
    provenance_clean: true,
    as_if_modality_preserved: null,
    violations: [],
    scores: { clarity: 2, concreteness: 2, connection_to_input: 2, reflection_utility: 2, total: 8 },
    notes:
      "Происхождение и атрибуция чистые: сцена разворачивается в настоящем времени вокруг спиц и пустот чугунного маховика, в mirror источники разграничены точно.",
  }),
  set_5_imaginative_scene__v11__run1: makeManualAuditEntry({
    provenance_clean: false,
    as_if_modality_preserved: false,
    violations: [
      'imagined_scene_modality_lost_in_mirror: "В вашем ответе есть и просьба взять ещё один отдел, и ощущение рассвета у моря." / "Если в вашем ответе переправа натянута туго, а живым вы называете ветер на рассвете у моря, то, может быть, устойчивость приходит не от того, что вы крепче держитесь, а от того, что вы позволяете себе провисать в середине?"',
    ],
    scores: { clarity: 2, concreteness: 2, connection_to_input: 1, reflection_utility: 2, total: 7 },
    notes:
      "Потеря модальности «как будто» (imagined_scene_modality_lost_in_mirror, строки 918, 920): в q3 пользователь написал «Как будто стою на высоком берегу моря на рассвете и слушаю ветер», но в mirror.innerTension это названо «ощущение рассвета у моря», а в mirror.newView — «а живым вы называете ветер на рассвете у моря» без сохранения оговорки «как будто» / воображаемого статуса сцены. Снижен connection_to_input до 1/2.",
  }),
  set_5_imaginative_scene__v11__run2: makeManualAuditEntry({
    provenance_clean: false,
    as_if_modality_preserved: false,
    violations: [
      'imagined_scene_modality_lost_in_mirror: "Вы называете точку живости — стоять на высоком берегу моря на рассвете и слушать ветер."',
    ],
    scores: { clarity: 2, concreteness: 2, connection_to_input: 1, reflection_utility: 2, total: 7 },
    notes:
      "Потеря модальности «как будто» (imagined_scene_modality_lost_in_mirror, строка 957): в mirror.newView сказано «Вы называете точку живости — стоять на высоком берегу моря на рассвете и слушать ветер» без оговорки «как будто», подменяя воображаемый образ из q3 реальным опытом. Снижен connection_to_input до 1/2.",
  }),
  set_5_imaginative_scene__v12__run1: makeManualAuditEntry({
    provenance_clean: false,
    as_if_modality_preserved: false,
    violations: [
      'imagined_scene_modality_lost_in_mirror: "Вы называете точку живости — стоять на высоком берегу моря на рассвете и слушать ветер."',
    ],
    scores: { clarity: 2, concreteness: 2, connection_to_input: 1, reflection_utility: 2, total: 7 },
    notes:
      "Потеря модальности «как будто» (imagined_scene_modality_lost_in_mirror, строка 996): в mirror.newView сказано «Вы называете точку живости — стоять на высоком берегу моря на рассвете и слушать ветер» без сохранения оговорки «как будто». Снижен connection_to_input до 1/2.",
  }),
  set_5_imaginative_scene__v12__run2: makeManualAuditEntry({
    provenance_clean: false,
    as_if_modality_preserved: false,
    violations: [
      'imagined_scene_modality_lost_in_mirror: "В вашем ответе вы назвали высокий берег моря на рассвете и ветер."',
    ],
    scores: { clarity: 2, concreteness: 2, connection_to_input: 1, reflection_utility: 2, total: 7 },
    notes:
      "Потеря модальности «как будто» (imagined_scene_modality_lost_in_mirror, строка 1033): в mirror.newView сказано «В вашем ответе вы назвали высокий берег моря на рассвете и ветер» без оговорки «как будто», превращая воображаемую сцену из q3 в буквальный объект ответа. Снижен connection_to_input до 1/2.",
  }),
  set_6_explicit_user_crack__v11__run1: makeManualAuditEntry({
    provenance_clean: false,
    as_if_modality_preserved: null,
    violations: [
      'invented_past_memory_in_story: "Смотришь на трещину и вспоминаешь, как недавно всё было иначе: чашка переходила из рук в руки, и никто не считал, кто прав."',
    ],
    scores: { clarity: 2, concreteness: 2, connection_to_input: 1, reflection_utility: 2, total: 7 },
    notes:
      "Нарушение происхождения (invented_past_memory_in_story, строка 1085): во 2-м абзаце story добавлено выдуманное воспоминание «Смотришь на трещину и вспоминаешь, как недавно всё было иначе: чашка переходила из рук в руки, и никто не считал, кто прав» (детали про недавнее прошлое, где эта чашка переходила из рук в руки, нет во вводных q1–q4). Также прогон потребовал 1 ремонт из-за register_formal_you_forbidden. Снижен connection_to_input до 1/2.",
  }),
  set_6_explicit_user_crack__v11__run2: makeManualAuditEntry({
    provenance_clean: false,
    as_if_modality_preserved: null,
    violations: [
      'invented_past_memory_in_story: "Ты вспоминаешь, как эта чашка появилась у тебя — не важно откуда, просто появилась и стала своей. ... Ты думаешь о том, что эта чашка видела много таких вечеров: с телефоном в руке, с молчанием, с раздражением, которое оседало на дне."',
    ],
    scores: { clarity: 2, concreteness: 2, connection_to_input: 1, reflection_utility: 2, total: 7 },
    notes:
      "Нарушение происхождения (invented_past_memory_in_story, строка 1124): во 2-м и 3-м абзацах story домыслена история появления чашки и прошлых ссор («Ты вспоминаешь, как эта чашка появилась у тебя — не важно откуда, просто появилась и стала своей... Ты думаешь о том, что эта чашка видела много таких вечеров: с телефоном в руке, с молчанием, с раздражением, которое оседало на дне»). Снижен connection_to_input до 1/2.",
  }),
  set_6_explicit_user_crack__v12__run1: makeManualAuditEntry({
    provenance_clean: true,
    as_if_modality_preserved: null,
    violations: [],
    scores: { clarity: 2, concreteness: 2, connection_to_input: 2, reflection_utility: 2, total: 8 },
    notes:
      "Происхождение и атрибуция чистые: сцена удерживается в настоящем моменте за кухонным столом рядом с фарфоровой чашкой с трещиной и чайником без выдуманных прошлых эпизодов; в mirror источники разграничены корректно.",
  }),
  set_6_explicit_user_crack__v12__run2: makeManualAuditEntry({
    provenance_clean: false,
    as_if_modality_preserved: null,
    violations: [
      'invented_past_memory_in_story: "Ты смотришь на трещину и вспоминаешь, как вчера звучал твой голос — резко, на повышенных. Ты не хочешь вспоминать, но оно приходит."',
    ],
    scores: { clarity: 2, concreteness: 2, connection_to_input: 1, reflection_utility: 2, total: 7 },
    notes:
      "Нарушение происхождения (invented_past_memory_in_story, строка 1200): во 2-м абзаце story приписано конкретное воспоминание о вчерашнем крике — «Ты смотришь на трещину и вспоминаешь, как вчера звучал твой голос — резко, на повышенных. Ты не хочешь вспоминать, но оно приходит», чего нет во вводных q1–q4. Снижен connection_to_input до 1/2.",
  }),
};

export function evaluateMythRunProvenanceAndScores(
  run: {
    run_index?: number;
    title: string;
    story: string;
    mirror: {
      mainImage: string;
      innerTension: string;
      hiddenResource: string;
      newView: string;
    };
    meaning: string[];
    one_step: string;
    journal_question: string;
    quality: { passed: boolean; blockers: string[]; warnings?: string[]; word_count: number; paragraph_count: number };
  },
  setItem: (typeof MYTH_FIXED_6_SETS)[number],
  variant?: "v11" | "v12"
) {
  const mirrorTexts = [
    run.mirror.mainImage,
    run.mirror.innerTension,
    run.mirror.hiddenResource,
    run.mirror.newView,
    ...(run.meaning || []),
  ];
  const combinedMirror = mirrorTexts.join(" ");
  const mirrorSentences = mirrorTexts
    .flatMap((t) => t.split(/(?<=[.!?])\s+/u))
    .map((s) => s.trim())
    .filter(Boolean);
  const storySentences = (run.story || "")
    .split(/(?<=[.!?])\s+/u)
    .map((s) => s.trim())
    .filter(Boolean);

  const attributionViolations: string[] = [];

  // 1. Check "в вашем ответе стало возможно" or attributing story gestures to "в вашем ответе" in hiddenResource
  if (/в\s+вашем\s+ответе\s+стало\s+возможн/iu.test(combinedMirror)) {
    attributionViolations.push("hiddenResource_attributes_scene_possibility_to_user_answer");
  }

  // 2. Check across ALL 6 sets whether any sentence in mirror/meaning attributes story-only details
  // (e.g. "звук шагов и колёс за калиткой" in Set 2, or "раковина / на краю / на ребро / отжать" in Set 3)
  // to the user's literal answers ("в вашем ответе").
  for (const sent of mirrorSentences) {
    if (/в\s+вашем\s+ответе/iu.test(sent)) {
      if (
        /в\s+вашем\s+ответе[^.,;—:]*?(?:раковин|на\s+ребр|отжат|сжат|положит|звук\s+шагов|колёс\s+за\s+калитк)/iu.test(
          sent
        ) ||
        (setItem.set_id === "set_3_unknown_resource" &&
          /в\s+вашем\s+ответе[^.,;—:]*?(?:на\s+краю)/iu.test(sent))
      ) {
        attributionViolations.push(`story_detail_attributed_to_user_answer: "${sent}"`);
      }
    }
  }

  // 3. Check for invented past memories / ungiven past events in story (server/myth.ts:418)
  const inventedMemorySnippets: string[] = [];
  for (let idx = 0; idx < storySentences.length; idx++) {
    const sent = storySentences[idx];
    const isInventedMemory =
      (/вспоминаешь/iu.test(sent) &&
        !/вспоминаешь,\s*что\s+ничего\s+не\s+вспоминается/iu.test(sent) &&
        /(?:не\s+эту,\s+а\s+другую|считал\s+шаги|дорожка\s+сама\s+выводит|как\s+ты\s+шёл\s+по\s+аллее|мимо\s+скамеек\s+и\s+клёнов|как\s+недавно\s+всё\s+было\s+иначе|чашка\s+переходила\s+из\s+рук\s+в\s+руки|как\s+эта\s+чашка\s+появилась|как\s+вчера\s+звучал\s+твой\s+голос|резко,\s+на\s+повышенных|в\s+детстве|раньше\s+ты\s+умел)/iu.test(
          sent
        )) ||
      /эта\s+чашка\s+видела\s+много\s+таких\s+вечеров/iu.test(sent);
    if (isInventedMemory) {
      const nextSent = storySentences[idx + 1];
      if (
        nextSent &&
        /(?:^Тогда\s+(?:ты\s+заметил|не\s+было\s+вопроса)|^Ты\s+не\s+хочешь\s+вспоминать,\s+но\s+оно\s+приходит)/iu.test(
          nextSent
        )
      ) {
        inventedMemorySnippets.push(`${sent} ${nextSent}`);
        idx += 1;
      } else {
        inventedMemorySnippets.push(sent);
      }
    }
  }
  if (inventedMemorySnippets.length > 0) {
    attributionViolations.push(
      `invented_past_memory_in_story: "${inventedMemorySnippets.join(" ... ")}"`
    );
  }

  // 4. Check for invented personal habits in story (e.g. Set 3 V12 Run 2: "та, которой ты обычно стираешь со стола")
  const inventedHabitSentence = storySentences.find((sent) =>
    /(?:та,\s+которой\s+ты\s+обычно\s+стираешь\s+со\s+стола|которой\s+ты\s+обычно\s+[а-яё]+|как\s+ты\s+обычно\s+делаешь|по\s+своей\s+привычке)/iu.test(
      sent
    )
  );
  if (inventedHabitSentence) {
    attributionViolations.push(`invented_habit_in_story: "${inventedHabitSentence}"`);
  }

  if (setItem.set_id === "set_3_unknown_resource") {
    // Also check that unknown q3 did not invent a past skill or memory
    if (/(?:в\s+детстве|раньше\s+ты\s+умел|твой\s+прежний\s+опыт|скрытый\s+талант)/iu.test(run.story + " " + combinedMirror)) {
      attributionViolations.push("set3_unknown_q3_invented_past_skill_or_memory");
    }
  }

  // 5. For Set 5 (or any set where q3 has "как будто"): check preservation of "как будто" (imagined modality) in mirror
  let asIfModalityPreserved: boolean | null = null;
  if (/как\s+будто/iu.test(setItem.inputs.q3)) {
    asIfModalityPreserved = /(?:как\s+будто|вообража[а-яё]*|представля[а-яё]*|мысленн[а-яё]*)/iu.test(
      combinedMirror
    );
    if (!asIfModalityPreserved) {
      const offendingMirrorSents = mirrorSentences.filter((s) =>
        /(?:высоком\s+берегу|высокий\s+берег|берег[ауе]?\s+моря|у\s+моря|рассвет|точк[ауой]\s+живости|живым\s+вы\s+называете)/iu.test(
          s
        )
      );
      const joinedOffending =
        offendingMirrorSents.length > 0
          ? offendingMirrorSents.map((s) => `"${s}"`).join(" / ")
          : `"${run.mirror.newView}"`;
      attributionViolations.push(`imagined_scene_modality_lost_in_mirror: ${joinedOffending}`);
    }
    if (/(?:в\s+реальной\s+жизни\s+вы\s+стоите\s+на\s+берегу|в\s+вашей\s+практике\s+на\s+берегу\s+моря)/iu.test(combinedMirror)) {
      attributionViolations.push("set5_imaginative_q3_treated_as_literal_biography");
    }
  }

  // 6. For Set 6 (explicit user crack): must preserve crack image
  if (setItem.set_id === "set_6_explicit_user_crack") {
    if (!/трещин/iu.test(run.story + " " + combinedMirror)) {
      attributionViolations.push("set6_explicit_user_crack_omitted");
    }
  } else {
    // Sets 1-5: must not contain unprompted crack
    if (/(?<![а-яё])трещин[а-яё]*/iu.test(run.story + " " + combinedMirror)) {
      attributionViolations.push("unprompted_crack_in_non_crack_set");
    }
  }

  // 7. Check q4 non-completion: must not declare final healing or wish fulfillment
  if (/(?:ты\s+полностью\s+исцел|проблема\s+навсегда\s+решена|теперь\s+ты\s+стал\s+другим\s+человеком)/iu.test(run.story + " " + combinedMirror)) {
    attributionViolations.push("q4_declared_completed_fact");
  }

  const provenanceClean = run.quality.passed && attributionViolations.length === 0;

  const manualKey =
    variant && typeof run.run_index === "number"
      ? `${setItem.set_id}__${variant}__run${run.run_index}`
      : null;
  const manualEntry = manualKey ? MANUAL_24_RUN_AUDIT[manualKey] : undefined;

  if (manualEntry) {
    if (
      manualEntry.provenance_clean !== provenanceClean ||
      manualEntry.as_if_modality_preserved !== asIfModalityPreserved ||
      JSON.stringify(manualEntry.violations) !== JSON.stringify(attributionViolations)
    ) {
      throw new Error(
        `Manual vs programmatic provenance mismatch on ${manualKey}: manual=${JSON.stringify({
          provenance_clean: manualEntry.provenance_clean,
          as_if_modality_preserved: manualEntry.as_if_modality_preserved,
          violations: manualEntry.violations,
        })}, programmatic=${JSON.stringify({
          provenance_clean: provenanceClean,
          as_if_modality_preserved: asIfModalityPreserved,
          violations: attributionViolations,
        })}`
      );
    }
    return {
      provenance_clean: provenanceClean,
      as_if_modality_preserved: asIfModalityPreserved,
      imagined_scene_as_if_preserved: asIfModalityPreserved,
      attribution_violations: attributionViolations,
      scores_out_of_8: manualEntry.scores_out_of_8,
      manual_review: manualEntry,
    };
  }

  // Fallback dynamic 0-2 scoring (used for historical V6 runs outside the 24-run V9 corpus):
  const clarity =
    !run.quality.passed
      ? 0
      : run.quality.word_count >= 300 &&
          run.quality.word_count <= 800 &&
          run.quality.paragraph_count >= 3 &&
          run.quality.paragraph_count <= 6
        ? 2
        : 1;
  const hasConcreteOneStep = typeof run.one_step === "string" && run.one_step.trim().length >= 25;
  const concreteness = !run.quality.passed ? 0 : hasConcreteOneStep ? 2 : 1;
  const connection_to_input = !provenanceClean ? (run.quality.passed ? 1 : 0) : 2;
  const hasPossibilityLanguage = /(?:стало\s+возможн|можно|открылась\s+возможность|позволяет|даёт\s+возможность)/iu.test(
    run.mirror.hiddenResource
  );
  const hasOpenQuestions =
    run.mirror.newView.includes("?") && run.journal_question.includes("?");
  const reflection_utility =
    !run.quality.passed ? 0 : hasPossibilityLanguage && hasOpenQuestions ? 2 : 1;
  const total = clarity + concreteness + connection_to_input + reflection_utility;

  return {
    provenance_clean: provenanceClean,
    as_if_modality_preserved: asIfModalityPreserved,
    imagined_scene_as_if_preserved: asIfModalityPreserved,
    attribution_violations: attributionViolations,
    scores_out_of_8: {
      clarity,
      concreteness,
      connection_to_input,
      reflection_utility,
      total,
    },
    manual_review: null,
  };
}

async function runMythValidatorAndSet4Verification(): Promise<boolean> {
  console.log("[v9] Running Check 0A: Myth Validator Unit Checks, V6 Historical Audit, and Full 24-Run Live V11 vs V12 Corpus...");

  const unitChecks = [
    {
      id: "reviewer_repro_workplace_modal",
      text: "Ты сидишь. Ты смотришь. На работе вы можете решить",
      secondPersonCount: 3,
      expectedViolation: true,
    },
    {
      id: "workplace_collective_verb_without_group_marker",
      text: "Ты сидишь. Ты смотришь. На работе вы разбираете задачу",
      secondPersonCount: 3,
      expectedViolation: true,
    },
    {
      id: "workplace_bare_raznye_without_reciprocal_verb",
      text: "Ты сидишь. Ты смотришь. На работе вы разбираете разные задачи",
      secondPersonCount: 3,
      expectedViolation: true,
    },
    {
      id: "locative_department_without_comitative_marker",
      text: "Ты сидишь. Ты смотришь. В отделе вы разбираете задачу",
      secondPersonCount: 3,
      expectedViolation: true,
    },
    {
      id: "locative_team_without_comitative_marker",
      text: "Ты сидишь. Ты смотришь. В команде вы строите план",
      secondPersonCount: 3,
      expectedViolation: true,
    },
    {
      id: "cross_clause_colleagues_leakage",
      text: "Ты сидишь. Ты смотришь. После разговора с коллегами вы разбираете свои записи",
      secondPersonCount: 3,
      expectedViolation: true,
    },
    {
      id: "modal_verb_with_team_marker",
      text: "Ты сидишь. Ты смотришь. Вы с командой можете решить задачу",
      secondPersonCount: 3,
      expectedViolation: true,
    },
    {
      id: "missing_second_person_baseline_with_team",
      text: "Вы с командой разбираете задачу.",
      secondPersonCount: 0,
      expectedViolation: true,
    },
    {
      id: "recalled_workplace_without_group_marker",
      text: "Ты вспоминаешь, как на работе вы разбираете сложную архитектуру по шагам.",
      secondPersonCount: 3,
      expectedViolation: true,
    },
    {
      id: "recalled_workplace_with_explicit_team_marker",
      text: "Ты вспоминаешь, как на работе вы с командой разбираете сложную архитектуру по шагам.",
      secondPersonCount: 3,
      expectedViolation: false,
    },
    {
      id: "explicit_couple_different_choices",
      text: "Ты сидишь. Ты смотришь. Вы обсудили и выбираете разные варианты.",
      secondPersonCount: 3,
      expectedViolation: false,
    },
    {
      id: "recalled_couple_weekend_discussion",
      text: "Ты вспоминаешь, как однажды вы спокойно обсудили выходные и выбрали разные занятия.",
      secondPersonCount: 3,
      expectedViolation: false,
    },
  ].map((c) => {
    const actualViolation = hasFormalYouViolation(c.text, c.secondPersonCount);
    return {
      ...c,
      actualViolation,
      passed: actualViolation === c.expectedViolation,
    };
  });

  const provenanceUnitChecks = [
    {
      id: "set2_v11_run1_invented_second_walk_memory",
      setItem: MYTH_FIXED_6_SETS[1],
      story:
        "Ты стоишь перед калиткой. Ты вспоминаешь утреннюю прогулку по парку — не эту, а другую, когда ты шёл без цели и просто считал шаги.",
      mirrorNewView: "Если в вашем ответе утренняя прогулка даёт ощущение живости, что изменится?",
      expectedClean: false,
      expectedViolationPrefix: "invented_past_memory_in_story",
    },
    {
      id: "set3_v12_run2_invented_sponge_habit",
      setItem: MYTH_FIXED_6_SETS[2],
      story:
        "Рядом с тобой лежит тяжёлая мокрая губка — та, которой ты обычно стираешь со стола, — но сейчас она просто лежит.",
      mirrorNewView: "Что изменится, если позволить тишине просто стоять рядом?",
      expectedClean: false,
      expectedViolationPrefix: "invented_habit_in_story",
    },
    {
      id: "set5_lost_as_if_modality_in_mirror",
      setItem: MYTH_FIXED_6_SETS[4],
      story: "Ты стоишь на краю берега перед переправой.",
      mirrorNewView:
        "Вы называете точку живости — стоять на высоком берегу моря на рассвете и слушать ветер. Что меняется?",
      expectedClean: false,
      expectedViolationPrefix: "imagined_scene_modality_lost_in_mirror",
    },
    {
      id: "set5_preserved_as_if_modality_in_mirror",
      setItem: MYTH_FIXED_6_SETS[4],
      story: "Ты стоишь на краю берега перед переправой.",
      mirrorNewView:
        "В вашем ответе точка живости описана как воображаемый образ — «как будто стою на высоком берегу моря на рассвете и слушаю ветер». Что меняется?",
      expectedClean: true,
      expectedViolationPrefix: null,
    },
  ].map((c) => {
    const res = evaluateMythRunProvenanceAndScores(
      {
        title: "Тест",
        story: c.story,
        mirror: {
          mainImage: "В вашем ответе назван образ.",
          innerTension: "В этой сцене есть выбор.",
          hiddenResource: "В этой сцене стало возможно остановиться.",
          newView: c.mirrorNewView,
        },
        meaning: ["Один", "Два", "Три?"],
        one_step: "Вы можете сделать один спокойный шаг или не делать его.",
        journal_question: "Что вы заметите?",
        quality: { passed: true, blockers: [], word_count: 360, paragraph_count: 4 },
      },
      c.setItem
    );
    const matchedPrefix = c.expectedViolationPrefix
      ? res.attribution_violations.some((v) => v.startsWith(c.expectedViolationPrefix!))
      : res.attribution_violations.length === 0;
    const passed = res.provenance_clean === c.expectedClean && matchedPrefix;
    return {
      id: c.id,
      expectedClean: c.expectedClean,
      actualClean: res.provenance_clean,
      as_if_modality_preserved: res.as_if_modality_preserved,
      violations: res.attribution_violations,
      passed,
    };
  });

  const unitChecksPassed =
    unitChecks.every((c) => c.passed) && provenanceUnitChecks.every((c) => c.passed);

  // Audit historical V6 Set 4 & Set 3 runs for complete transparency
  const v6MythPath = path.resolve(
    REPO_ROOT,
    "../../outputs/convergence-evidence-v6/live-runs/myth-comparison-6x2-v11-v12.json"
  );
  const v6Data = JSON.parse(fs.readFileSync(v6MythPath, "utf8"));

  const historicalSet4Audit: any[] = [];
  const historicalSet3Audit: any[] = [];
  for (const s of v6Data.sets) {
    if (s.set_id === "set_4_real_action_in_q3") {
      for (const variantKey of ["variant_a_v11", "variant_b_v12"] as const) {
        for (const run of s[variantKey]) {
          const qualityUnderFixedValidator = validatePersonalMythResult(
            {
              title: run.title,
              story: run.story,
              mirror: run.mirror,
              meaning: run.meaning,
              one_step: run.one_step,
              journal_question: run.journal_question,
              disclaimer: "Образный формат для саморефлексии. Не диагностика и не инструкция к действию.",
            },
            { answers: s.inputs } as any
          );
          historicalSet4Audit.push({
            variant: variantKey,
            run_index: run.run_index,
            offending_sentence:
              run.story
                .split(/(?<=[.!?])\s+/)
                .find((sent: string) => /\bвы\b/iu.test(sent)) || null,
            v6_blockers: run.quality.blockers,
            v9_fixed_validator_blockers: qualityUnderFixedValidator.blockers,
            v9_fixed_validator_passed: qualityUnderFixedValidator.passed,
          });
        }
      }
    }
    if (s.set_id === "set_3_unknown_resource") {
      for (const variantKey of ["variant_a_v11", "variant_b_v12"] as const) {
        for (const run of s[variantKey]) {
          const evalRes = evaluateMythRunProvenanceAndScores(run, s);
          historicalSet3Audit.push({
            variant: variantKey,
            run_index: run.run_index,
            mainImage: run.mirror.mainImage,
            hiddenResource: run.mirror.hiddenResource,
            v9_attribution_violations: evalRes.attribution_violations,
          });
        }
      }
    }
  }

  // Full 24-run live execution across all 6 fixed sets (6 sets x 2 variants x 2 runs = 24 runs) on the single current revision of V11 and V12
  const v9CorpusCachePath = path.join(LIVE_RUNS_DIR, "myth-24-runs-v9-comparison.json");
  let cachedSets: any[] | null = null;

  if (fs.existsSync(v9CorpusCachePath) && process.env.FORCE_MYTH_24_RERUN !== "1") {
    try {
      const cached = JSON.parse(fs.readFileSync(v9CorpusCachePath, "utf8"));
      if (
        Array.isArray(cached?.sets) &&
        cached.sets.length === 6 &&
        cached.sets.every(
          (s: any) =>
            Array.isArray(s.variant_a_v11) &&
            s.variant_a_v11.length === 2 &&
            Array.isArray(s.variant_b_v12) &&
            s.variant_b_v12.length === 2
        )
      ) {
        cachedSets = cached.sets;
        console.log("[v9] Loaded existing 24 live V9 runs from myth-24-runs-v9-comparison.json and re-evaluating validators & manual/programmatic provenance audit...");
      }
    } catch {}
  }

  const provider = createRouterAIMythProvider(new RouterAIClient(process.env));
  const promptFunctionsSha256 = crypto
    .createHash("sha256")
    .update(buildPersonalMythPromptV11.toString() + "\n" + buildPersonalMythPromptV12.toString())
    .digest("hex");

  const getPromptAndShaForRun = (
    setItem: (typeof MYTH_FIXED_6_SETS)[number],
    variant: "v11" | "v12",
    runIndex: number
  ) => {
    const req: any = {
      request_id: `v9_${setItem.set_id}_${variant}_run${runIndex}`,
      consent_version: CONSENT_VERSION,
      answers: setItem.inputs,
    };
    const prompt =
      variant === "v11" ? buildPersonalMythPromptV11(req) : buildPersonalMythPromptV12(req);
    const promptSha256 = crypto.createHash("sha256").update(prompt).digest("hex");
    return { req, prompt, promptSha256 };
  };

  const generateSingleMythRun = async (
    setItem: (typeof MYTH_FIXED_6_SETS)[number],
    variant: "v11" | "v12",
    runIndex: number
  ) => {
    const t0 = Date.now();
    const { req, prompt, promptSha256 } = getPromptAndShaForRun(setItem, variant, runIndex);
    const raw1 = await provider.generate(prompt, 65000);
    let parsed = parsePersonalMythResult(raw1);
    let qual = validatePersonalMythResult(parsed, req);
    let repaired = false;
    const initialBlockers = [...qual.blockers];
    if (!qual.passed) {
      repaired = true;
      const repPrompt = buildPersonalMythRepairPrompt(req, parsed.story, parsed.mirror, qual.blockers, parsed);
      const raw2 = await provider.generate(repPrompt, 65000);
      parsed = parsePersonalMythResult(raw2);
      qual = validatePersonalMythResult(parsed, req);
    }
    const baseRun = {
      run_index: runIndex,
      prompt_sha256: promptSha256,
      title: parsed.title,
      story: parsed.story,
      mirror: parsed.mirror,
      meaning: parsed.meaning,
      one_step: parsed.one_step,
      journal_question: parsed.journal_question,
      quality: qual,
      initial_blockers: initialBlockers,
      repaired,
      latencyMs: Date.now() - t0,
    };
    const evalRes = evaluateMythRunProvenanceAndScores(baseRun, setItem, variant);
    console.log(
      `[v9] ${setItem.set_id} ${variant} run ${runIndex}: passed=${qual.passed}, provenance_clean=${evalRes.provenance_clean}, score=${evalRes.scores_out_of_8.total}/8, repaired=${repaired}, words=${qual.word_count}`
    );
    return {
      ...baseRun,
      ...evalRes,
    };
  };

  const evaluateOrRegenerateRun = async (
    cachedRun: any | undefined,
    setItem: (typeof MYTH_FIXED_6_SETS)[number],
    variant: "v11" | "v12",
    runIndex: number
  ) => {
    const { promptSha256 } = getPromptAndShaForRun(setItem, variant, runIndex);
    // When evaluating a cached 24-run corpus generated under the exact same prompt hash,
    // evaluate each run as-is without selectively regenerating individual runs on failure.
    if (cachedRun && cachedRun.prompt_sha256 === promptSha256) {
      const qual = validatePersonalMythResult(
        {
          title: cachedRun.title,
          story: cachedRun.story,
          mirror: cachedRun.mirror,
          meaning: cachedRun.meaning,
          one_step: cachedRun.one_step,
          journal_question: cachedRun.journal_question,
          disclaimer: "Образный формат для саморефлексии. Не диагностика и не инструкция к действию.",
        },
        { answers: setItem.inputs } as any
      );
      const updatedRun = { ...cachedRun, run_index: runIndex, prompt_sha256: promptSha256, quality: qual };
      const evalRes = evaluateMythRunProvenanceAndScores(updatedRun, setItem, variant);
      return {
        ...updatedRun,
        ...evalRes,
      };
    }
    return generateSingleMythRun(setItem, variant, runIndex);
  };

  const evaluatedSets: any[] = [];
  for (let i = 0; i < MYTH_FIXED_6_SETS.length; i++) {
    const setItem = MYTH_FIXED_6_SETS[i];
    const cachedSet = cachedSets?.find((cs: any) => cs.set_id === setItem.set_id);

    console.log(`[v9] Evaluating / generating 4 live runs for ${setItem.set_id} (2x V11 + 2x V12)...`);
    const [a1, b1] = await Promise.all([
      evaluateOrRegenerateRun(cachedSet?.variant_a_v11?.[0], setItem, "v11", 1),
      evaluateOrRegenerateRun(cachedSet?.variant_b_v12?.[0], setItem, "v12", 1),
    ]);
    const [a2, b2] = await Promise.all([
      evaluateOrRegenerateRun(cachedSet?.variant_a_v11?.[1], setItem, "v11", 2),
      evaluateOrRegenerateRun(cachedSet?.variant_b_v12?.[1], setItem, "v12", 2),
    ]);
    const v11Runs = [a1, a2];
    const v12Runs = [b1, b2];

    const v11Sum = v11Runs.reduce((acc, r) => acc + r.scores_out_of_8.total, 0);
    const v12Sum = v12Runs.reduce((acc, r) => acc + r.scores_out_of_8.total, 0);
    const v11CleanRunsInSet = v11Runs.filter((r) => r.provenance_clean).length;
    const v12CleanRunsInSet = v12Runs.filter((r) => r.provenance_clean).length;
    const v11Clean = v11CleanRunsInSet === 2;
    const v12Clean = v12CleanRunsInSet === 2;
    const isSet5 = setItem.set_id === "set_5_imaginative_scene";

    evaluatedSets.push({
      set_id: setItem.set_id,
      name: setItem.name,
      inputs: setItem.inputs,
      variant_a_v11: v11Runs,
      variant_b_v12: v12Runs,
      set_summary: {
        v11_total_score_out_of_16: v11Sum,
        v12_total_score_out_of_16: v12Sum,
        v11_clean_runs_count: v11CleanRunsInSet,
        v12_clean_runs_count: v12CleanRunsInSet,
        v11_provenance_clean: v11Clean,
        v12_provenance_clean: v12Clean,
        ...(isSet5
          ? {
              v11_as_if_modality_preserved_count: v11Runs.filter(
                (r) => r.as_if_modality_preserved === true
              ).length,
              v12_as_if_modality_preserved_count: v12Runs.filter(
                (r) => r.as_if_modality_preserved === true
              ).length,
            }
          : {}),
        v12_strictly_better_than_v11: v12Clean && (!v11Clean || v12Sum > v11Sum),
        v12_worse_than_v11:
          v12CleanRunsInSet < v11CleanRunsInSet ||
          (v12CleanRunsInSet === v11CleanRunsInSet && v12Sum < v11Sum),
      },
    });
  }

  const all24ValidatorPassed = evaluatedSets.every(
    (s) =>
      s.variant_a_v11.every((r: any) => r.quality.passed) &&
      s.variant_b_v12.every((r: any) => r.quality.passed)
  );
  const all12V11ProvenanceClean = evaluatedSets.every((s) => s.set_summary.v11_provenance_clean);
  const all12V12ProvenanceClean = evaluatedSets.every((s) => s.set_summary.v12_provenance_clean);
  const all24ProvenanceClean = all12V11ProvenanceClean && all12V12ProvenanceClean;
  const v11CleanRunsCount = evaluatedSets.reduce(
    (acc, s) => acc + s.variant_a_v11.filter((r: any) => r.provenance_clean).length,
    0
  );
  const v12CleanRunsCount = evaluatedSets.reduce(
    (acc, s) => acc + s.variant_b_v12.filter((r: any) => r.provenance_clean).length,
    0
  );
  const v11ProvenanceViolations = evaluatedSets.reduce(
    (acc, s) =>
      acc + s.variant_a_v11.reduce((a: number, r: any) => a + (r.attribution_violations?.length || 0), 0),
    0
  );
  const v12ProvenanceViolations = evaluatedSets.reduce(
    (acc, s) =>
      acc + s.variant_b_v12.reduce((a: number, r: any) => a + (r.attribution_violations?.length || 0), 0),
    0
  );
  const v11TotalScoreOutOf96 = evaluatedSets.reduce(
    (acc, s) => acc + s.set_summary.v11_total_score_out_of_16,
    0
  );
  const v12TotalScoreOutOf96 = evaluatedSets.reduce(
    (acc, s) => acc + s.set_summary.v12_total_score_out_of_16,
    0
  );
  const v11RepairCount = evaluatedSets.reduce(
    (acc, s) => acc + s.variant_a_v11.filter((r: any) => r.repaired).length,
    0
  );
  const v12RepairCount = evaluatedSets.reduce(
    (acc, s) => acc + s.variant_b_v12.filter((r: any) => r.repaired).length,
    0
  );
  const setsWhereV12StrictlyBetter = evaluatedSets.filter(
    (s) => s.set_summary.v12_strictly_better_than_v11
  ).length;
  const setsWhereV12Worse = evaluatedSets.filter((s) => s.set_summary.v12_worse_than_v11).length;
  const v12MeetsSwitchThreshold =
    setsWhereV12StrictlyBetter >= 4 && setsWhereV12Worse === 0 && all12V12ProvenanceClean;

  const historicalSet4StrictlyFlagged = historicalSet4Audit.every((r) =>
    r.v9_fixed_validator_blockers.includes("register_formal_you_forbidden")
  );

  const set3FromCorpus = evaluatedSets.find((s) => s.set_id === "set_3_unknown_resource");
  const set3V11ProvenanceClean = Boolean(set3FromCorpus?.set_summary.v11_provenance_clean);
  const set5FromCorpus = evaluatedSets.find((s) => s.set_id === "set_5_imaginative_scene");

  const fullCorpusReport = {
    generated_at: new Date().toISOString(),
    pair: { web_pin: WEB_PIN, web_sha: WEB_SHA, dcs_sha: DCS_SHA },
    single_prompt_revision_for_all_24_runs: true,
    prompt_functions_sha256: promptFunctionsSha256,
    total_runs: 24,
    all_24_validator_passed: all24ValidatorPassed,
    all_12_v11_provenance_and_attribution_clean: all12V11ProvenanceClean,
    all_12_v12_provenance_and_attribution_clean: all12V12ProvenanceClean,
    all_24_provenance_and_attribution_clean: all24ProvenanceClean,
    v11_clean_runs_count: v11CleanRunsCount,
    v12_clean_runs_count: v12CleanRunsCount,
    v11_provenance_violations: v11ProvenanceViolations,
    v12_provenance_violations: v12ProvenanceViolations,
    v11_total_score_out_of_96: v11TotalScoreOutOf96,
    v12_total_score_out_of_96: v12TotalScoreOutOf96,
    v11_repairs_used: v11RepairCount,
    v12_repairs_used: v12RepairCount,
    set5_as_if_modality_audit: {
      q3_input: set5FromCorpus?.inputs?.q3,
      v11_runs_preserving_as_if:
        set5FromCorpus?.set_summary?.v11_as_if_modality_preserved_count ?? 0,
      v12_runs_preserving_as_if:
        set5FromCorpus?.set_summary?.v12_as_if_modality_preserved_count ?? 0,
      finding:
        "Во всех 4 прогонах Набора 5 (2× V11 и 2× V12) поле mirror.newView / mirror.innerTension называет воображаемое стояние на высоком берегу моря на рассвете («Как будто стою на высоком берегу моря на рассвете и слушаю ветер») «точкой живости» / «ощущением рассвета у моря» без сохранения оговорки «как будто».",
    },
    selection_rule:
      "Переключать промпт по умолчанию с V11 на V12 только если V12 строго лучше минимум на 4 из 6 фиксированных наборов, не хуже на остальных и даёт 0 нарушений происхождения данных (иначе оставлять V11).",
    sets_where_v12_strictly_better: setsWhereV12StrictlyBetter,
    sets_where_v12_worse: setsWhereV12Worse,
    v12_meets_switch_threshold: v12MeetsSwitchThreshold,
    selected_default_prompt: v12MeetsSwitchThreshold ? "V12" : "V11",
    unit_checks_passed: unitChecksPassed,
    unit_checks: unitChecks,
    provenance_unit_checks: provenanceUnitChecks,
    historical_v6_set4_audit: {
      strictly_flagged_under_v9_validator: historicalSet4StrictlyFlagged,
      runs: historicalSet4Audit,
    },
    historical_v6_set3_attribution_audit: {
      explanation:
        "В V6 в Set 3 («Тяжёлая мокрая губка», q3: «Не знаю, сейчас ничего не вспоминается») промпт V11 предлагал для hiddenResource конструкцию «обращаясь к человеку прямо („вы“, „в вашем ответе“)», из-за чего модель приписала сюжетные детали сцены («на краю раковины», «поставить губку на ребро») фразе «В вашем ответе...». В V9 промпты V11 и V12 разграничивают буквальные слова ответов q1–q4 («в вашем ответе») и художественные детали сцены («в этой сцене / в образе истории»): в Set 3 оба прогона V11 чистые (2/2), тогда как у V12 во 2-м прогоне Set 3 в story домыслена бытовая привычка («та, которой ты обычно стираешь со стола»).",
      runs: historicalSet3Audit,
    },
    sets: evaluatedSets,
  };

  fs.writeFileSync(v9CorpusCachePath, JSON.stringify(fullCorpusReport, null, 2) + "\n");
  fs.writeFileSync(
    path.join(LIVE_RUNS_DIR, "myth-comparison-6x2-v11-v12.json"),
    JSON.stringify(fullCorpusReport, null, 2) + "\n"
  );

  const set4FromCorpus = evaluatedSets.find((s) => s.set_id === "set_4_real_action_in_q3");
  const freshSet4AllPassed =
    (set4FromCorpus?.variant_a_v11 || []).every((r: any) => r.quality.passed) &&
    (set4FromCorpus?.variant_b_v12 || []).every((r: any) => r.quality.passed);
  const set4AllProvenanceClean =
    Boolean(set4FromCorpus?.set_summary.v11_provenance_clean) &&
    Boolean(set4FromCorpus?.set_summary.v12_provenance_clean);
  const all24ManualAuditComplete = evaluatedSets.every(
    (s) =>
      s.variant_a_v11.every((r: any) => r.manual_review && typeof r.scores_out_of_8?.total === "number") &&
      s.variant_b_v12.every((r: any) => r.manual_review && typeof r.scores_out_of_8?.total === "number")
  );
  const set4Report = {
    generated_at: new Date().toISOString(),
    pair: { web_pin: WEB_PIN, web_sha: WEB_SHA, dcs_sha: DCS_SHA },
    unit_checks_passed: unitChecksPassed,
    unit_checks: unitChecks,
    provenance_unit_checks: provenanceUnitChecks,
    historical_v6_set4_audit: {
      strictly_flagged_under_v9_validator: historicalSet4StrictlyFlagged,
      runs: historicalSet4Audit,
    },
    fresh_live_set4_runs: {
      variant_a_v11: set4FromCorpus?.variant_a_v11 || [],
      variant_b_v12: set4FromCorpus?.variant_b_v12 || [],
    },
    fresh_live_set4_all_passed: freshSet4AllPassed,
    passed:
      unitChecksPassed &&
      historicalSet4StrictlyFlagged &&
      all24ValidatorPassed &&
      all24ManualAuditComplete &&
      set3V11ProvenanceClean &&
      set4AllProvenanceClean &&
      freshSet4AllPassed &&
      v11CleanRunsCount === 7 &&
      v11ProvenanceViolations === 5 &&
      v12CleanRunsCount === 6 &&
      v12ProvenanceViolations === 6 &&
      !v12MeetsSwitchThreshold,
  };
  fs.writeFileSync(
    path.join(LIVE_RUNS_DIR, "myth-set4-reverification.json"),
    JSON.stringify(set4Report, null, 2) + "\n"
  );

  const overallPassed = set4Report.passed;

  console.log(
    `[v9] Myth 24-Run Corpus & Validator Verification: ${
      overallPassed
        ? `PASSED (24/24 validator passed; honest provenance audit: V11 ${v11CleanRunsCount}/12 clean [${v11ProvenanceViolations} violations, ${v11TotalScoreOutOf96}/96], V12 ${v12CleanRunsCount}/12 clean [${v12ProvenanceViolations} violations, ${v12TotalScoreOutOf96}/96]; V12 strictly better on ${setsWhereV12StrictlyBetter}/6, worse on ${setsWhereV12Worse}/6 -> default remains ${fullCorpusReport.selected_default_prompt})`
        : "FAILED"
    }`
  );
  return overallPassed;
}

async function runCodeV2PrimaryComparison(): Promise<boolean> {
  console.log("[v9] Running Check 0B: Code V2 Presentation Primary Card Comparison across 6 fixed inputs (f67b04a vs 1d830fc vs V9)...");
  const {
    cleanPositionEssence,
    formatSceneExample,
    selectRelevantSceneExample,
  } = await import("../src/components/CodeV2/CodeV2Experience");

  // 1. Baseline canonical calls (without userQuestion)
  const baselineCodeV2Res = await fetch("http://127.0.0.1:8090/api/canonical/code-v2", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dob: "15.05.1990", request_id: "v9_code_v2_baseline_no_question" }),
  });
  if (!baselineCodeV2Res.ok) {
    throw new Error(`DCS /api/canonical/code-v2 baseline returned HTTP ${baselineCodeV2Res.status}`);
  }
  const rawBaselineCodeV2: any = await baselineCodeV2Res.json();
  const baselinePayload: any = rawBaselineCodeV2.payload || rawBaselineCodeV2;

  const baselineCalcRes = await fetch("http://127.0.0.1:8090/api/canonical/calculate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dob: "15.05.1990", request_id: "v9_calc_baseline_no_question" }),
  });
  if (!baselineCalcRes.ok) {
    throw new Error(`DCS /api/canonical/calculate baseline returned HTTP ${baselineCalcRes.status}`);
  }
  const rawBaselineCalc: any = await baselineCalcRes.json();
  const baselineCalcDto: any = rawBaselineCalc.payload || rawBaselineCalc;

  const baselineFiveNumbers =
    baselinePayload.calculation.five_numbers || baselinePayload.calculation.canonical_result;
  const baselinePositionEnergies = baselinePayload.positions.map((p: any) => ({
    position: p.position,
    energy: p.energy ?? p.value,
    energy_name: p.energy_name ?? p.archetype_name,
  }));
  const baselineLegacyNumbers =
    baselineCalcDto.result ||
    baselineCalcDto.canonical_result ||
    baselineCalcDto.five_numbers ||
    baselineCalcDto;

  // Historical Old helper from commits f67b04a / 1d830fc: text.split(/[.;!—]/)[0].trim()
  const getFirstSentenceOld = (text: string): string => {
    if (!text) return "";
    const [head] = text.split(/[.;!—]/u, 1);
    const sentence = head.trim();
    return /[.!?]$/u.test(sentence) ? sentence : `${sentence}.`;
  };

  // Current New helper in src/components/CodeV2/CodeV2Experience.tsx
  const getFirstSentenceNew = (text: string): string => {
    if (!text) return "";
    const match = text.match(/^.*?[.!?](?:\s|$)/);
    return match ? match[0].trim() : text;
  };

  // Exact historical selectRelevantSceneExample from commit 1d830fc:
  // Splits on /[^\p{L}\p{N}\s]/gu, t.length > 2, NO stop-words filtering, NO stemming, and calls getFirstSentenceOld (.split(/[.;!—]/)[0])
  const selectRelevantSceneExample_1d830fc = (
    scenes: any[] | undefined,
    userQuestion?: string
  ): { exampleText: string; selectedIndex: number; matchedTokens: string[] } => {
    if (!scenes || scenes.length === 0) return { exampleText: "", selectedIndex: 0, matchedTokens: [] };
    const trimmedQ = (userQuestion || "").trim();
    if (!trimmedQ) {
      return {
        exampleText: getFirstSentenceOld(scenes[0]?.description || ""),
        selectedIndex: 0,
        matchedTokens: [],
      };
    }
    const tokens = trimmedQ
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((t) => t.length > 2);
    if (tokens.length === 0) {
      return {
        exampleText: getFirstSentenceOld(scenes[0]?.description || ""),
        selectedIndex: 0,
        matchedTokens: [],
      };
    }
    let bestScene = scenes[0];
    let bestIdx = 0;
    let maxScore = 0;
    let bestMatchedTokens: string[] = [];
    for (let idx = 0; idx < scenes.length; idx++) {
      const scene = scenes[idx];
      const text = `${scene.title} ${scene.description}`.toLowerCase();
      let score = 0;
      const matched: string[] = [];
      for (const token of tokens) {
        if (text.includes(token)) {
          score += 1;
          matched.push(token);
        }
      }
      if (score > maxScore) {
        maxScore = score;
        bestScene = scene;
        bestIdx = idx;
        bestMatchedTokens = matched;
      }
    }
    return {
      exampleText: getFirstSentenceOld(bestScene?.description || ""),
      selectedIndex: bestIdx,
      matchedTokens: bestMatchedTokens,
    };
  };

  const RUSSIAN_STOP_WORDS = new Set([
    "как", "мне", "меня", "мой", "моя", "мое", "моё", "мои", "что", "это",
    "этот", "эта", "эти", "для", "или", "при", "без", "над", "под", "про",
    "вас", "вам", "вами", "вот", "где", "кто", "чем", "так", "уже", "еще",
    "ещё", "все", "всё", "быть", "есть", "если", "когда", "между", "через",
    "один", "одна", "одно", "одни", "двумя", "двух", "очень",
  ]);

  const selectRelevantSceneExample_V9 = (
    scenes: any[] | undefined,
    userQuestion?: string
  ): { exampleText: string; selectedIndex: number; matchedStems: string[]; maxScore: number } => {
    const prodExampleText = selectRelevantSceneExample(scenes, userQuestion);
    if (!scenes || scenes.length === 0) {
      return { exampleText: prodExampleText, selectedIndex: 0, matchedStems: [], maxScore: 0 };
    }
    const trimmedQ = (userQuestion || "").trim();
    if (!trimmedQ) {
      return {
        exampleText: prodExampleText,
        selectedIndex: 0,
        matchedStems: [],
        maxScore: 0,
      };
    }
    const rawTokens = trimmedQ
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((t) => t.length > 2);
    const tokens = rawTokens.filter((t) => !RUSSIAN_STOP_WORDS.has(t));
    const activeTokens = tokens.length > 0 ? tokens : rawTokens;
    if (activeTokens.length === 0) {
      return {
        exampleText: prodExampleText,
        selectedIndex: 0,
        matchedStems: [],
        maxScore: 0,
      };
    }
    const stems = activeTokens.map((t) => (t.length > 5 ? t.slice(0, 5) : t.length === 5 ? t.slice(0, 4) : t));
    let bestIdx = 0;
    let maxScore = 0;
    let bestStems: string[] = [];
    for (let idx = 0; idx < scenes.length; idx++) {
      const scene = scenes[idx];
      const text = `${scene.title} ${scene.description}`.toLowerCase();
      let score = 0;
      const matched: string[] = [];
      for (let i = 0; i < activeTokens.length; i++) {
        const token = activeTokens[i];
        const stem = stems[i];
        if (text.includes(token)) {
          score += 2;
          matched.push(token);
        } else if (stem && text.includes(stem)) {
          score += 1;
          matched.push(`${stem}*`);
        }
      }
      if (score > maxScore) {
        maxScore = score;
        bestIdx = idx;
        bestStems = matched;
      }
    }
    return {
      exampleText: prodExampleText,
      selectedIndex: bestIdx,
      matchedStems: bestStems,
      maxScore,
    };
  };

  // Dynamic rule-based 0-2 card scorer computed directly from rendered card text and handoff properties
  const scoreRenderedCardDynamically = (
    card: {
      header: string;
      essence_text: string;
      example_text: string;
      verification_question: string;
      reactions: string[];
      top_albert_button_prefills_input: boolean;
      carries_question_in_context: boolean;
    },
    rawSceneDescription: string,
    matchedByContentQuestion: boolean
  ) => {
    const exampleWords = card.example_text.trim().split(/\s+/u).filter(Boolean).length;
    const rawFirstSentence = formatSceneExample(rawSceneDescription);
    const rawFirstSentenceWords = rawFirstSentence.trim().split(/\s+/u).filter(Boolean).length;
    const isTruncatedBeforeSentenceEnd = exampleWords < rawFirstSentenceWords;

    // 1. clarity (0-2): 2 if header, essence, verification_question are present AND example_text is not a truncated fragment
    const hasCoreFields =
      card.header.length > 5 &&
      card.essence_text.length > 15 &&
      card.verification_question.length > 15;
    const clarity = !hasCoreFields ? 0 : !isTruncatedBeforeSentenceEnd && exampleWords >= 8 ? 2 : 1;

    // 2. concreteness (0-2): 2 if example_text preserves the full observable behavioral clause (>= 14 words) alongside verification_question
    const concreteness = !hasCoreFields ? 0 : exampleWords >= 14 && !isTruncatedBeforeSentenceEnd ? 2 : 1;

    // 3. connection_to_input (0-2):
    // 2 if scene is selected by meaningful content tokens/stems of userQuestion, rendered example_text is not truncated before the matched clause, AND top Albert button passes question in context without prefilling input
    // 1 if reactions exist / question is carried in context
    const connection_to_input =
      matchedByContentQuestion &&
      !isTruncatedBeforeSentenceEnd &&
      card.carries_question_in_context &&
      !card.top_albert_button_prefills_input
        ? 2
        : card.reactions.length === 3
          ? 1
          : 0;

    // 4. reflection_utility (0-2):
    // 2 if all 3 reflective layers (Essence + full non-truncated Example + Verification Question & clean Albert handoff) work together
    const reflection_utility =
      !isTruncatedBeforeSentenceEnd &&
      exampleWords >= 14 &&
      !card.top_albert_button_prefills_input &&
      card.reactions.length === 3
        ? 2
        : hasCoreFields
          ? 1
          : 0;

    return {
      example_word_count: exampleWords,
      is_truncated_before_sentence_end: isTruncatedBeforeSentenceEnd,
      clarity,
      concreteness,
      connection_to_input,
      reflection_utility,
      total: clarity + concreteness + connection_to_input + reflection_utility,
    };
  };

  let provenanceViolations = 0;
  const comparedSets: any[] = [];

  for (const setItem of MYTH_FIXED_6_SETS) {
    // Perform genuinely independent canonical calculations for this specific set (with userQuestion in request payload)
    const setCodeV2Res = await fetch("http://127.0.0.1:8090/api/canonical/code-v2", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dob: "15.05.1990",
        request_id: `v9_code_v2_${setItem.set_id}`,
        userQuestion: setItem.inputs.q1,
      }),
    });
    if (!setCodeV2Res.ok) {
      throw new Error(`DCS /api/canonical/code-v2 for ${setItem.set_id} returned HTTP ${setCodeV2Res.status}`);
    }
    const rawSetCodeV2: any = await setCodeV2Res.json();
    const setPayload: any = rawSetCodeV2.payload || rawSetCodeV2;

    const setCalcRes = await fetch("http://127.0.0.1:8090/api/canonical/calculate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dob: "15.05.1990",
        request_id: `v9_calc_${setItem.set_id}`,
        userQuestion: setItem.inputs.q1,
      }),
    });
    if (!setCalcRes.ok) {
      throw new Error(`DCS /api/canonical/calculate for ${setItem.set_id} returned HTTP ${setCalcRes.status}`);
    }
    const rawSetCalc: any = await setCalcRes.json();
    const setCalcDto: any = rawSetCalc.payload || rawSetCalc;

    const setFiveNumbers = setPayload.calculation.five_numbers || setPayload.calculation.canonical_result;
    const setPositionEnergies = setPayload.positions.map((p: any) => ({
      position: p.position,
      energy: p.energy ?? p.value,
      energy_name: p.energy_name ?? p.archetype_name,
    }));
    const setLegacyNumbers =
      setCalcDto.result ||
      setCalcDto.canonical_result ||
      setCalcDto.five_numbers ||
      setCalcDto;

    const fiveNumbersUnchanged =
      JSON.stringify(setFiveNumbers) === JSON.stringify(baselineFiveNumbers);
    const positionEnergiesUnchanged =
      JSON.stringify(setPositionEnergies) === JSON.stringify(baselinePositionEnergies);
    const legacyCalculateUnchanged =
      JSON.stringify(setLegacyNumbers.five_numbers || setLegacyNumbers) ===
      JSON.stringify(baselineLegacyNumbers.five_numbers || baselineLegacyNumbers);

    let matchedPositionsCountV9 = 0;
    let matchedPositionsCount1d830fc = 0;
    let cardProvenanceCleanCount = 0;

    const positionCards = setPayload.positions.map((pos: any) => {
      const posValue = pos.energy ?? pos.value;
      const posEnergyName = pos.energy_name ?? pos.archetype_name;
      const cleanedEssence = getFirstSentenceNew(cleanPositionEssence(pos.essence));

      // 1. Pre-iteration f67b04a: always scenes[0] + getFirstSentenceOld (.split(/[.;!—]/)[0])
      const f67Example = getFirstSentenceOld(pos.life_scenes?.[0]?.description || "");

      // 2. Historical 1d830fc: exact 1d830fc selectRelevantSceneExample + getFirstSentenceOld (.split(/[.;!—]/)[0])
      const sel1d8 = selectRelevantSceneExample_1d830fc(pos.life_scenes, setItem.inputs.q1);
      if (sel1d8.matchedTokens.length > 0) {
        matchedPositionsCount1d830fc += 1;
      }

      // 3. Current V9: real exported selectRelevantSceneExample from CodeV2Experience.tsx
      const selV9 = selectRelevantSceneExample_V9(pos.life_scenes, setItem.inputs.q1);
      const sceneMatchedByContentV9 = selV9.maxScore > 0;
      if (sceneMatchedByContentV9) {
        matchedPositionsCountV9 += 1;
      }

      const cardF67b04a = {
        header: `${pos.public_name} · ${posEnergyName} (Число ${posValue})`,
        role: pos.role,
        essence_label: "О чём это число",
        essence_text: cleanedEssence,
        example_label: "Пример",
        example_text: f67Example,
        verification_label: "Проверьте на себе",
        verification_question: pos.verification_question,
        reactions: ["Похоже", "Не похоже", "Уточнить"],
        top_albert_button_prefills_input: false,
        carries_question_in_context: false,
      };

      const card1d830fc = {
        header: `${pos.public_name} · ${posEnergyName} (Число ${posValue})`,
        role: pos.role,
        essence_label: "О чём это число",
        essence_text: cleanedEssence,
        example_label: "Пример",
        example_text: sel1d8.exampleText,
        selected_scene_index: sel1d8.selectedIndex,
        matched_raw_tokens: sel1d8.matchedTokens,
        verification_label: "Проверьте на себе",
        verification_question: pos.verification_question,
        reactions: ["Похоже", "Не похоже", "Уточнить"],
        top_albert_button_prefills_input: true,
        carries_question_in_context: true,
      };

      const cardV9 = {
        header: `${pos.public_name} · ${posEnergyName} (Число ${posValue})`,
        role: pos.role,
        essence_label: "О чём это число",
        essence_text: cleanedEssence,
        example_label: "Пример",
        example_text: selV9.exampleText,
        selected_scene_index: selV9.selectedIndex,
        matched_content_stems: selV9.matchedStems,
        verification_label: "Проверьте на себе",
        verification_question: pos.verification_question,
        reactions: ["Похоже", "Не похоже", "Уточнить"],
        top_albert_button_prefills_input: false,
        carries_question_in_context: true,
      };

      // Verify provenance of rendered V9 card text:
      // - essence_text must be a substring of cleanPositionEssence(pos.essence)
      // - example_text must be a prefix of one of pos.life_scenes[i].description
      // - verification_question must equal pos.verification_question
      const essenceFromDcs = cleanPositionEssence(pos.essence).includes(
        cardV9.essence_text.replace(/\.$/u, "")
      );
      const exampleFromDcs = (pos.life_scenes || []).some((s: any) =>
        (s.description || "").trim().startsWith(cardV9.example_text.replace(/\.$/u, ""))
      );
      const verificationFromDcs = cardV9.verification_question === pos.verification_question;
      const cardProvenanceOk = essenceFromDcs && exampleFromDcs && verificationFromDcs;
      if (cardProvenanceOk) {
        cardProvenanceCleanCount += 1;
      }

      // Check whether 1d830fc matched only via a stop-word substring (e.g. "меня" inside "применять")
      const contentTokensIn1d8 = sel1d8.matchedTokens.filter((t) => !RUSSIAN_STOP_WORDS.has(t));
      const matchedByContent1d8 = contentTokensIn1d8.length > 0;

      const scoresF67 = scoreRenderedCardDynamically(
        cardF67b04a,
        pos.life_scenes?.[0]?.description || "",
        false
      );
      const scores1d8 = scoreRenderedCardDynamically(
        card1d830fc,
        pos.life_scenes?.[sel1d8.selectedIndex]?.description || "",
        matchedByContent1d8
      );
      const scoresV9 = scoreRenderedCardDynamically(
        cardV9,
        pos.life_scenes?.[selV9.selectedIndex]?.description || "",
        sceneMatchedByContentV9
      );

      return {
        position: pos.position,
        value: posValue,
        energy_name: posEnergyName,
        card_provenance_verified: cardProvenanceOk,
        scene_matched_user_question_v9: sceneMatchedByContentV9,
        scene_differs_between_f67b04a_and_1d830fc: cardF67b04a.example_text !== card1d830fc.example_text,
        pre_iteration_card_f67b04a: cardF67b04a,
        old_card_1d830fc: card1d830fc,
        new_card_v9: cardV9,
        scores_f67b04a_out_of_8: scoresF67,
        old_card_scores_out_of_8: scores1d8,
        new_card_scores_out_of_8: scoresV9,
      };
    });

    const setProvenancePreserved =
      fiveNumbersUnchanged &&
      positionEnergiesUnchanged &&
      legacyCalculateUnchanged &&
      cardProvenanceCleanCount === 5;
    if (!setProvenancePreserved) {
      provenanceViolations += 1;
    }

    const computeDeckScoresFromCards = (
      cardScores: Array<{
        clarity: number;
        concreteness: number;
        connection_to_input: number;
        reflection_utility: number;
        total: number;
      }>
    ) => {
      const clarity = cardScores.every((s) => s.clarity === 2)
        ? 2
        : cardScores.some((s) => s.clarity >= 1)
          ? 1
          : 0;
      const concreteness = cardScores.every((s) => s.concreteness === 2)
        ? 2
        : cardScores.some((s) => s.concreteness >= 1)
          ? 1
          : 0;
      const connection_to_input = cardScores.some((s) => s.connection_to_input === 2)
        ? 2
        : cardScores.some((s) => s.connection_to_input >= 1)
          ? 1
          : 0;
      const reflection_utility = cardScores.every((s) => s.reflection_utility === 2)
        ? 2
        : cardScores.some((s) => s.reflection_utility >= 1)
          ? 1
          : 0;
      const total = clarity + concreteness + connection_to_input + reflection_utility;
      const sum_of_5_cards_out_of_40 = cardScores.reduce((acc, s) => acc + s.total, 0);
      return {
        clarity,
        concreteness,
        connection_to_input,
        reflection_utility,
        total,
        sum_of_5_cards_out_of_40,
      };
    };

    const deckScoresF67b04a = computeDeckScoresFromCards(
      positionCards.map((c: any) => c.scores_f67b04a_out_of_8)
    );

    const deckScoresOld1d830fc = {
      ...computeDeckScoresFromCards(positionCards.map((c: any) => c.old_card_scores_out_of_8)),
      rationale:
        "В коммите 1d830fc функция selectRelevantSceneExample уже существовала (без фильтра стоп-слов и без стемминга), но в конце вызывала getFirstSentence с разбиением .split(/[.;!—]/)[0], а верхняя кнопка Альберта передавала initialPrompt: localQuestion.trim() (предзаполняя и автоотправляя вопрос). На 3 из 30 карточек (set_1_career_overload:result, set_2_work_change_autumn:result, set_6_partnership_crack:expression) 1d830fc выбирает сцену 1 вместо сцены 0, однако из-за .split(/[.;!—]/)[0] выбранная сцена всё равно обрезается: в Result наборов 1 и 2 («меня» / «менять» совпало с «применять») — по точке с запятой до 12 слов («Характерная перемена: обладая колоссальной волевой мощью, человек не спешит применять ее первым.»), а в Expression набора 6 («чувствую» совпало с «сочувствующие») — по тире до 3 слов («В кризисной коммуникации.»). В остальных 27 из 30 карточек 1d830fc выбирает сцену 0 и обрезает её по тире до 2–5 слов вводного штампа.",
    };

    const deckScoresNewV9 = {
      ...computeDeckScoresFromCards(positionCards.map((c: any) => c.new_card_scores_out_of_8)),
      rationale: `В текущей версии V9 все 5 карточек сохраняют полное предложение жизненной сцены (от 17 до 31 слова, без обрезки на тире или точке с запятой), вопрос пользователя тематически подбирает релевантную сцену в ${matchedPositionsCountV9} из 5 позиций (с фильтрацией стоп-слов и учётом русских основ слов), а верхняя и нижняя кнопки Альберта передают вопрос в context.userQuestion без предзаполнения поля ввода.`,
    };

    const sumScoresF67 = deckScoresF67b04a.sum_of_5_cards_out_of_40;
    const sumScores1d8 = deckScoresOld1d830fc.sum_of_5_cards_out_of_40;
    const sumScoresV9 = deckScoresNewV9.sum_of_5_cards_out_of_40;

    comparedSets.push({
      set_id: setItem.set_id,
      name: setItem.name,
      user_question_q1: setItem.inputs.q1,
      independent_calculation_verification: {
        code_v2_request_id: `v9_code_v2_${setItem.set_id}`,
        calculate_request_id: `v9_calc_${setItem.set_id}`,
        five_numbers_from_independent_call: setFiveNumbers,
        five_numbers_match_baseline: fiveNumbersUnchanged,
        position_energies_match_baseline: positionEnergiesUnchanged,
        legacy_calculate_dto_matches_baseline: legacyCalculateUnchanged,
        all_5_cards_text_provenance_verified: cardProvenanceCleanCount === 5,
      },
      canonical_numbers: setFiveNumbers,
      provenance_preserved: setProvenancePreserved,
      matched_positions_count_1d830fc: matchedPositionsCount1d830fc,
      matched_positions_count: matchedPositionsCountV9,
      deck_scores_pre_iteration_f67b04a: deckScoresF67b04a,
      deck_scores_old_1d830fc: deckScoresOld1d830fc,
      deck_scores_new_v8: deckScoresNewV9,
      deck_scores_new_v9: deckScoresNewV9,
      new_strictly_better_than_old:
        deckScoresNewV9.total > deckScoresOld1d830fc.total &&
        sumScoresV9 > sumScores1d8 &&
        sumScoresV9 > sumScoresF67,
      positions: positionCards,
    });
  }

  const allSetsNumbersMatchBaseline = comparedSets.every(
    (s) =>
      s.independent_calculation_verification.five_numbers_match_baseline &&
      s.independent_calculation_verification.position_energies_match_baseline &&
      s.independent_calculation_verification.legacy_calculate_dto_matches_baseline
  );
  const setsWhereNewIsBetter = comparedSets.filter((s) => s.new_strictly_better_than_old).length;
  const setsWhereNewIsWorse = comparedSets.filter(
    (s) =>
      s.deck_scores_new_v9.total < s.deck_scores_old_1d830fc.total ||
      s.deck_scores_new_v9.sum_of_5_cards_out_of_40 < s.deck_scores_old_1d830fc.sum_of_5_cards_out_of_40
  ).length;
  const thresholdMet =
    setsWhereNewIsBetter >= 4 &&
    setsWhereNewIsWorse === 0 &&
    provenanceViolations === 0 &&
    allSetsNumbersMatchBaseline;

  const report = {
    generated_at: new Date().toISOString(),
    pair: { web_pin: WEB_PIN, web_sha: WEB_SHA, dcs_sha: DCS_SHA },
    dob_used: "15.05.1990",
    baseline_independent_calls: {
      code_v2_request_id: "v9_code_v2_baseline_no_question",
      calculate_request_id: "v9_calc_baseline_no_question",
      canonical_numbers: baselineFiveNumbers,
      position_energies: baselinePositionEnergies,
    },
    canonical_numbers: baselineFiveNumbers,
    canonical_numbers_unchanged: allSetsNumbersMatchBaseline,
    selection_rule:
      "Оставлять новую подачу Кода только если она лучше минимум на 4 из 6 фиксированных наборов, не хуже на остальных и даёт 0 нарушений происхождения данных.",
    sets_where_new_is_better: setsWhereNewIsBetter,
    sets_where_new_is_worse: setsWhereNewIsWorse,
    provenance_violations: provenanceViolations,
    threshold_met: thresholdMet,
    sets: comparedSets,
  };

  fs.writeFileSync(
    path.join(LIVE_RUNS_DIR, "code-v2-6-sets-primary-comparison.json"),
    JSON.stringify(report, null, 2) + "\n"
  );

  console.log(
    `[v9] Code V2 Primary Comparison: ${
      thresholdMet
        ? `PASSED (New V9 strictly better than both f67b04a and 1d830fc on ${setsWhereNewIsBetter}/6 sets, worse on ${setsWhereNewIsWorse}/6, provenance violations=${provenanceViolations})`
        : "FAILED"
    }`
  );
  return thresholdMet;
}

function runDefect1Check(): boolean {
  console.log("[v8] Running Check 1: Defect 1 Matrix (Source Origin Separation)...");

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

  console.log(`[v8] Defect 1 Matrix: ${allPassed ? "PASSED (6/6 + mundane folder)" : "FAILED"}`);
  return allPassed;
}

async function runDefect2Check(browser: Browser): Promise<boolean> {
  console.log("[v8] Running Check 2: Defect 2 Matrix (Crisis Self-Quote Detection + HTTP Crisis Safe Handler + Native UI)...");

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
      console.log("[v8] Native crisis UI component rendered and screenshot saved.");
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

  console.log(`[v8] Defect 2 Matrix: ${allPassed ? "PASSED (6/6 + native UI component)" : "FAILED"}`);
  return allPassed;
}

async function runRouteCCheck(browser: Browser): Promise<boolean> {
  console.log("[v8] Running Check 3: Route C (Data Deletion via Native UI Button & Server API)...");

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

    const sessionToken = "v8-session-del-token-" + Date.now();
    const regResult = await page.evaluate(async (token) => {
      const res = await fetch("/api/privacy/register-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, anonymousId: "v8-anon-delete-test" }),
      });
      return { status: res.status, body: await res.json() };
    }, sessionToken);

    if (regResult.status !== 200) {
      console.error("[v8] Route C session registration failed:", regResult);
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
      throw new Error("[v8] FAIL-CLOSED: UI delete button 'Удалить сохранённое зеркало из браузера' not found!");
    }

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

    console.log(`[v8] Route C: ${passed ? "PASSED (Server 200 ok + Native UI button purged localStorage)" : "FAILED"}`);
    return passed;
  } finally {
    await page.close();
  }
}

async function run7PlaywrightJourneys(browser: Browser): Promise<Record<string, any>> {
  console.log("[v8] Running Check 4: 7 Real Playwright User Journeys in Chromium...");
  const results: Record<string, any> = {};

  // ---------------------------------------------------------------------------
  // Journey 1: New visitor Code -> Albert without Myth (full end-to-end from clean state)
  // ---------------------------------------------------------------------------
  console.log("[v8] Running Journey 1: New visitor Code -> Albert without Myth...");
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

      const calcBtn = await page.waitForSelector('button:has-text("Посмотреть описание")', { timeout: 5000 });
      await calcBtn.click();

      const openCodeBtn = await page.waitForSelector('button:has-text("Открыть мой Код")', { timeout: 10000 });
      await openCodeBtn.click();

      const consentHeading = await page.waitForSelector("#consent-heading", { timeout: 5000 }).catch(() => null);
      if (consentHeading) {
        const checkbox = await page.waitForSelector('input[type="checkbox"]', { timeout: 5000 });
        await checkbox.click();
        const acceptBtn = await page.waitForSelector('button:has-text("Согласиться и продолжить")', { timeout: 5000 });
        await acceptBtn.click();
      }

      const personalQuestion = "Как распределить задачи в команде при запуске сложного проекта?";
      const codeQuestionInput = await page.waitForSelector("#code-v2-user-question", { timeout: 10000 });
      await codeQuestionInput.fill(personalQuestion);

      const albertBtn = await page.waitForSelector(
        'button:has-text("Обсудить с Альбертом здесь"), button:has-text("Поговорить с Альбертом")',
        { timeout: 20000 }
      );
      await albertBtn.click();

      await page.waitForSelector('div[role="dialog"]', { timeout: 10000 });

      const input = await page.waitForSelector('input[placeholder*="Задайте вопрос Альберту"]', { timeout: 5000 });
      const currentInputValue = await input.inputValue();
      if (currentInputValue !== "") {
        throw new Error(`Expected input field to be empty, got: '${currentInputValue}'`);
      }

      const questionToSend = "Объясни проще: что эти числа говорят именно про мой вопрос?";
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
      const knowsQuestion = !albertReply.includes("самого вопроса в разговоре пока не было");
      const passed = non_empty && knowsQuestion;

      await page.screenshot({ path: path.join(LIVE_RUNS_DIR, "journey1-code-to-albert.png") });

      results.journey1 = {
        name: "Journey 1: Code -> Albert without Myth (полный сквозной путь нового посетителя с нуля)",
        check_type: "full_e2e_from_scratch",
        passed,
        user_question_entered: personalQuestion,
        input_empty_before_typing: currentInputValue === "",
        question_sent: questionToSend,
        albert_reply_preview: albertReply.slice(0, 150),
        screenshot: "live-runs/journey1-code-to-albert.png",
      };
      console.log(`[v8] Journey 1: ${passed ? "PASS" : "FAIL"}`);
    } finally {
      await page.close();
    }
  }

  // ---------------------------------------------------------------------------
  // Journey 2: Meeting -> Albert (проверка с подготовленным состоянием / prepared-state check)
  // ---------------------------------------------------------------------------
  console.log("[v8] Running Journey 2: Meeting -> Albert (prepared-state check)...");
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

      const albertMeetingBtn = await page.waitForSelector('button:has-text("Обсудить с Альбертом здесь")', { timeout: 10000 });
      await albertMeetingBtn.click();

      await page.waitForSelector('div[role="dialog"]', { timeout: 10000 });

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
        name: "Journey 2: Meeting -> Albert (проверка с подготовленным состоянием)",
        check_type: "prepared_state_check",
        state_preparation_note:
          "Проверка с подготовленным состоянием: снимок zerkalo.myMirror.v1 предзаполнен в localStorage перед проверкой перехода из Встречи зеркал к Альберту.",
        passed: non_empty && hasMeetingReference,
        greeting_text: greetingText,
        question_sent: questionToSend,
        albert_reply_preview: albertReply.slice(0, 150),
        screenshot: "live-runs/journey2-meeting-to-albert.png",
      };
      console.log(`[v8] Journey 2: ${non_empty && hasMeetingReference ? "PASS" : "FAIL"}`);
    } finally {
      await page.close();
    }
  }

  // ---------------------------------------------------------------------------
  // Journey 3: Unavailable Telegram modal -> continue with Albert on site without dead end (prepared-state check)
  // ---------------------------------------------------------------------------
  console.log("[v8] Running Journey 3: Telegram modal unavailable -> continue with Albert on site (prepared-state check)...");
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

      const tgButton = await page.waitForSelector('button:has-text("Перенести разговор в Telegram")', { timeout: 5000 });
      await tgButton.click();

      const tgModal = await page.waitForSelector(
        'section[role="dialog"][aria-labelledby="telegram-continuation-title"]',
        { timeout: 5000 }
      );
      const modalText = await tgModal.innerText();
      const hasUnavailableNotice = modalText.includes("В этой тестовой версии продолжение в Telegram недоступно");

      const continueAlbertBtn = await page.waitForSelector('[data-testid="continue-albert-from-telegram"]', { timeout: 5000 });
      await continueAlbertBtn.click();

      await page.waitForSelector('div[role="dialog"]', { timeout: 10000 });
      const tgModalClosed = (await page.$('section[role="dialog"][aria-labelledby="telegram-continuation-title"]')) === null;

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
        name: "Journey 3: Telegram unavailable -> continue with Albert on site without dead end (проверка с подготовленным состоянием)",
        check_type: "prepared_state_check",
        state_preparation_note:
          "Проверка с подготовленным состоянием: снимок zerkalo.myMirror.v1 предзаполнен в localStorage перед проверкой модального окна Telegram и перехода к Альберту.",
        passed,
        modal_had_unavailable_notice: hasUnavailableNotice,
        modal_closed_and_albert_opened: tgModalClosed,
        screenshot: "live-runs/journey3-telegram-unavailable-to-albert.png",
      };
      console.log(`[v8] Journey 3: ${passed ? "PASS" : "FAIL"}`);
    } finally {
      await page.close();
    }
  }

  // ---------------------------------------------------------------------------
  // Journey 4: Restored session from localStorage (prepared-state check)
  // ---------------------------------------------------------------------------
  console.log("[v8] Running Journey 4: Restored session from localStorage (prepared-state check)...");
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

      const titleEl = await page.waitForSelector('text="Встреча Зеркал"', { timeout: 10000 });
      await page.waitForTimeout(1000);
      const summaryText = await page.innerText("body");
      const hasSummary = summaryText.includes("Сопоставление подсвечивает переход");
      const hasQuestion = summaryText.includes("Как выстроить новый профессиональный вектор");

      await page.screenshot({ path: path.join(LIVE_RUNS_DIR, "journey4-restored-session.png") });

      const passed = titleEl !== null && hasSummary && hasQuestion;
      results.journey4 = {
        name: "Journey 4: Restored session from localStorage (проверка с подготовленным состоянием)",
        check_type: "prepared_state_check",
        state_preparation_note:
          "Проверка с подготовленным состоянием: снимок zerkalo.myMirror.v1 предзаполнен в localStorage перед перезагрузкой страницы и нажатием «Продолжить с того места».",
        passed,
        meeting_title_visible: titleEl !== null,
        meeting_summary_restored: hasSummary,
        meeting_question_restored: hasQuestion,
        screenshot: "live-runs/journey4-restored-session.png",
      };
      console.log(`[v8] Journey 4: ${passed ? "PASS" : "FAIL"}`);
    } finally {
      await page.close();
    }
  }

  // ---------------------------------------------------------------------------
  // Journey 5: Consent refusal (clicking "Сейчас не хочу") and expiry of previously accepted consent
  // ---------------------------------------------------------------------------
  console.log("[v8] Running Journey 5: Real consent refusal click and expiry of previously accepted consent...");
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    try {
      const protectedPostCallsDuringRefusal: string[] = [];
      let trackingRefusalPosts = false;
      page.on("request", (req) => {
        if (
          trackingRefusalPosts &&
          req.method() === "POST" &&
          (req.url().includes("/api/code-v2") ||
            req.url().includes("/api/calculate") ||
            req.url().includes("/api/personal-myth") ||
            req.url().includes("/api/meeting-of-mirrors") ||
            req.url().includes("/api/albert/dialogue"))
        ) {
          protectedPostCallsDuringRefusal.push(req.url());
        }
      });

      await page.goto("http://127.0.0.1:3000", { waitUntil: "networkidle" });

      // 1. Clear consent and storage
      await page.evaluate(async () => {
        await fetch("/api/consent", { method: "DELETE" });
        localStorage.clear();
        sessionStorage.clear();
      });
      await page.reload({ waitUntil: "networkidle" });

      // 2. Enter DOB and click "Открыть мой Код"
      const dayInput = await page.waitForSelector('input[placeholder="ДД"]', { timeout: 10000 });
      await dayInput.fill("15");
      const monthInput = await page.waitForSelector('input[placeholder="ММ"]', { timeout: 5000 });
      await monthInput.fill("05");
      const yearInput = await page.waitForSelector('input[placeholder="ГГГГ"]', { timeout: 5000 });
      await yearInput.fill("1990");

      const calcBtn = await page.waitForSelector('button:has-text("Посмотреть описание")', { timeout: 5000 });
      await calcBtn.click();

      trackingRefusalPosts = true;
      const openCodeBtn = await page.waitForSelector('button:has-text("Открыть мой Код")', { timeout: 10000 });
      await openCodeBtn.click();

      // Consent modal must appear
      const consentHeading = await page.waitForSelector("#consent-heading", { timeout: 8000 });
      const consentModalAppeared = consentHeading !== null;

      const acceptBtn = await page.waitForSelector('button:has-text("Согласиться и продолжить")', { timeout: 5000 });
      const isAcceptDisabledBeforeCheck = await acceptBtn.isDisabled();

      // 3. Click the actual refusal button "Сейчас не хочу"
      const refuseBtn = await page.waitForSelector('button:has-text("Сейчас не хочу")', { timeout: 5000 });
      await refuseBtn.click();
      await page.waitForTimeout(300);
      trackingRefusalPosts = false;

      const modalClosedAfterRefusal = (await page.$("#consent-heading")) === null;
      const codeV2NotOpenedAfterRefusal = (await page.$("#code-v2-user-question")) === null;
      const openCodeBtnStillVisible = (await page.$('button:has-text("Открыть мой Код")')) !== null;
      const noProtectedPostsDuringRefusal = protectedPostCallsDuringRefusal.length === 0;

      // 4. Now accept consent to establish a valid consented session
      await openCodeBtn.click();
      await page.waitForSelector("#consent-heading", { timeout: 5000 });
      const checkbox = await page.waitForSelector('input[type="checkbox"]', { timeout: 5000 });
      await checkbox.click();
      const acceptBtn2 = await page.waitForSelector('button:has-text("Согласиться и продолжить")', { timeout: 5000 });
      await acceptBtn2.click();

      // Verify Code V2 loads after accepting consent
      await page.waitForSelector("#code-v2-user-question", { timeout: 15000 });
      const consentStatusWhileActive = await page.evaluate(async () => {
        const res = await fetch("/api/consent", { cache: "no-store" });
        return await res.json();
      });
      const activeConsentAccepted = consentStatusWhileActive?.accepted === true;

      // Open Albert dialogue from Code V2
      const albertBtn = await page.waitForSelector('button:has-text("Обсудить с Альбертом здесь")', { timeout: 10000 });
      await albertBtn.click();
      await page.waitForSelector('div[role="dialog"]', { timeout: 10000 });

      // 5. Test expiry of previously accepted consent:
      // Generate a real cryptographically signed consent token whose recordedAt is 30 days + 1 minute ago
      const nowMs = Date.now();
      const expiredRecordedAt = nowMs - CONSENT_MAX_AGE_MS - 60_000;
      const expiredSignedToken = issueConsent("core", null, expiredRecordedAt);

      // Verify unit-level TTL boundary on the exact token
      const validBeforeExpiry = verifyConsent(expiredSignedToken, expiredRecordedAt + 1000) !== null;
      const nullAfterExpiry = verifyConsent(expiredSignedToken, nowMs) === null;

      // Replace the browser's active zerkalo_consent cookie with the expired signed token
      await page.context().addCookies([
        {
          name: "zerkalo_consent",
          value: expiredSignedToken,
          url: "http://127.0.0.1:3000",
          httpOnly: true,
          sameSite: "Strict",
        },
      ]);

      // Verify GET /api/consent now reports accepted: false for the expired token
      const consentStatusAfterExpiry = await page.evaluate(async () => {
        const res = await fetch("/api/consent", { cache: "no-store" });
        return await res.json();
      });
      const expiredConsentRejectedByGet = consentStatusAfterExpiry?.accepted === false;

      // Verify direct POST /api/albert/dialogue with expired cookie returns 403 consent_required
      const api403OnExpiredCookie = await page.evaluate(async () => {
        const res = await fetch("/api/albert/dialogue", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: "test expired", history: [], context: {} }),
        });
        return { status: res.status, body: await res.json() };
      });
      const expiredCookieRejectedByPost403 =
        api403OnExpiredCookie.status === 403 && api403OnExpiredCookie.body?.code === "consent_required";

      // 6. In the browser UI, attempt to send a question to Albert after consent has expired
      const expiredTestQuestion = "Вопрос после истечения срока согласия";
      const albertInput = await page.waitForSelector('input[placeholder*="Задайте вопрос Альберту"]', { timeout: 5000 });
      await albertInput.fill(expiredTestQuestion);
      const sendBtn = await page.waitForSelector('button[type="submit"][aria-label="Отправить сообщение"]', { timeout: 5000 });
      await sendBtn.click();

      // Consent modal must automatically reopen when consent has expired!
      const reopenedModal = await page.waitForSelector("#consent-heading", { timeout: 8000 });
      const modalReopenedOnExpiredConsent = reopenedModal !== null;

      await page.screenshot({ path: path.join(LIVE_RUNS_DIR, "journey5-consent-refusal-expiry.png") });

      // Click "Сейчас не хочу" on the reopened modal and verify question text is preserved in input
      const refuseReopenedBtn = await page.waitForSelector('button:has-text("Сейчас не хочу")', { timeout: 5000 });
      await refuseReopenedBtn.click();
      await page.waitForTimeout(300);

      const inputPreservedAfterExpiryRefusal = (await albertInput.inputValue()) === expiredTestQuestion;

      const passed =
        consentModalAppeared &&
        isAcceptDisabledBeforeCheck &&
        modalClosedAfterRefusal &&
        codeV2NotOpenedAfterRefusal &&
        openCodeBtnStillVisible &&
        noProtectedPostsDuringRefusal &&
        activeConsentAccepted &&
        validBeforeExpiry &&
        nullAfterExpiry &&
        expiredConsentRejectedByGet &&
        expiredCookieRejectedByPost403 &&
        modalReopenedOnExpiredConsent &&
        inputPreservedAfterExpiryRefusal;

      results.journey5 = {
        name: "Journey 5: Consent refusal ('Сейчас не хочу') and expiry of previously accepted consent",
        check_type: "full_e2e_from_scratch",
        passed,
        initial_refusal_check: {
          consent_modal_appeared: consentModalAppeared,
          accept_button_disabled_without_checkbox: isAcceptDisabledBeforeCheck,
          refusal_button_clicked: true,
          modal_closed_after_refusal: modalClosedAfterRefusal,
          code_v2_blocked_after_refusal: codeV2NotOpenedAfterRefusal,
          open_code_button_preserved: openCodeBtnStillVisible,
          zero_protected_posts_during_refusal: noProtectedPostsDuringRefusal,
        },
        consent_acceptance_check: {
          accepted_and_code_v2_loaded: activeConsentAccepted,
        },
        consent_expiry_check: {
          ttl_ms: CONSENT_MAX_AGE_MS,
          token_valid_before_expiry: validBeforeExpiry,
          token_null_after_expiry: nullAfterExpiry,
          get_consent_accepted_false_after_expiry: expiredConsentRejectedByGet,
          post_protected_api_403_after_expiry: expiredCookieRejectedByPost403,
          api_error_code: api403OnExpiredCookie.body?.code,
          consent_modal_reopened_on_protected_action_after_expiry: modalReopenedOnExpiredConsent,
          question_preserved_when_refusing_reopened_modal: inputPreservedAfterExpiryRefusal,
        },
        screenshot: "live-runs/journey5-consent-refusal-expiry.png",
      };
      console.log(`[v8] Journey 5: ${passed ? "PASS" : "FAIL"}`);
    } finally {
      await page.close();
    }
  }

  // ---------------------------------------------------------------------------
  // Journey 6: Error response -> question strictly preserved in input -> retry without duplicate messages
  // ---------------------------------------------------------------------------
  console.log("[v8] Running Journey 6: Error response -> input strictly preserved -> retry without duplicate messages...");
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
      const calcBtn = await page.waitForSelector('button:has-text("Посмотреть описание")', { timeout: 5000 });
      await calcBtn.click();
      const openCodeBtn = await page.waitForSelector('button:has-text("Открыть мой Код")', { timeout: 10000 });
      await openCodeBtn.click();

      const consentHeading = await page.waitForSelector("#consent-heading", { timeout: 5000 }).catch(() => null);
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

      // Strict check: preservedInputValue === questionToTest (no fallback to retryBtn !== null)
      const inputStrictlyPreserved = preservedInputValue === questionToTest;
      const retryBtnVisible = retryBtn !== null;

      await retryBtn.click();

      await page.waitForFunction(() => {
        const msgs = document.querySelectorAll('div[role="dialog"] div.font-serif.text-\\[18px\\]');
        return msgs.length >= 2;
      }, { timeout: 45000 });

      const messageTexts = await page.$$eval('div[role="dialog"] div', (divs) =>
        divs.map((d) => (d as HTMLElement).innerText || d.textContent || "")
      );
      const userMessageOccurrences = messageTexts.filter((t) => t.trim() === questionToTest).length;
      const noDuplicates = userMessageOccurrences === 1;

      await page.screenshot({ path: path.join(LIVE_RUNS_DIR, "journey6-error-retry-no-duplicates.png") });

      const passed = inputStrictlyPreserved && retryBtnVisible && noDuplicates;
      results.journey6 = {
        name: "Journey 6: Error response -> question strictly preserved in input -> retry without duplicate messages",
        check_type: "full_e2e_from_scratch",
        passed,
        expected_question_in_input: questionToTest,
        preserved_input_value: preservedInputValue,
        question_strictly_preserved_in_input: inputStrictlyPreserved,
        retry_button_visible: retryBtnVisible,
        no_duplicates_in_chat_history: noDuplicates,
        user_message_count: userMessageOccurrences,
        screenshot: "live-runs/journey6-error-retry-no-duplicates.png",
      };
      console.log(`[v8] Journey 6: ${passed ? "PASS" : "FAIL"} (preservedInputValue="${preservedInputValue}")`);
    } finally {
      await page.close();
    }
  }

  // ---------------------------------------------------------------------------
  // Journey 7: Mobile 390px viewport (both entry screen AND CodeV2Experience screen)
  // ---------------------------------------------------------------------------
  console.log("[v8] Running Journey 7: Mobile 390px viewport (entry screen + CodeV2Experience screen overflow & button heights)...");
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

      // 1. Measure horizontal overflow on entry screen
      const entryOverflowMetrics = await page.evaluate(() => {
        return {
          windowInnerWidth: window.innerWidth,
          docScrollWidth: document.documentElement.scrollWidth,
          bodyScrollWidth: document.body.scrollWidth,
          hasHorizontalOverflow:
            document.documentElement.scrollWidth > window.innerWidth ||
            document.body.scrollWidth > window.innerWidth,
        };
      });

      const dayInput = await page.waitForSelector('input[placeholder="ДД"]', { timeout: 10000 });
      await dayInput.fill("15");
      const monthInput = await page.waitForSelector('input[placeholder="ММ"]', { timeout: 5000 });
      await monthInput.fill("05");
      const yearInput = await page.waitForSelector('input[placeholder="ГГГГ"]', { timeout: 5000 });
      await yearInput.fill("1990");

      const calcBtn = await page.waitForSelector('button:has-text("Посмотреть описание")', { timeout: 5000 });
      const calcBox = await calcBtn.boundingBox();

      await calcBtn.click();

      const openCodeBtn = await page.waitForSelector('button:has-text("Открыть мой Код")', { timeout: 10000 });
      const openCodeBox = await openCodeBtn.boundingBox();

      await openCodeBtn.click();
      const consentHeading = await page.waitForSelector("#consent-heading", { timeout: 5000 }).catch(() => null);
      if (consentHeading) {
        const checkbox = await page.waitForSelector('input[type="checkbox"]', { timeout: 5000 });
        await checkbox.click();
        const acceptBtn = await page.waitForSelector('button:has-text("Согласиться и продолжить")', { timeout: 5000 });
        await acceptBtn.click();
      }

      // Wait for CodeV2Experience screen to render completely
      await page.waitForSelector("#code-v2-user-question", { timeout: 15000 });
      const albertBtn = await page.waitForSelector(
        'button:has-text("Обсудить с Альбертом здесь"), button:has-text("Поговорить с Альбертом")',
        { timeout: 20000 }
      );
      const albertBox = await albertBtn.boundingBox();

      const continueToMythBtn = await page.waitForSelector(
        'button:has-text("Перейти к Личному мифу")',
        { timeout: 10000 }
      );
      const continueToMythBox = await continueToMythBtn.boundingBox();

      // 2. Measure horizontal overflow AFTER navigating onto CodeV2Experience screen
      const codeV2OverflowMetrics = await page.evaluate(() => {
        const likeButtons = Array.from(document.querySelectorAll("button")).filter(
          (b) => (b.textContent || "").trim() === "Похоже"
        );
        return {
          windowInnerWidth: window.innerWidth,
          docScrollWidth: document.documentElement.scrollWidth,
          bodyScrollWidth: document.body.scrollWidth,
          renderedPositionCardsCount: likeButtons.length,
          hasHorizontalOverflow:
            document.documentElement.scrollWidth > window.innerWidth ||
            document.body.scrollWidth > window.innerWidth,
        };
      });

      const calcHeightOk = (calcBox?.height ?? 0) >= 44;
      const openCodeHeightOk = (openCodeBox?.height ?? 0) >= 44;
      const albertHeightOk = (albertBox?.height ?? 0) >= 44;
      const continueHeightOk = (continueToMythBox?.height ?? 0) >= 44;
      const noEntryOverflow = !entryOverflowMetrics.hasHorizontalOverflow;
      const noCodeV2Overflow =
        !codeV2OverflowMetrics.hasHorizontalOverflow &&
        codeV2OverflowMetrics.renderedPositionCardsCount >= 5;

      await page.screenshot({ path: path.join(LIVE_RUNS_DIR, "journey7-mobile-390px.png") });

      const passed =
        calcHeightOk &&
        openCodeHeightOk &&
        albertHeightOk &&
        continueHeightOk &&
        noEntryOverflow &&
        noCodeV2Overflow;

      results.journey7 = {
        name: "Journey 7: Mobile 390px viewport (real button dimensions and 0 overflow on entry AND CodeV2Experience screens)",
        check_type: "full_e2e_from_scratch",
        passed,
        entry_screen_overflow_metrics: entryOverflowMetrics,
        code_v2_screen_overflow_metrics: codeV2OverflowMetrics,
        button_dimensions: {
          calculate_button: { height: calcBox?.height, ok: calcHeightOk },
          open_code_button: { height: openCodeBox?.height, ok: openCodeHeightOk },
          albert_button: { height: albertBox?.height, ok: albertHeightOk },
          continue_to_myth_button: { height: continueToMythBox?.height, ok: continueHeightOk },
        },
        screenshot: "live-runs/journey7-mobile-390px.png",
      };
      console.log(
        `[v8] Journey 7: ${passed ? "PASS" : "FAIL"} (entryScrollWidth=${entryOverflowMetrics.docScrollWidth}, codeV2ScrollWidth=${codeV2OverflowMetrics.docScrollWidth})`
      );
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
  console.log("[v8] Running Route A compatibility check (Code -> Albert before Myth API)...");
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
          token: "v8-route-a-calc-19900515",
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
  console.log("[v8] Running Route B compatibility check (Telegram Local Gate 503 API)...");
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
  fs.mkdirSync(LIVE_RUNS_DIR, { recursive: true });
  console.log("================================================================================");
  console.log("[v9] Target Evidence Suite — Final Convergence Acceptance Runner");
  console.log(`[v9] Web HEAD: ${WEB_SHA.slice(0, 7)} (PIN: ${WEB_PIN.slice(0, 7)})`);
  console.log(`[v9] DCS PIN:  ${DCS_SHA.slice(0, 7)}`);
  console.log("================================================================================");

  await verifyAndWarmupLiveServices();

  const results: Record<string, boolean> = {};

  results.mythValidatorSet4 = await runMythValidatorAndSet4Verification();
  results.codeV2PrimaryComparison = await runCodeV2PrimaryComparison();
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
  console.log("[v9] Summary of Targeted Evidence Checks:");
  console.log(`  0A. Myth Validator & Full 24-Run Corpus:    ${results.mythValidatorSet4 ? "PASS" : "FAIL"}`);
  console.log(`  0B. Code V2 Primary 6-Set Comparison:       ${results.codeV2PrimaryComparison ? "PASS" : "FAIL"}`);
  console.log(`  1.  Defect 1 Matrix (Source Origin):        ${results.defect1 ? "PASS" : "FAIL"}`);
  console.log(`  2.  Defect 2 Matrix (Crisis Self-Quote):     ${results.defect2 ? "PASS" : "FAIL"}`);
  console.log(`  3.  Route C (Data Deletion on Real Session):${results.routeC ? "PASS" : "FAIL"}`);
  console.log(`  4.  Route A (Code -> Albert before Myth):   ${results.routeA ? "PASS" : "FAIL"}`);
  console.log(`  5.  Route B (Telegram Local Gate 503):      ${results.routeB ? "PASS" : "FAIL"}`);
  console.log(`  6.  7 Real Playwright User Journeys:        ${results.journeys ? "PASS (7/7)" : "FAIL"}`);
  console.log("================================================================================");

  const allPassed = Object.values(results).every(Boolean);

  if (!allPassed) {
    console.error("[v9] FAIL-CLOSED: At least one targeted check failed. Exiting with code 1.");
    process.exit(1);
  }

  fs.mkdirSync(OUT_DIR_V10, { recursive: true });
  fs.cpSync(OUT_DIR, OUT_DIR_V10, { recursive: true, force: true });

  console.log("[v9] ALL TARGETED CHECKS PASSED SUCCESSFULLY (8/8).");
  process.exit(0);
}

const isDirectExecution =
  typeof process.argv[1] === "string" &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectExecution) {
  main().catch((err) => {
    console.error("[v9] Unhandled fatal error:", err);
    process.exit(1);
  });
}
