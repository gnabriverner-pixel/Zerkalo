import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs/promises";
import https from "https";
import { GoogleGenAI } from "@google/genai";
import "dotenv/config";
import { generateFullInterpretationPayload, generateFirstMirror } from "./src/services/interpretation";

/**
 * Send a Telegram notification to the admin about a new lead.
 * Non-blocking: failures are logged but never affect the user response.
 * Requires TELEGRAM_BOT_TOKEN and TELEGRAM_ADMIN_CHAT_ID in .env.
 */
async function notifyAdminTelegram(lead: { name: string; birthDate: string; contact: string; request?: string; source?: string }) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;

  if (!token || !chatId) return; // graceful skip if not configured

  const text = [
    `🔔 Новая заявка на Большое исследование`,
    ``,
    `👤 Имя: ${lead.name}`,
    `📅 Дата рождения: ${lead.birthDate}`,
    `📱 Контакт: ${lead.contact}`,
    lead.request ? `💬 Запрос: ${lead.request}` : null,
    lead.source ? `📍 Источник: ${lead.source}` : null,
    ``,
    `🕐 ${new Date().toLocaleString("ru-RU", { timeZone: "Europe/Moscow" })}`,
  ].filter(Boolean).join("\n");

  const payload = JSON.stringify({
    chat_id: chatId,
    text,
    parse_mode: "HTML",
  });

  return new Promise<void>((resolve) => {
    const req = https.request(
      `https://api.telegram.org/bot${token}/sendMessage`,
      { method: "POST", headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) } },
      (res) => {
        res.resume(); // drain
        if (res.statusCode !== 200) {
          console.error(`Developer Log: Telegram notification failed with status ${res.statusCode}`);
        }
        resolve();
      }
    );
    req.on("error", (err) => {
      console.error("Developer Log: Telegram notification error:", err.message);
      resolve(); // never throw
    });
    req.write(payload);
    req.end();
  });
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

  app.get("/health", (req, res) => {
    res.json({
      status: "ok",
      service: "zerkalo",
      version: "0.1.0"
    });
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

      // Non-blocking Telegram notification to admin
      notifyAdminTelegram(lead).catch(() => {});

      res.status(200).json({
        status: "ok",
        ui: {
          safe_message: "Заявка принята. Я свяжусь с вами в Telegram и уточню детали Большого исследования."
        }
      });
    } catch (error) {
      console.error("Developer Log: Failed to save lead:", error);
      // Even if file writing fails, we acknowledge to the user successfully
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
      const mythContract = await fs.readFile(path.join(process.cwd(), 'docs/PERSONAL_MYTH_VOICE_CONTRACT_V1.md'), 'utf-8').catch(() => '');
      const mythRubric = await fs.readFile(path.join(process.cwd(), 'docs/PERSONAL_MYTH_EVAL_RUBRIC_V1.md'), 'utf-8').catch(() => '');
      
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
      } else if (mode === "story") {
        prompt = `Пользователь запросил "Личный миф". Ответы на вопросы:
1. Что происходит внутри (ощущение): ${storyInputs.q1}
2. Предмет/существо/погода: ${storyInputs.q2}
3. Момент на своем месте: ${storyInputs.q3}
4. Чего не хватает: ${storyInputs.q4}

Проверь на SAFETY: Если текст содержит угрозу себе, угрозу другим, потерю контроля, насилие или острое небезопасное состояние, верни СТРОГО:
{ "mode": "story", "status": "crisis", "ui": { "safe_message": "Похоже, сейчас важнее не образная история, а живая поддержка. Обратитесь к человеку рядом или к специалисту в вашем регионе. Если есть непосредственная опасность — обратитесь в экстренную службу." } }

В самом промпте и UI не используй слова: терапия, психотерапия, гипноз, НЛП, лечение, травма, исцеление, диагноз, предсказание, магия.

Выступай в роли Наблюдателя Личного Мифа. Твой голос тихий, отстраненный, поэтический, не имеющий имени, рассказывающий историю о человеке без суждений.
Для генерации строго следуй руководству:
${mythContract}

А также оценивай свой результат по критериям:
${mythRubric}

ОСОБЫЕ МЕТОДОЛОГИЧЕСКИЕ ТРЕБОВАНИЯ:
1. Эмоционально-образная терапия (ЭОТ):
   - Относись к ответу на Q2 (${storyInputs.q2}) как к центральному образу внутреннего состояния.
   - В шагах 5, 6 и 7 сказки герой должен встретить этот образ/объект. Он не убегает, не борется, а садится рядом, дает ему место, благодарит за то, что образ оберегал его (даже если это тяжесть или туман).
   - Образ должен мягко трансформироваться в процессе признания, высвобождая качество, которого сейчас не хватает (Q4: ${storyInputs.q4}).
2. Эриксоновский гипноз:
   - Используй мягкий, успокаивающий, ритмичный слог с длинными паузами.
   - Используй косвенные внушения: "начинает казаться", "постепенно разворачивается", "можно заметить, как", "позволяя происходить".
   - Предлагай двойные связи/выбор: "и не важно, сделает он шаг сейчас или чуть позже, когда тени станут длиннее".
   - Избегай директивных "нужно", "должен", "важно сделать".

Верни JSON:
{
  "mode": "story",
  "status": "ok",
  "story_result": {
    "title": "название сказки",
    "story": "полный текст сказки (с абзацами, используй \\n\\n)",
    "mirror": {
      "mainImage": "string (описание главного образа)",
      "innerTension": "string (описание внутреннего напряжения)",
      "hiddenResource": "string (описание скрытого ресурса)",
      "newView": "string (описание нового взгляда)"
    },
    "meaning": ["string"],
    "one_step": "одно простое действие, мягкий шаг",
    "journal_question": "вопрос для дневника",
    "disclaimer": "Образный формат для саморефлексии. Не диагностика и не инструкция к действию."
  }
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
