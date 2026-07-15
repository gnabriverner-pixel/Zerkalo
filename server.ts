import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs/promises";
import crypto from "crypto";
import { GoogleGenAI } from "@google/genai";
import "dotenv/config";
import { generateFullInterpretationPayload, generateFirstMirror } from "./src/services/interpretation";
import {
  containsCrisisLanguage,
  createPersonalMythProvider,
  generatePersonalMyth,
  parsePersonalMythRequest,
  type PersonalMythProvider,
} from "./server/personalMyth";

function cleanLegacyRequestId(value: unknown): string {
  const candidate = String(value ?? "").trim();
  if (/^[a-zA-Z0-9_-]{12,80}$/u.test(candidate)) return candidate;
  return `legacy_${crypto.randomUUID().replace(/-/gu, "")}`;
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  const personalMythEnabled = /^(1|true|yes|on)$/iu.test(process.env.PERSONAL_MYTH_ENABLED || "0");
  const personalMythTimeoutMs = Math.min(
    90_000,
    Math.max(10_000, Number(process.env.PERSONAL_MYTH_TIMEOUT_MS) || 45_000),
  );
  let personalMythProvider: PersonalMythProvider | null = null;
  try {
    personalMythProvider = createPersonalMythProvider(process.env);
  } catch (error) {
    console.error("Personal Myth provider configuration error:", error instanceof Error ? error.message : "unknown");
  }
  const personalMythCache = new Map<string, { expiresAt: number; payload: unknown }>();
  const personalMythRate = new Map<string, { windowStartedAt: number; count: number }>();

  app.use(express.json({ limit: "32kb" }));

  const personalMythReady = () =>
    !personalMythEnabled || Boolean(personalMythProvider?.isReady());

  app.get("/health/live", (req, res) => {
    res.json({
      status: "ok",
      service: "zerkalo",
      version: "0.1.0"
    });
  });

  app.get(["/health", "/health/ready"], (req, res) => {
    const ready = personalMythReady();
    res.status(ready ? 200 : 503).json({
      status: ready ? "ready" : "not_ready",
      service: "zerkalo",
      version: "0.1.0",
      features: {
        personal_myth: {
          enabled: personalMythEnabled,
          ready,
          provider: personalMythProvider?.name || "unconfigured",
          model: personalMythProvider?.model || "unconfigured",
        },
      },
    });
  });

  const handlePersonalMyth = async (req: express.Request, res: express.Response) => {
    if (!personalMythEnabled) {
      return res.status(503).json({
        status: "unavailable",
        code: "personal_myth_disabled",
        ui: { safe_message: "Личный миф временно недоступен. Ваши ответы можно сохранить и повторить позже." },
      });
    }
    if (!personalMythProvider?.isReady()) {
      return res.status(503).json({
        status: "unavailable",
        code: "personal_myth_provider_not_ready",
        ui: { safe_message: "Личный миф сейчас не удаётся собрать. Ответы сохранены в этом браузере." },
      });
    }

    const now = Date.now();
    const clientKey = req.ip || "unknown";
    const rate = personalMythRate.get(clientKey);
    if (!rate || now - rate.windowStartedAt > 10 * 60_000) {
      personalMythRate.set(clientKey, { windowStartedAt: now, count: 1 });
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
      const cached = personalMythCache.get(request.request_id);
      if (cached && cached.expiresAt > now) return res.status(200).json(cached.payload);

      if (containsCrisisLanguage(request.answers)) {
        return res.status(200).json({
          status: "crisis",
          ui: {
            safe_message: "Похоже, сейчас важнее не образная история, а живая поддержка. Обратитесь к человеку рядом или к специалисту в вашем регионе. Если есть непосредственная опасность — обратитесь в экстренную службу.",
          },
        });
      }

      const generated = await generatePersonalMyth(
        request,
        personalMythProvider,
        personalMythTimeoutMs,
      );
      const payload = {
        mode: "story",
        status: "ok",
        request_id: request.request_id,
        story_result: generated.result,
        qa: {
          passed: generated.quality.passed,
          word_count: generated.quality.word_count,
          answer_coverage: generated.quality.answer_coverage,
          repaired: generated.repaired,
        },
      };
      personalMythCache.set(request.request_id, {
        expiresAt: now + 30 * 60_000,
        payload,
      });
      return res.status(200).json(payload);
    } catch (error) {
      const code = error instanceof Error ? error.message.split(":", 1)[0] : "personal_myth_failed";
      console.error("Personal Myth generation failed:", code);
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

  app.post("/api/personal-myth/generate", handlePersonalMyth);

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
          safe_message: "Заявка принята. Я свяжусь с вами и уточню, какой вопрос важно разобрать."
        }
      });
    } catch (error) {
      console.error("Developer Log: Failed to save lead:", error);
      // Even if file writing fails, we acknowledge to the user successfully
      res.status(200).json({
        status: "ok",
        ui: {
          safe_message: "Заявка принята. Я свяжусь с вами и уточню, какой вопрос важно разобрать."
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
      await new Promise(resolve => setTimeout(resolve, 2000));

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

  app.post("/api/generate", async (req, res) => {
    try {
      const { mode, date, calc, storyInputs } = req.body;
      if (mode === "story") {
        req.body = {
          request_id: cleanLegacyRequestId(req.body.request_id),
          consent_version: "personal-myth-v1",
          answers: storyInputs,
        };
        return handlePersonalMyth(req, res);
      }
      const apiKey = process.env.GEMINI_API_KEY;
      
      console.log(`SERVER LOG: Generating for mode=${mode}. Key exists: ${!!apiKey}`);

      let deterministicMirror;
      if (mode === "code") {
        deterministicMirror = generateFirstMirror(calc);
      }

      if (!apiKey || apiKey === "YOUR_GEMINI_API_KEY" || apiKey.length < 10 || apiKey.includes("API_KEY")) {
        console.error("Developer Log: Gemini request bypassed: invalid or missing API key.");
        if (mode === "code") {
           return res.status(200).json({ 
             mode,
             status: "demo",
             code_result: { first_mirror: deterministicMirror },
             ui: { safe_message: "Показана базовая версия первого слоя. Полная персональная генерация доступна в Большом исследовании." }
           });
        }
        return res.status(200).json({ 
          mode,
          status: "demo",
          ui: { safe_message: "Сейчас доступна демонстрационная версия." }
        });
      }

      const ai = new GoogleGenAI({ apiKey });
      
      // Read AGENTS.md and SKILLS
      const agentsPrompt = await fs.readFile(path.join(process.cwd(), 'AGENTS.md'), 'utf-8').catch(() => '');
      const skill13 = await fs.readFile(path.join(process.cwd(), 'skills/VYAZEMSKY__SKILL_13__EDITORIAL_STYLE_v1.md'), 'utf-8').catch(() => '');
      
      const strictGrammarPrompt = `
ОЧЕНЬ ВАЖНО: Твои тексты должны быть безупречны с точки зрения орфографии, пунктуации и грамматики русского языка. 
Пользователи жалуются на ошибки в окончаниях, склонениях, спряжениях и построении предложений (в т.ч. деепричастных оборотах).
Твоя задача — выступать в роли профессионального литературного редактора. 
1. Проверяй каждое согласование падежей, лиц и чисел. Никаких машинных ошибок в окончаниях.
2. Проверяй синтаксис и пунктуацию — запятые, тире, причастные/деепричастные обороты должны быть расставлены по учебнику Розенталя.
3. Стиль должен быть живым, естественным, ясным и точным.
СТРОГО следуй SKILL_13:
${skill13}
`;

      const systemInstruction = `Ты — эксперт проекта «Цифровой Код». Отвечай строго в формате JSON без markdown-оборачивания, валидный JSON.\n\n${agentsPrompt}\n\n${strictGrammarPrompt}`;
      
      let prompt = "";
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
    { "id": "step", "title": "Первый практический шаг", "text": "string" }
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
      } else if (mode === "compatibility") {
        const { date, calc, date2, calc2 } = req.body;
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
        model: 'gemini-3-flash-preview',
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
        console.error("Developer Log: Gemini returned invalid JSON:", responseText);
        if (mode === "code") {
           return res.status(200).json({
             mode,
             status: "ok",
             code_result: { first_mirror: deterministicMirror },
             ui: { safe_message: "Сетевая ошибка LLM. Показана базовая версия первого слоя." }
           });
        }
        return res.status(200).json({
          mode: req.body.mode,
          status: "error",
          ui: { safe_message: "Сервис временно не смог подготовить текст. Расчёт сохранён." }
        });
      }

      res.json(resultJson);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes("API key not valid") || errorMessage.includes("API_KEY_INVALID")) {
        console.error("Developer Log: Gemini request failed: invalid API key.");
      } else {
        console.error("Developer Log: AI Generation Error:", error);
      }
      
      if (req.body.mode === "code") {
         return res.status(200).json({ 
           mode: req.body.mode,
           status: "demo",
           code_result: { first_mirror: generateFirstMirror(req.body.calc) },
           ui: { safe_message: "Сервис LLM недоступен. Показана базовая версия." }
         });
      }

      res.status(200).json({ 
        mode: req.body.mode,
        status: "error",
        ui: { safe_message: "Сервис временно не смог подготовить текстовую интерпретацию. Попробуйте повторить позже." }
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
