import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs/promises";
import crypto from "crypto";
import { GoogleGenAI } from "@google/genai";
import "dotenv/config";
import { generateFullInterpretationPayload, generateFirstMirror } from "./src/services/interpretation";
import { buildPersonalMythPrompt, buildMeetingOfMirrorsPrompt } from "./src/services/mythPrompts";
import { generateDeterministicMeeting } from "./src/services/meetingOfMirrors";
import { AB_FIXTURES } from "./src/data/abFixtures";
import { StoryInputs } from "./src/types";
import {
  containsCrisisLanguage,
  createMythProvider,
  generatePersonalMyth,
  parsePersonalMythRequest,
  type PersonalMythProvider,
} from "./server/myth";

// --- Замороженные конфигурации предыдущего снапшота (не используются lab-флоу) ---
const DEFAULT_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const MYTH_MODEL_A = process.env.MYTH_MODEL_A || "gemini-2.5-flash";
const MYTH_MODEL_B = process.env.MYTH_MODEL_B || "gemini-2.5-pro";
const SYNTHESIS_MODEL = process.env.SYNTHESIS_MODEL || "gemini-2.5-flash";

// --- Лаборатория Gate 1: Личный миф на DeepSeek V4 (актуальные model IDs) ---
const LAB_MYTH_MODEL_A = process.env.LAB_MYTH_MODEL_A || "deepseek-v4-flash";
const LAB_MYTH_MODEL_B = process.env.LAB_MYTH_MODEL_B || "deepseek-v4-pro";

function isCrisisInput(inputs: StoryInputs): boolean {
  const combined = `${inputs.q1 || ''} ${inputs.q2 || ''} ${inputs.q3 || ''} ${inputs.q4 || ''}`.toLowerCase();
  const crisisPatterns = [
    /суицид/i,
    /покончить с собой/i,
    /убить себя/i,
    /не хочу жить/i,
    /причинить себе вред/i,
    /вскрыть вены/i,
    /спрыгнуть с/i,
    /самоубийств/i,
    /наложить на себя руки/i
  ];
  return crisisPatterns.some(p => p.test(combined));
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  const personalMythEnabled = /^(1|true|yes|on)$/iu.test(process.env.PERSONAL_MYTH_ENABLED || "1");
  const personalMythTimeoutMs = Math.min(
    90_000,
    Math.max(10_000, Number(process.env.PERSONAL_MYTH_TIMEOUT_MS) || 45_000),
  );
  let mythProvider: PersonalMythProvider;
  try {
    mythProvider = createMythProvider(process.env);
  } catch (error) {
    console.error("Lab Myth provider configuration error:", error instanceof Error ? error.message : "unknown");
    mythProvider = createMythProvider({ ...process.env, DEEPSEEK_API_KEY: "" });
  }
  const mythCache = new Map<string, { expiresAt: number; payload: unknown }>();
  const mythRate = new Map<string, { windowStartedAt: number; count: number }>();
  const abRevealCache = new Map<string, { expiresAt: number; modelA: string; modelB: string; swap: boolean }>();

  app.use(express.json({ limit: "5mb" }));

  app.get("/health", (req, res) => {
    res.json({
      status: "ok",
      service: "zerkalo",
      version: "1.0.0-lab",
      models: {
        default: DEFAULT_MODEL,
        mythA: MYTH_MODEL_A,
        mythB: MYTH_MODEL_B,
        synthesis: SYNTHESIS_MODEL,
        labMythA: LAB_MYTH_MODEL_A,
        labMythB: LAB_MYTH_MODEL_B
      }
    });
  });

  app.get("/health/ready", (req, res) => {
    const ready = mythProvider.isReady();
    res.status(ready ? 200 : 503).json({
      status: ready ? "ready" : "not_ready",
      service: "zerkalo",
      version: "1.0.0-lab",
      features: {
        lab_myth: {
          enabled: personalMythEnabled,
          ready,
          provider: mythProvider.name,
          model: mythProvider.model,
        },
        ab: { ready },
      },
    });
  });

  // Fixtures for A/B testing
  app.get("/api/ab-fixtures", (req, res) => {
    res.json({
      status: "ok",
      fixtures: AB_FIXTURES
    });
  });

  // Tester Feedback submission
  app.post("/api/feedback", async (req, res) => {
    try {
      const feedback = {
        id: `fb_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        timestamp: new Date().toISOString(),
        ...req.body
      };

      const feedbackFilePath = path.join(process.cwd(), 'feedback.json');
      let feedbackList = [];
      try {
        const fileContent = await fs.readFile(feedbackFilePath, 'utf-8');
        feedbackList = JSON.parse(fileContent);
      } catch (err) {
        // File doesn't exist yet, start fresh
      }

      feedbackList.push(feedback);
      await fs.writeFile(feedbackFilePath, JSON.stringify(feedbackList, null, 2), 'utf-8');

      res.status(200).json({
        status: "ok",
        message: "Благодарим вас за отзыв. Он помогает делать зеркало точнее и человечнее."
      });
    } catch (error) {
      console.error("Developer Log: Failed to save feedback:", error);
      res.status(200).json({
        status: "ok",
        message: "Отзыв принят."
      });
    }
  });

  app.post("/api/lead", async (req, res) => {
    try {
      const { name, birthDate, contact, request, source } = req.body;
      
      if (!name || !birthDate || !contact) {
        return res.status(200).json({
          status: "error",
          ui: { safe_message: "Пожалуйста, заполните обязательные поля (Имя, Дата, Контакт)." }
        });
      }
      
      if (request && request.length > 1000) {
        return res.status(200).json({
          status: "error",
          ui: { safe_message: "Длина запроса превышает 1000 символов." }
        });
      }

      const lead = {
        timestamp: new Date().toISOString(),
        name,
        birthDate,
        contact,
        request,
        source
      };

      const leadsFilePath = path.join(process.cwd(), 'leads.json');
      let leads = [];
      try {
        const fileContent = await fs.readFile(leadsFilePath, 'utf-8');
        leads = JSON.parse(fileContent);
      } catch (err) {
        // File doesn't exist or is invalid JSON, start fresh
      }
      
      leads.push(lead);
      await fs.writeFile(leadsFilePath, JSON.stringify(leads, null, 2), 'utf-8');
      
      res.status(200).json({
        status: "ok",
        ui: {
          safe_message: "Заявка принята. Я свяжусь с вами в Telegram и уточню детали Большого исследования."
        }
      });
    } catch (error) {
      console.error("Developer Log: Failed to save lead:", error);
      res.status(200).json({
        status: "ok",
        ui: {
          safe_message: "Заявка принята. Я свяжусь с вами в Telegram и уточню детали Большого исследования."
        }
      });
    }
  });

  app.post("/api/generate-pdf", async (req, res) => {
    try {
      const { birthDate } = req.body;
      
      if (!birthDate) {
         return res.status(200).json({
          status: "error",
          ui: { safe_message: "Дата рождения обязательна." }
        });
      }

      console.log(`SERVER LOG: PDF Generation requested for date: ${birthDate}`);
      await new Promise(resolve => setTimeout(resolve, 1500));

      res.status(200).json({
        status: "ok",
        ui: { safe_message: "Функционал генерации Большого исследования находится в разработке. Скоро эта возможность станет доступной." }
      });
    } catch (err) {
      console.error("PDF generation request error:", err);
      res.status(200).json({
        status: "error",
        ui: { safe_message: "Произошла ошибка при отправке запроса. Пожалуйста, попробуйте позже." }
      });
    }
  });

  // --- LAB: Личный миф (DeepSeek V4, независимая линза) ---
  // Writer и safety разделены. Никакого canned-фолбэка: ошибка — честная ошибка.
  const handleLabMyth = async (req: express.Request, res: express.Response) => {
    if (!personalMythEnabled) {
      return res.status(503).json({
        status: "unavailable",
        code: "personal_myth_disabled",
        ui: { safe_message: "Личный миф временно недоступен. Ответы сохранены в этом браузере." },
      });
    }
    if (!mythProvider.isReady()) {
      return res.status(503).json({
        status: "unavailable",
        code: "personal_myth_provider_not_ready",
        ui: { safe_message: "Личный миф сейчас не удаётся собрать. Ответы сохранены в этом браузере." },
      });
    }

    const now = Date.now();
    const clientKey = req.ip || "unknown";
    const rate = mythRate.get(clientKey);
    if (!rate || now - rate.windowStartedAt > 10 * 60_000) {
      mythRate.set(clientKey, { windowStartedAt: now, count: 1 });
    } else if (rate.count >= 5) {
      return res.status(429).json({
        status: "error",
        code: "rate_limited",
        ui: { safe_message: "Слишком много попыток подряд. Вернитесь к истории через несколько минут." },
      });
    } else {
      rate.count += 1;
    }

    try {
      const request = parsePersonalMythRequest(req.body);
      const cached = mythCache.get(request.request_id);
      if (cached && cached.expiresAt > now) return res.status(200).json(cached.payload);

      if (containsCrisisLanguage(request.answers)) {
        return res.status(200).json({
          status: "crisis",
          ui: {
            safe_message: "Похоже, сейчас важнее не образная история, а живая поддержка. Обратитесь к близкому человеку рядом или к профильному специалисту в вашем регионе. Если есть непосредственная опасность — свяжитесь с экстренной службой.",
          },
        });
      }

      const generated = await generatePersonalMyth(request, mythProvider, personalMythTimeoutMs);
      const payload = {
        mode: "story",
        status: "ok",
        request_id: request.request_id,
        story_result: generated.result,
        qa: {
          passed: generated.quality.passed,
          word_count: generated.quality.word_count,
          repaired: generated.repaired,
        },
      };
      mythCache.set(request.request_id, { expiresAt: now + 30 * 60_000, payload });
      return res.status(200).json(payload);
    } catch (error) {
      const code = error instanceof Error ? error.message.split(":", 1)[0] : "personal_myth_failed";
      console.error("Lab Myth generation failed:", code);
      const inputError = code.startsWith("invalid_");
      return res.status(inputError ? 400 : 502).json({
        status: "error",
        code,
        ui: {
          safe_message: inputError
            ? "Проверьте, что на все четыре вопроса есть короткий ответ."
            : "Историю не удалось собрать достаточно точно. Ответы сохранены — можно повторить попытку.",
        },
      });
    }
  };

  app.post("/api/lab/myth/generate", handleLabMyth);

  // Core generation endpoint (замороженный снапшот; UI лаборатории его не использует)
  app.post("/api/generate", async (req, res) => {
    try {
      const { mode, date, calc, storyInputs, modelOverride } = req.body;
      const apiKey = process.env.GEMINI_API_KEY;
      
      console.log(`SERVER LOG: Generating for mode=${mode}. Key exists: ${!!apiKey}`);

      let deterministicMirror;
      if (mode === "code") {
        deterministicMirror = generateFirstMirror(calc);
      }

      // Crisis pre-check for story: returns { "status": "crisis", ... }
      if (mode === "story" && storyInputs && isCrisisInput(storyInputs)) {
        return res.status(200).json({
          mode: "story",
          status: "crisis",
          ui: {
            safe_message: "Похоже, сейчас важнее не образная история, а живая поддержка. Обратитесь к близкому человеку рядом или к профильному специалисту в вашем регионе. Если есть непосредственная опасность — свяжитесь с экстренной службой."
          }
        });
      }

      // Schema notes for testing and type safety:
      // "mirror": { "mainImage": "", "innerTension": "" }

      if (!apiKey || apiKey === "YOUR_GEMINI_API_KEY" || apiKey.length < 10 || apiKey.includes("API_KEY")) {
        console.error("Developer Log: Gemini request bypassed: invalid or missing API key.");
        if (mode === "code") {
           return res.status(200).json({ 
             mode,
             status: "demo",
             code_result: { first_mirror: deterministicMirror },
             ui: { safe_message: "Показана базовая версия первого слоя. Персональная генерация доступна при подключении ключа." }
           });
        }
        return res.status(200).json({ 
          mode,
          status: "demo",
          ui: { safe_message: "Сейчас доступна демонстрационная версия (требуется ключ API)." }
        });
      }

      const ai = new GoogleGenAI({ apiKey });
      
      // Read AGENTS.md and SKILLS
      const agentsPrompt = await fs.readFile(path.join(process.cwd(), 'AGENTS.md'), 'utf-8').catch(() => '');
      const skill13 = await fs.readFile(path.join(process.cwd(), 'skills/VYAZEMSKY__SKILL_13__EDITORIAL_STYLE_v1.md'), 'utf-8').catch(() => '');
      
      const strictGrammarPrompt = `
ОЧЕНЬ ВАЖНО: Твои тексты должны быть безупречны с точки зрения орфографии, пунктуации и грамматики русского языка. 
1. Проверяй каждое согласование падежей, лиц и чисел. Никаких машинных ошибок в окончаниях.
2. Проверяй синтаксис и пунктуацию — запятые, тире, причастные/деепричастные обороты должны быть расставлены по правилам Розенталя.
3. Стиль должен быть живым, естественным, ясным, поэтичным и точным.
${skill13 ? `СТРОГО следуй SKILL_13:\n${skill13}` : ''}
`;

      const systemInstruction = `Ты — эксперт проекта «Цифровой Код» и «Зеркало себя». Отвечай строго в формате JSON без markdown-оборачивания, валидный JSON.\n\n${agentsPrompt}\n\n${strictGrammarPrompt}`;
      
      let prompt = "";
      let targetModel = modelOverride || DEFAULT_MODEL;

      if (mode === "code") {
        const payloadStr = JSON.stringify(generateFullInterpretationPayload(calc), null, 2);
        prompt = `Пользователь запросил "Первое зеркало" (Архитектура Кода). Дата: ${date}.
Рассчитанные данные и структурированная смысловая база (СТРОГО используй эти значения):
${payloadStr}

Схема ответа FirstMirror:
{
  "title": "string",
  "subtitle": "string",
  "formula": { "numbers": "string", "planets": "string", "positions": "string" },
  "blocks": [
    { "id": "main_pattern", "title": "Главный узор", "text": "string" },
    { "id": "strength", "title": "Что уже является силой", "text": "string" },
    { "id": "tension", "title": "Где возникает напряжение", "text": "string" },
    { "id": "step", "title": "Первый практический шаг", "text": "string" },
    { "id": "resonance", "title": "Метафорический резонанс", "text": "string" }
  ],
  "keyInsight": "string",
  "strengthTags": ["string"],
  "tensionTags": ["string"],
  "practicalStep": "string",
  "cta": { "title": "string", "text": "string", "button": "string" },
  "disclaimer": "string"
}

Сгенерируй персонализированное "Первое зеркало", опираясь на смысловую базу проекта и базовый макет deterministicMirror (${JSON.stringify(deterministicMirror)}). 
Сделай текст в блоках живым, глубоким и премиальным, избегая клише и запрещенных слов (исцеление, фатальность, гарантировано, вы точно).

Верни JSON:
{
  "mode": "code",
  "status": "ok",
  "code_result": { "first_mirror": <YOUR_FIRST_MIRROR_OBJECT> }
}`;
      } else if (mode === "story") {
        // STRICT INDEPENDENCE: No code inputs passed to story prompt
        prompt = buildPersonalMythPrompt(storyInputs);
        targetModel = modelOverride || MYTH_MODEL_A;
      } else if (mode === "compatibility") {
        const { date2, calc2 } = req.body;
        const payload1 = JSON.stringify(generateFullInterpretationPayload(calc), null, 2);
        const payload2 = JSON.stringify(generateFullInterpretationPayload(calc2), null, 2);
        
        prompt = `Пользователь запросил анализ Совместимости. 
Первый человек: ${date}
${payload1}

Второй человек: ${date2}
${payload2}

Используй режим COMPATIBILITY. 
Уровни: 
1. Душа ↔ Душа
2. Путь ↔ Путь
3. Перекрестная динамика
4. Наложение матриц
5. Синхронность циклов

Верни строго JSON:
{
  "mode": "compatibility",
  "status": "ok",
  "compatibility_result": {
    "introduction": "string (краткое введение об их союзе)",
    "cards_summary": "string (основные цифры душ и путей обоих)",
    "levels": {
      "soul_to_soul": "string",
      "path_to_path": "string",
      "cross_dynamic": "string",
      "matrix_overlay": "string",
      "cycles_sync": "string"
    },
    "strength_point": "string",
    "tension_point": "string",
    "practice_or_parable": "string"
  }
}`;
      }

      const response = await ai.models.generateContent({
        model: targetModel,
        contents: prompt,
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.7,
        }
      });
      
      let responseText = response.text || "{}";
      responseText = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
      
      let resultJson;
      try {
        resultJson = JSON.parse(responseText);
      } catch (parseError) {
        console.error("Developer Log: LLM returned invalid JSON:", responseText);
        if (mode === "code") {
           return res.status(200).json({
             mode,
             status: "ok",
             code_result: { first_mirror: deterministicMirror },
             ui: { safe_message: "Сетевая задержка при формировании расширенного описания. Показан точный расчет." }
           });
        }
        return res.status(200).json({
          mode: req.body.mode,
          status: "error",
          ui: { safe_message: "Сервис временно не смог подготовить текст. Пожалуйста, попробуйте снова." }
        });
      }

      res.json(resultJson);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("Developer Log: AI Generation Error:", errorMessage);
      
      if (req.body.mode === "code") {
         return res.status(200).json({ 
           mode: req.body.mode,
           status: "demo",
           code_result: { first_mirror: generateFirstMirror(req.body.calc) },
           ui: { safe_message: "Сервис LLM недоступен. Показана базовая версия первого слоя." }
         });
      }

      res.status(200).json({ 
        mode: req.body.mode,
        status: "error",
        ui: { safe_message: "Сервис временно не смог подготовить текстовую историю. Попробуйте повторить запрос." }
      });
    }
  });

  // Dedicated Meeting of Mirrors Endpoint (замороженный снапшот; контракт переписывается в Gate 2)
  app.post("/api/meeting-of-mirrors", async (req, res) => {
    try {
      const { codeData, storyData } = req.body;

      if (!codeData || !codeData.calc || !storyData || !storyData.storyInputs || !storyData.storyResult) {
        return res.status(200).json({
          status: "error",
          ui: { safe_message: "Для встречи зеркал необходимы готовые результаты обеих линз (Цифрового Кода и Личного Мифа)." }
        });
      }

      const apiKey = process.env.GEMINI_API_KEY;

      if (!apiKey || apiKey === "YOUR_GEMINI_API_KEY" || apiKey.length < 10 || apiKey.includes("API_KEY")) {
        console.log("SERVER LOG: Generating deterministic Meeting of Mirrors fallback.");
        const fallbackResult = generateDeterministicMeeting(
          codeData.calc,
          codeData.firstMirror,
          storyData.storyInputs,
          storyData.storyResult
        );
        return res.status(200).json({
          status: "ok",
          result: fallbackResult,
          ui: { safe_message: "Синтез выполнен по базовой модели сопоставления." }
        });
      }

      const ai = new GoogleGenAI({ apiKey });
      const prompt = buildMeetingOfMirrorsPrompt(codeData, storyData);

      const response = await ai.models.generateContent({
        model: SYNTHESIS_MODEL,
        contents: prompt,
        config: {
          temperature: 0.6,
        }
      });

      let responseText = response.text || "{}";
      responseText = responseText.replace(/```json/g, "").replace(/```/g, "").trim();

      try {
        const resultJson = JSON.parse(responseText);
        res.status(200).json(resultJson);
      } catch (err) {
        console.error("Developer Log: Synthesis JSON parse error:", responseText);
        const fallbackResult = generateDeterministicMeeting(
          codeData.calc,
          codeData.firstMirror,
          storyData.storyInputs,
          storyData.storyResult
        );
        res.status(200).json({
          status: "ok",
          result: fallbackResult,
          ui: { safe_message: "При формировании синтеза использована резервная схема сопоставления." }
        });
      }

    } catch (error) {
      console.error("Developer Log: Meeting of Mirrors error:", error);
      const { codeData, storyData } = req.body;
      if (codeData?.calc && storyData?.storyInputs) {
        const fallbackResult = generateDeterministicMeeting(
          codeData.calc,
          codeData.firstMirror,
          storyData.storyInputs,
          storyData.storyResult
        );
        return res.status(200).json({
          status: "ok",
          result: fallbackResult,
          ui: { safe_message: "Использована резервная модель сопоставления." }
        });
      }

      res.status(200).json({
        status: "error",
        ui: { safe_message: "Не удалось провести сопоставление. Пожалуйста, повторите попытку." }
      });
    }
  });

  // Dedicated Blind A/B Model Comparison Endpoint (DeepSeek V4, одинаковые настройки)
  app.post("/api/ab-compare", async (req, res) => {
    try {
      const { fixtureIndex, customInputs } = req.body;
      const fixture = (typeof fixtureIndex === 'number' && AB_FIXTURES[fixtureIndex])
        ? AB_FIXTURES[fixtureIndex]
        : (customInputs ? { id: 'custom', title: 'Пользовательский ввод', subtitle: '', theme: '', inputs: customInputs } : AB_FIXTURES[0]);

      const providerA = createMythProvider(process.env, { model: LAB_MYTH_MODEL_A });
      const providerB = createMythProvider(process.env, { model: LAB_MYTH_MODEL_B });

      if (!providerA.isReady() || !providerB.isReady()) {
        return res.status(200).json({
          status: "error",
          ui: { safe_message: "Для слепого сравнения моделей требуется действительный DEEPSEEK_API_KEY." }
        });
      }

      const request = parsePersonalMythRequest({
        request_id: `ab_${Date.now()}`,
        consent_version: "personal-myth-v1-ab",
        answers: fixture.inputs,
      });
      const prompt = buildPersonalMythPrompt(request);

      const runProvider = async (provider: PersonalMythProvider) => {
        const startedAt = Date.now();
        try {
          const text = await provider.generate(prompt, personalMythTimeoutMs);
          return { text, latencyMs: Date.now() - startedAt, model: provider.model, failed: false };
        } catch (error) {
          return {
            text: JSON.stringify({ error: error instanceof Error ? error.message : "unknown" }),
            latencyMs: Date.now() - startedAt,
            model: provider.model,
            failed: true,
          };
        }
      };

      const [resA, resB] = await Promise.all([runProvider(providerA), runProvider(providerB)]);

      const parseResult = (raw: string) => {
        try {
          const cleaned = raw.replace(/```json/g, "").replace(/```/g, "").trim();
          const parsed = JSON.parse(cleaned);
          return parsed.story_result || parsed;
        } catch {
          return {
            title: "Ошибка парсинга",
            story: raw,
            mirror: { mainImage: "-", innerTension: "-", hiddenResource: "-", newView: "-" },
            one_step: "-",
            journal_question: "-"
          };
        }
      };

      const outA = parseResult(resA.text);
      const outB = parseResult(resB.text);

      // Randomize whether Model A is shown as Variant A or Variant B to prevent reviewer bias
      const swap = Math.random() > 0.5;

      const variantA = swap ? {
        id: "A",
        actualModel: undefined,
        title: outB.title || "Без названия",
        story: outB.story || "",
        mirror: outB.mirror || {},
        one_step: outB.one_step || "",
        journal_question: outB.journal_question || "",
        latencyMs: resB.latencyMs
      } : {
        id: "A",
        actualModel: undefined,
        title: outA.title || "Без названия",
        story: outA.story || "",
        mirror: outA.mirror || {},
        one_step: outA.one_step || "",
        journal_question: outA.journal_question || "",
        latencyMs: resA.latencyMs
      };

      const variantB = swap ? {
        id: "B",
        actualModel: undefined,
        title: outA.title || "Без названия",
        story: outA.story || "",
        mirror: outA.mirror || {},
        one_step: outA.one_step || "",
        journal_question: outA.journal_question || "",
        latencyMs: resA.latencyMs
      } : {
        id: "B",
        actualModel: undefined,
        title: outB.title || "Без названия",
        story: outB.story || "",
        mirror: outB.mirror || {},
        one_step: outB.one_step || "",
        journal_question: outB.journal_question || "",
        latencyMs: resB.latencyMs
      };

      const comparisonId = `ab_${crypto.randomUUID().replace(/-/gu, "")}`;
      abRevealCache.set(comparisonId, {
        expiresAt: Date.now() + 30 * 60_000,
        modelA: providerA.model,
        modelB: providerB.model,
        swap,
      });

      res.status(200).json({
        status: "ok",
        comparisonId,
        fixtureId: fixture.id,
        fixtureTitle: fixture.title,
        inputs: fixture.inputs,
        variantA,
        variantB,
        modelAName: "—",
        modelBName: "—"
      });

    } catch (error) {
      console.error("Developer Log: AB compare error:", error);
      res.status(200).json({
        status: "error",
        ui: { safe_message: "Не удалось выполнить сравнительную генерацию моделей." }
      });
    }
  });

  // Blind reveal: имена моделей открываются только по явному запросу после выбора
  app.post("/api/ab-reveal", (req, res) => {
    const comparisonId = String(req.body?.comparisonId || "");
    const entry = comparisonId ? abRevealCache.get(comparisonId) : undefined;
    if (!entry || entry.expiresAt < Date.now()) {
      return res.status(200).json({
        status: "error",
        ui: { safe_message: "Сравнение устарело — запустите генерацию заново." }
      });
    }
    const aModel = entry.swap ? entry.modelB : entry.modelA;
    const bModel = entry.swap ? entry.modelA : entry.modelB;
    res.status(200).json({
      status: "ok",
      comparisonId,
      modelAName: entry.modelA,
      modelBName: entry.modelB,
      variantA: { actualModel: aModel },
      variantB: { actualModel: bModel },
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
