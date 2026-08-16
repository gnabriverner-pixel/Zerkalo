import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs/promises";
import dotenv from "dotenv";
dotenv.config({ override: true });
import { GoogleGenAI } from "@google/genai";
import { generateFullInterpretationPayload, generateFirstMirror } from "./src/services/interpretation";
import { buildPersonalMythPrompt, buildMeetingOfMirrorsPrompt } from "./src/services/mythPrompts";
import { parseMeetingResponse } from "./src/services/meetingContract";
import { AB_FIXTURES } from "./src/data/abFixtures";
import { StoryInputs } from "./src/types";
import {
  DeepSeekMythProvider,
  PERSONAL_MYTH_WRITER_VERSION,
  containsCrisisLanguage,
  generatePersonalMyth,
  parsePersonalMythRequest,
} from "./server/myth";

const DEFAULT_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const MYTH_MODEL_A = process.env.MYTH_MODEL_A || "gemini-2.5-flash";
const MYTH_MODEL_B = process.env.MYTH_MODEL_B || "gemini-2.5-pro";
const SYNTHESIS_MODEL = process.env.SYNTHESIS_MODEL || "gemini-2.5-flash";

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
  const mythProvider = new DeepSeekMythProvider(process.env);
  const personalMythTimeoutMs = Math.min(90_000, Math.max(10_000, Number(process.env.PERSONAL_MYTH_TIMEOUT_MS) || 45_000));
  const mythCache = new Map<string, { expiresAt: number; payload: unknown }>();
  const mythRate = new Map<string, { windowStartedAt: number; count: number }>();

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
        personalMyth: mythProvider.model,
      }
    });
  });

  app.get("/health/ready", (req, res) => {
    const mythReady = mythProvider.isReady();
    const meetingReady = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.length >= 10);
    const ready = mythReady && meetingReady;
    res.status(ready ? 200 : 503).json({
      status: ready ? "ready" : "not_ready",
      service: "zerkalo",
      features: {
        personal_myth: { ready: mythReady, provider: mythProvider.name, model: mythProvider.model, writer: PERSONAL_MYTH_WRITER_VERSION },
        meeting: { ready: meetingReady, model: SYNTHESIS_MODEL },
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
      const score = Number(req.body?.score);
      if (!Number.isInteger(score) || score < 0 || score > 10) {
        return res.status(400).json({ status: "error", ui: { safe_message: "Выберите оценку от 0 до 10." } });
      }
      const bounded = (value: unknown, limit: number) => String(value ?? "").trim().slice(0, limit);
      const feedback = {
        id: `fb_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        timestamp: new Date().toISOString(),
        score,
        recognizeMotifs: bounded(req.body?.recognizeMotifs, 120),
        helpedSeeDifferently: bounded(req.body?.helpedSeeDifferently, 120),
        feelsPersonalOrGeneric: bounded(req.body?.feelsPersonalOrGeneric, 120),
        wantsContinuation: bounded(req.body?.wantsContinuation, 120),
        comment: bounded(req.body?.comment, 1200),
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
      res.status(500).json({
        status: "error",
        ui: { safe_message: "Не удалось сохранить отклик. Попробуйте ещё раз позже." }
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

  // Core generation endpoint
  app.post("/api/personal-myth", async (req, res) => {
    if (!mythProvider.isReady()) {
      return res.status(503).json({
        mode: "story",
        status: "error",
        code: "personal_myth_provider_not_ready",
        ui: { safe_message: "Личный миф сейчас недоступен. Ваши ответы сохранены в этом браузере — попробуйте снова позже." },
      });
    }

    const now = Date.now();
    const clientKey = req.ip || "unknown";
    const currentRate = mythRate.get(clientKey);
    const maxRequests = process.env.NODE_ENV === "production" ? 10 : 100;
    if (!currentRate || now - currentRate.windowStartedAt > 10 * 60_000) {
      mythRate.set(clientKey, { windowStartedAt: now, count: 1 });
    } else if (currentRate.count >= maxRequests) {
      return res.status(429).json({
        mode: "story",
        status: "error",
        code: "rate_limited",
        ui: { safe_message: "Слишком много попыток подряд. Вернитесь к истории через несколько минут." },
      });
    } else {
      currentRate.count += 1;
    }

    try {
      const request = parsePersonalMythRequest(req.body);
      const cached = mythCache.get(request.request_id);
      if (cached && cached.expiresAt > now) return res.status(200).json(cached.payload);

      if (containsCrisisLanguage(request.answers)) {
        return res.status(200).json({
          mode: "story",
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
        writer_version: PERSONAL_MYTH_WRITER_VERSION,
        provider: mythProvider.name,
        model: mythProvider.model,
        story_result: generated.result,
        qa: { passed: generated.quality.passed, word_count: generated.quality.word_count, repaired: generated.repaired },
      };
      mythCache.set(request.request_id, { expiresAt: now + 30 * 60_000, payload });
      return res.status(200).json(payload);
    } catch (error) {
      const code = error instanceof Error ? error.message.split(":", 1)[0] : "personal_myth_failed";
      const inputError = code.startsWith("invalid_");
      console.error("Personal Myth generation failed:", code);
      return res.status(inputError ? 400 : 502).json({
        mode: "story",
        status: "error",
        code,
        ui: {
          safe_message: inputError
            ? "Проверьте, что на все четыре вопроса есть короткий ответ."
            : "Историю не удалось собрать достаточно точно. Ответы сохранены — можно повторить попытку.",
        },
      });
    }
  });

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

  // Dedicated Meeting of Mirrors Endpoint (Independent synthesis)
  const meetingHandler = async (req: express.Request, res: express.Response) => {
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
        return res.status(503).json({
          status: "error",
          ui: { safe_message: "Встреча зеркал сейчас недоступна. Ваши результаты сохранены — попробуйте снова позже." }
        });
      }

      const ai = new GoogleGenAI({ apiKey });
      const prompt = buildMeetingOfMirrorsPrompt(codeData, storyData);

      const response = await ai.models.generateContent({
        model: SYNTHESIS_MODEL,
        contents: prompt,
        config: {
          temperature: 0.6,
          responseMimeType: "application/json",
        }
      });

      let responseText = response.text || "{}";
      
      try {
        let cleaned = responseText.replace(/```json/gi, "").replace(/```/g, "").trim();
        const firstBrace = cleaned.indexOf('{');
        const lastBrace = cleaned.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          cleaned = cleaned.substring(firstBrace, lastBrace + 1);
        }
        // Remove trailing commas before } or ]
        cleaned = cleaned.replace(/,\s*([}\]])/g, '$1');
        
        let parsedRaw;
        try {
          parsedRaw = JSON.parse(cleaned);
        } catch {
          const sanitized = cleaned.replace(/[\u0000-\u001F]+/g, (m) => m === '\n' || m === '\r' || m === '\t' ? m : ' ');
          parsedRaw = JSON.parse(sanitized);
        }

        const resultJson = parseMeetingResponse(parsedRaw);
        res.status(200).json(resultJson);
      } catch (err) {
        console.error("Developer Log: Synthesis contract error:", err instanceof Error ? err.message : "unknown");
        res.status(502).json({
          status: "error",
          ui: { safe_message: "Встреча зеркал не смогла подготовить надёжный ответ. Ваши результаты сохранены — попробуйте снова позже." }
        });
      }

    } catch (error) {
      console.error("Developer Log: Meeting of Mirrors error:", error instanceof Error ? error.message : "unknown");
      res.status(502).json({
        status: "error",
        ui: { safe_message: "Не удалось провести надёжное сопоставление. Ваши результаты сохранены — попробуйте снова позже." }
      });
    }
  };

  app.post("/api/meeting-of-mirrors", meetingHandler);
  app.post("/api/lab/meeting/generate", meetingHandler);

  // Dedicated Blind A/B Model Comparison Endpoint
  app.post("/api/ab-compare", async (req, res) => {
    try {
      const { fixtureIndex, customInputs } = req.body;
      const fixture = (typeof fixtureIndex === 'number' && AB_FIXTURES[fixtureIndex])
        ? AB_FIXTURES[fixtureIndex]
        : (customInputs ? { id: 'custom', title: 'Пользовательский ввод', subtitle: '', theme: '', inputs: customInputs } : AB_FIXTURES[0]);

      const apiKey = process.env.GEMINI_API_KEY;

      if (!apiKey || apiKey === "YOUR_GEMINI_API_KEY" || apiKey.length < 10 || apiKey.includes("API_KEY")) {
        return res.status(200).json({
          status: "error",
          ui: { safe_message: "Для A/B тестирования моделей требуется действительный GEMINI_API_KEY." }
        });
      }

      const ai = new GoogleGenAI({ apiKey });
      const prompt = buildPersonalMythPrompt(fixture.inputs);

      // Model A execution
      const startA = Date.now();
      const callA = ai.models.generateContent({
        model: MYTH_MODEL_A,
        contents: prompt,
        config: { temperature: 0.7 }
      }).then(r => ({
        text: r.text || "{}",
        latency: Date.now() - startA,
        model: MYTH_MODEL_A
      })).catch(err => ({
        text: JSON.stringify({ error: String(err) }),
        latency: Date.now() - startA,
        model: MYTH_MODEL_A
      }));

      // Model B execution
      const startB = Date.now();
      const callB = ai.models.generateContent({
        model: MYTH_MODEL_B,
        contents: prompt,
        config: { temperature: 0.7 }
      }).then(r => ({
        text: r.text || "{}",
        latency: Date.now() - startB,
        model: MYTH_MODEL_B
      })).catch(err => ({
        text: JSON.stringify({ error: String(err) }),
        latency: Date.now() - startB,
        model: MYTH_MODEL_B
      }));

      const [resA, resB] = await Promise.all([callA, callB]);

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
        actualModel: resB.model,
        title: outB.title || "Без названия",
        story: outB.story || "",
        mirror: outB.mirror || {},
        one_step: outB.one_step || "",
        journal_question: outB.journal_question || "",
        latencyMs: resB.latency
      } : {
        id: "A",
        actualModel: resA.model,
        title: outA.title || "Без названия",
        story: outA.story || "",
        mirror: outA.mirror || {},
        one_step: outA.one_step || "",
        journal_question: outA.journal_question || "",
        latencyMs: resA.latency
      };

      const variantB = swap ? {
        id: "B",
        actualModel: resA.model,
        title: outA.title || "Без названия",
        story: outA.story || "",
        mirror: outA.mirror || {},
        one_step: outA.one_step || "",
        journal_question: outA.journal_question || "",
        latencyMs: resA.latency
      } : {
        id: "B",
        actualModel: resB.model,
        title: outB.title || "Без названия",
        story: outB.story || "",
        mirror: outB.mirror || {},
        one_step: outB.one_step || "",
        journal_question: outB.journal_question || "",
        latencyMs: resB.latency
      };

      res.status(200).json({
        status: "ok",
        fixtureId: fixture.id,
        fixtureTitle: fixture.title,
        inputs: fixture.inputs,
        variantA,
        variantB,
        modelAName: MYTH_MODEL_A,
        modelBName: MYTH_MODEL_B
      });

    } catch (error) {
      console.error("Developer Log: AB compare error:", error);
      res.status(200).json({
        status: "error",
        ui: { safe_message: "Не удалось выполнить сравнительную генерацию моделей." }
      });
    }
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
