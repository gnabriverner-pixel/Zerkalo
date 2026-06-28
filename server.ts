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

function buildDeterministicStory(inputs: any) {
  const tension = (inputs.q1 || "тихое ожидание").trim();
  const image = (inputs.q2 || "туманный ориентир").trim();
  const strength = (inputs.q3 || "момент внутренней тишины").trim();
  const resource = (inputs.q4 || "ясность").trim();

  return {
    title: "Путь к Тихому Источнику",
    story: `В одном старом краю, где холмы плавно переходят в вечерние сумерки, жил путник. Долгое время внутри него жило странное чувство — ${tension.toLowerCase()}. Оно то угасало, то разгоралось вновь, требуя внимания на каждом перекрестке. Под шагами шуршала сухая листва, а воздух пах остывающей землей.\n\nОднажды на развилке лесных троп, где свет сквозь кроны деревьев ложился длинными полосами, путник встретил образ, похожий на «${image}». Вокруг царила глубокая тишина, лишь изредка прерываемая далеким вздохом ветра. Путник не стал бороться, бежать или искать объяснения. Вместо этого он просто сел рядом на поваленное дерево, почувствовав прохладу и шершавость старой коры под ладонью. Он дал этому образу место в своей дорожной сумке и тепло, шепотом, поблагодарил за то, что тот все это время оберегал его от слишком резких шагов.\n\nПостепенно, в тишине признания и глубокого покоя, образ начал мягко меняться, словно тающий туман под первыми лучами солнца. В этот момент путник обнаружил в глубине себя нечто самое ценное и неприкосновенное — свою врожденную силу и право просто быть. Это высвободило то самое качество, которого так не хватало путнику в пути — «${resource}».\n\nВспоминая «${strength}», путник почувствовал, как возвращается его истинная сила и уверенность. И теперь не важно, сделает он новый шаг сейчас или немного позже, когда тени станут еще длиннее — его внутренняя опора всегда остается с ним.`,
    mirror: {
      mainImage: image,
      innerTension: tension,
      hiddenResource: resource,
      newView: strength
    },
    meaning: [
      `Образ «${image}» отражает глубинную потребность в трансформации.`,
      `Состояние «${tension}» служит сигналом о том, что старые методы требуют пересмотра.`,
      `Ваша точка силы «${strength}» — это надежный якорь для восстановления ресурса.`,
      `Качество «${resource}» указывает на точное направление для первого шага.`
    ],
    one_step: `Позвольте себе уделить 15 минут тишины, чтобы просто побыть с качеством «${resource}» и записать одну мысль.`,
    journal_question: `Что изменится в моих действиях завтра, если я впущу немного больше качества «${resource}»?`,
    disclaimer: "Информационно-аналитический формат. Не является медицинским заключением."
  };
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
      const llmApiKey = process.env.LLM_API_KEY;
      
      const hasGemini = apiKey && apiKey !== "YOUR_GEMINI_API_KEY" && apiKey.length >= 10 && !apiKey.includes("API_KEY");
      const hasOpenAi = llmApiKey && llmApiKey.length > 5;

      console.log(`SERVER LOG: Generating for mode=${mode}. Gemini key exists: ${!!hasGemini}. OpenAI key exists: ${!!hasOpenAi}`);

      let deterministicMirror;
      if (mode === "code") {
        deterministicMirror = generateFirstMirror(calc);
      }

      if (!hasGemini && !hasOpenAi) {
        console.warn("Developer Log: LLM request bypassed: both Gemini and OpenAI-compatible keys are missing.");
        if (mode === "code") {
           return res.status(200).json({ 
             mode,
             status: "demo",
             code_result: { first_mirror: deterministicMirror },
             ui: { safe_message: "Показана базовая версия первого слоя. Полная персональная генерация доступна в Большом исследовании." }
           });
        }
        
        // For story mode, generate a beautiful personalized deterministic story fallback instead of an empty screen!
        const compiledStory = buildDeterministicStory(storyInputs);
        return res.status(200).json({
          mode,
          status: "ok",
          story_result: compiledStory,
          ui: { safe_message: "Показан базовый образный слой. Полная индивидуальная настройка доступна в Телеграм." }
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
1. Эмоционально-образная терапия Линде (ЭОТ) — Телесно-образный мост:
   - Рассматривай Q1 (${storyInputs.q1}) как соматический адрес в теле (мышечный блок, сжатие, холод), а Q2 (${storyInputs.q2}) как его символическую визуализацию.
   - Не воюй с образом из Q2. В шагах 5-7 сказки герой должен встретиться с ним. Он не пытается его прогнать, а садится рядом, дает ему место в пространстве («парадоксальное разрешение») и благодарит за защитную функцию (образ оберегал героя от боли/поспешных решений).
   - Интегрируй отчужденную часть: через признание ценности образа происходит его трансформация (тьма переходит в свет, тяжесть в легкость, холод в тепло, застывшее состояние становится живым и текучим). Это высвобождает внутреннюю целостность и скрытый ресурс из Q4 (${storyInputs.q4}).
2. Эриксоновский гипноз — Лингвистическое ведение:
   - Соблюдай ритм дыхания в тексте: чередуй длинные плавные предложения (вдох) с короткими лаконичными фразами (выдох). Используй переносы абзацев как паузы для тишины.
   - Засевай ресурс (seeding): на протяжении первых абзацев сказки рассыпай слова-ресурсы (покой, тепло, опора, доверие), чтобы они раскрылись в кульминации.
   - Используй пресуппозиции («когда ты почувствуешь...», а не «если»), косвенные внушения («можно заметить, как внутри постепенно просыпается тихий свет») и двойные связки («ты можешь сделать этот шаг медленно или позволить ему случиться самому — в любом случае движение начинается»).
   - Избегай любого директивного или поучающего тона.
3. Юнгианский путь Самости и Архетипы:
   - Сказка — это процесс индивидуации героя. Герой не уничтожает Тень (образ напряжения), а ассимулирует ее силу.
   - Раскрой глубокое ощущение нерушимой Самости (Self) — внутреннего центра тишины, личной суверенности и врожденного благородства, который всегда цел и невредим, независимо от внешних бурь.
4. Сказкотерапия — Возвращение любви к жизни:
   - Транслируй веру в хорошее, оптимизм, любовь к жизни, теплое отношение к себе (доброжелательность) и доверие к миру.
   - Победа героя — это внутреннее изменение отношения к миру, а не физическое уничтожение врага. Итоговый «Дар» — это качество души героя, которое всегда принадлежало ему, но было забыто.
   - Мягко сплетай древнегреческого даймона (судьбу-проводника) и чистоту утренней зари с ведическим законом Дхармы (путь порядка) и Агни (священный огонь внутри).
5. Метод Демидова — Спонтанность и внимание:
   - Устрани надуманное морализаторство. Герой не совершает насилия над собой, его внимание естественно и свободно, он реагирует спонтанно на импульсы природы (шорох ветра, тепло камня).
   - Сюжет разворачивается органически, как непрерывный поток живой жизни.
6. Высокое художественное мастерство и чувственность (VAK):
   - Пиши на уровне классической поэтической прозы (в стиле магического реализма Борхеса или Бунина). Избегай плоских штампов и банальных метафор. Каждый образ должен быть чувственным, объемным и осязаемым.
   - Обязательно сочетай в каждой ключевой сцене три модальности (VAK):
     * Визуальную (тончайшие переливы света, длина предвечерних теней, форма и цвет облаков).
     * Аудиальную (звуки шагов по сухим листьям, треск остывающего очага, шепот трав, паузы безмолвия).
     * Кинестетическую (прохлада росы на пальцах, вес дорожного плаща, плотность воздуха, тепло согретого дерева).
   - Сделай сказку по-настоящему объемной, развернутой и чувственной (целевой размер: 800-1100 слов), чтобы читатель испытывал сильный эмоциональный отклик и глубоко погружался в атмосферу истории.

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

      let responseText = "";
      if (hasGemini) {
        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: prompt,
          config: {
            systemInstruction: systemInstruction,
            temperature: 0.7,
          }
        });
        responseText = response.text || "{}";
      } else if (hasOpenAi) {
        const llmBaseUrl = process.env.LLM_BASE_URL || "https://api.deepseek.com";
        const llmModel = process.env.LLM_MODEL || "deepseek-chat";
        console.log(`SERVER LOG: Generating using OpenAI endpoint: ${llmBaseUrl} with model ${llmModel}`);
        
        const openAiRes = await fetch(`${llmBaseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${llmApiKey}`
          },
          body: JSON.stringify({
            model: llmModel,
            messages: [
              { role: 'system', content: systemInstruction },
              { role: 'user', content: prompt }
            ],
            temperature: 0.7,
            response_format: { type: 'json_object' }
          })
        });

        if (!openAiRes.ok) {
          const errText = await openAiRes.text();
          throw new Error(`OpenAI-compatible LLM gateway returned status ${openAiRes.status}: ${errText}`);
        }

        const openAiData = await openAiRes.json();
        responseText = openAiData.choices?.[0]?.message?.content || "{}";
      }

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
