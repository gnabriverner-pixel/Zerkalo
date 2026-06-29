import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs/promises";
import https from "https";
import { GoogleGenAI } from "@google/genai";
import "dotenv/config";
import { generateFullInterpretationPayload, generateFirstMirror } from "./src/services/interpretation";
import { buildMythBrief, safetyGate, qualityGate } from "./src/services/story";

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

function buildDeterministicStory(inputs: any, brief?: any) {
  const tension = (inputs.q1 || "тихое ожидание").trim();
  const shadowImage = (inputs.q2 || "туманный силуэт").trim();
  const strength = (inputs.q3 || "момент внутренней тишины").trim();
  const resource = (inputs.q4 || "скрытая ясность").trim();
  
  const gift = brief?.core_gift || "умение видеть суть";
  const motif = brief?.motif || "свет и тишина";

  return {
    title: "Путь к внутреннему ориентиру",
    story: `<!-- такт 1 -->Вокруг тебя расстилается сенсорный, чуть иномирный край. Пахнет сухими травами, озоном и нагретым деревом. Здесь ты — хранитель тишины, тот, в ком живет ${gift}. Под твоими пальцами шероховатая поверхность старого камня, а перед глазами — чистая линия horizons. Это твое место силы.

<!-- такт 2 -->Но вечер опускается, и с моря начинает надвигаться среда, похожая на «${shadowImage}». Она не нападает, не грозит разрушением, а медленно заполняет все низины, сгущаясь и изолируя тебя от остального мира. Воздух становится влажным, прохладным, а контуры вещей размываются.

<!-- такт 3 -->Ты пытаешься бороться привычным способом: закрываешь люки, укрепляешь стены, напрягаешь волю и сжимаешь кулаки, стремясь вернуть контроль. Но помпы не справляются с туманом, а стены не могут удержать то, что не имеет плотности. Твои старые стратегии здесь бессильны, и ты терпишь поражение, упираясь в стену усталости.

<!-- такт 4 -->Обессилев, ты перестаешь бороться. Ты садишься на деревянный порог и позволяешь этой стихии подойти ближе. Ты смотришь ей в лицо и внезапно узнаешь в ней свою собственную силу. Это «${tension.toLowerCase()}» — твоя же нежность без адресата, твоя неизрасходованная глубина, которую ты когда-то вытеснил вовне.

<!-- такт 5 -->В этот момент в твоем теле всплывает живое воспоминание. Ты вспоминаешь «${strength}» — тепло под ключицами, ровное дыхание, ощущение устойчивости под ногами. Твои плечи опускаются, и ты чувствуешь, как пульсирует жизнь.

<!-- такт 6 -->И тогда ты совершаешь символический акт — сжимаешь в ладонях свой символический мотив: ${motif}. И среда вокруг тебя начинает превращаться в проводник. Туман больше не изолирует, он становится мостом, наполняясь мягким свечением.

<!-- такт 7 -->Мир отвечает тебе мгновенным откликом. Шелестят листья, отзывается далекое эхо, соединяя тебя со всем сущим в едином ритме и резонансе. Ты чувствуешь свое врожденное благородство, свою нерушимую Самость.

<!-- такт 8 -->Дверь остается открытой. Туман не исчезает без следа, но меняется твое отношение к нему. Внутри рождается глубокий сдвиг в теле и дыхании, тихое знание о том, что ты больше не одинок на этом берегу.`,
    mirror: {
      mainImage: shadowImage,
      innerTension: tension,
      hiddenResource: resource,
      newView: strength
    },
    meaning: [
      `Образ «${shadowImage}» отражает глубинный вызов и теневой ресурс, требующий принятия.`,
      `Состояние «${tension}» указывает на соматическое напряжение, которое вы пытались контролировать.`,
      `Качество «${resource}» — это ваш скрытый дар, готовый раскрыться через интеграцию.`,
      `Момент «${strength}» служит надежным телесным якорем для восстановления сил.`
    ],
    one_step: `Уделите 5 минут тишины, чтобы положить ладонь на грудь, почувствовать тепло своего дыхания и сказать мысленно: «Я даю этому место».`,
    journal_question: `В какие моменты я пытаюсь бороться силой там, где нужно просто дать место происходящему?`,
    disclaimer: "Образный формат саморефлексии. Не является медицинским заключением."
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

      if (mode === "story" && storyInputs) {
        const safetyResult = safetyGate(storyInputs);
        if (safetyResult.isCrisis) {
          return res.status(200).json({
            mode: "story",
            "status": "crisis",
            ui: { safe_message: safetyResult.safe_message }
          });
        }
      }

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
        const brief = buildMythBrief(calc);
        const compiledStory = buildDeterministicStory(storyInputs, brief);
        // Strip tact comments from deterministic story as well
        compiledStory.story = compiledStory.story.replace(/<!-- такт \d+ -->/g, "").trim();
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

ПРАВИЛА ОЧЕЛОВЕЧИВАНИЯ ТЕКСТА (HUMANIZER RULES):
- Пиши простым, естественным языком. Никаких ИИ-штампов («раскрыть потенциал», «уникальное путешествие», «трансформировать жизнь», «погрузиться в», «ключевой инсайт», «вектор силы», «дорожная карта»).
- Используй короткие, понятные предложения. Убирай лишние прилагательные, наречия и «воду».
- Будь искренним и честным. Говори просто и напрямую. Избегай фальшивого дружелюбия и маркетингового пафоса.
- Пусть текст звучит так, будто его написал живой человек, разговаривающий с другом у костра.
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
        const brief = buildMythBrief(calc);
        prompt = `Ты — мастер сказкотерапии. Ты пишешь персональную сказку-метафору во втором лице («ты»), в настоящем времени, с полным погружением. Читатель — герой сказки.

ВХОДНЫЕ ДАННЫЕ СТРУКТУРНОГО БРИФА ИЗ КОДА (СТРОГО используй их для создания сюжета и образов, но НЕ озвучивай сами термины "дар", "тень", "ресурс", "камертон", "Кету" и т.д.):
- Дар героя (core_gift): ${brief.core_gift}
- Тень героя (shadow): ${brief.shadow}
- Ресурс героя (resource): ${brief.resource}
- Символический мотив (motif): ${brief.motif}
- Главный нерв человека (main_axis): ${brief.main_axis}

ОТВЕТЫ ЧЕЛОВЕКА НА ВВОДНЫЕ ВОПРОСЫ (персонализация, используй как фактуру для метафор):
1. Что сейчас тяжелее всего (момент боли/ситуация): ${storyInputs.q1}
2. Каким стихийным образом/существом выглядит это состояние: ${storyInputs.q2}
3. Чего больше всего не хватает: ${storyInputs.q4}
4. Момент, когда чувствовал себя по-настоящему живым: ${storyInputs.q3}

ЗАДАЧА: Написать сказку на 800–1100 слов строго по 8 тактам. 
ОБЯЗАТЕЛЬНО перед началом каждого такта вставляй в текст скрытый разделитель в формате <!-- такт X --> (где X - номер такта от 1 до 8), чтобы подтвердить структуру.

СТРУКТУРА 8 ТАКТОВ:
1) <!-- такт 1 --> Сенсорный мир-метафора, показывающий дар героя (core_gift) и символический мотив (motif). Насыть запахами, звуками, фактурой.
2) <!-- такт 2 --> Приход тени. Тень входит как стихия или среда, а не как злодей. Она не уничтожает, а заполняет пространство, изолирует и сгущается. Опирайся на образ состояния человека (ответ 2).
3) <!-- такт 3 --> Тщетная борьба. Герой пытается бороться привычным способом (через волевой контроль или бегство) и честно проигрывает. Старая стратегия не работает — покажи это через сенсорику и действия, а не морализаторство.
4) <!-- такт 4 --> Узнавание (Ядро ЭОТ). Обессилев, герой перестает бороться, вступает в прямой контакт с тенью лицом к лицу и узнает в ней свою же отвергнутую энергию/силу (поворот всей сказки). Тень — это его собственный ресурс.
5) <!-- такт 5 --> Ресурс-память (телом). Всплывает телесно прожитое воспоминание ресурсного состояния. Опирайся на ответ человека о "живом моменте" (ответ 4). Прояви через физиологию (тепло под ключицами, глубокий вдох, расслабление плеч).
6) <!-- такт 6 --> Символический акт. Герой действует через свой дар (motif) — и тень-среда превращается в проводник или мост. Отношение меняется, сила интегрируется.
7) <!-- такт 7 --> Отклик. Мир отвечает взаимностью. Возникает резонанс, связь, единство частот, раскрывается врожденное благородство и Самость.
8) <!-- такт 8 --> Открытая дверь. Тень не исчезла — изменилось отношение к ней. Финал дает сдвиг состояния, а не окончательное решение всех жизненных задач. Ощущение покоя, глубокое дыхание, тихое знание.

ПРАВИЛА И ОГРАНИЧЕНИЯ:
- Пиши на уровне классической поэтической прозы в стиле магического реализма (Борхеса или Бунина). Избегай плоских штампов и банальных метафор. Каждый образ должен быть чувственным, объемным и осязаемым.
- Тело и образ важнее абстракции: сенсорика в каждом такте (VAK: визуальные переливы света, звуки шагов по сухим листьям, кинестетическое ощущение плотности воздуха и тепла согретого дерева).
- НИКАКИХ числовых, психологических или эзотерических терминов в тексте сказки (никаких слов: "число", "энергия", "архетип", "Кету", "Венера", "Сатурн", "тень", "ЭОТ" и подобных) — все переводи строго в поэтические образы.
- Никакой морали, поучений, "ты должен", диагнозов, обещаний и гарантий.
- Финал — открытая дверь, не хэппи-энд; разрешение через принятие, не через силу.
- Один сквозной образ, без каши из метафор.

Верни JSON строго по следующей схеме:
{
  "mode": "story",
  "status": "ok",
  "story_result": {
    "title": "название сказки",
    "story": "полный текст сказки (с абзацами, используй \\n\\n и обязательно сохрани разметку <!-- такт X --> перед каждым тактом)",
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
      let resultJson = null;
      let attempts = 0;
      const maxAttempts = 3;

      while (attempts < maxAttempts) {
        attempts++;
        console.log(`SERVER LOG: Generation attempt ${attempts} for mode=${mode}`);

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

        try {
          resultJson = JSON.parse(responseText);
        } catch (parseError) {
          console.error(`Attempt ${attempts} failed to parse JSON:`, responseText);
          if (attempts >= maxAttempts) throw parseError;
          continue;
        }

        // Run qualityGate for story mode
        if (mode === "story" && resultJson.story_result?.story) {
          const check = qualityGate(resultJson.story_result.story);
          if (!check.isValid) {
            console.warn(`Attempt ${attempts} failed qualityGate:`, check.errors);
            if (attempts < maxAttempts) {
              continue;
            }
          }
        }
        
        break;
      }

      // Strip tact comments and text headers before sending back
      if (mode === "story" && resultJson?.story_result?.story) {
        resultJson.story_result.story = resultJson.story_result.story
          .replace(/<!--\s*такт\s*\d+\s*-->/gi, "")
          .replace(/(такт\s*\d+[:.\s-]*)/gi, "")
          .trim();
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
