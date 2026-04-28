import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs/promises";
import { GoogleGenAI } from "@google/genai";
import "dotenv/config";

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

  app.post("/api/generate", async (req, res) => {
    try {
      const { mode, date, calc, storyInputs } = req.body;
      const apiKey = process.env.GEMINI_API_KEY;
      
      console.log(`SERVER LOG: Generating for mode=${mode}. Key exists: ${!!apiKey}`);

      if (!apiKey || apiKey === "YOUR_GEMINI_API_KEY" || apiKey.length < 10 || apiKey.includes("API_KEY")) {
        console.error("Developer Log: Gemini request failed: invalid API key.");
        return res.status(200).json({ 
          mode,
          status: "demo",
          ui: { safe_message: "Сейчас доступна демонстрационная версия истории. Полная персональная генерация будет доступна после подключения сервиса." }
        });
      }

      const ai = new GoogleGenAI({ apiKey });
      
      // Read AGENTS.md
      const agentsPrompt = await fs.readFile(path.join(process.cwd(), 'AGENTS.md'), 'utf-8').catch(() => '');
      
      const systemInstruction = `Ты — старший продукт-дизайнер и AI-стратег проекта «Зеркало». Отвечай строго в формате JSON без markdown-оборачивания, валидный JSON.\n\n${agentsPrompt}`;
      
      let prompt = "";
      if (mode === "code") {
        prompt = `Пользователь запросил короткое зеркало для "Архитектуры Кода". Дата: ${date}.
Рассчитанные данные: Душа ${calc.soul}, Путь ${calc.path}, Направление ${calc.direction}, Выражение ${calc.expression}, Результат ${calc.result}.

Сгенерируй короткое "Первое зеркало" (3-5 предложений, не generic, без мистики, с опорой на числа, один практический вывод).
Верни JSON:
{
  "mode": "code",
  "status": "ok",
  "code_result": { "mirror_text": "твой текст" }
}`;
      } else if (mode === "story") {
        prompt = `Пользователь запросил "Личный миф". Ответы на вопросы:
1. Что происходит: ${storyInputs.q1}
2. Предмет/стихия: ${storyInputs.q2}
3. Момент на своем месте: ${storyInputs.q3}
4. Чего хочется: ${storyInputs.q4}

Проверь на SAFETY: Если текст содержит угрозу жизни, насилие или острый кризис, верни:
{ "mode": "story", "status": "crisis", "ui": { "safe_message": "Это образная история для саморефлексии. Она не является терапией... Если вы в остром кризисе, обратитесь к специалисту." } }

Иначе сгенерируй сказку по структуре (Мир, стихия, попытка, остановка, узнавание, ресурс, изменение, финал). Без морали, без happy end, без "всё будет хорошо". Взрослый образный язык.
Верни JSON:
{
  "mode": "story",
  "status": "ok",
  "story_result": {
    "title": "название сказки",
    "story": "полный текст сказки (с абзацами, используй \\n\\n)",
    "meaning": [
      "Что означает главный образ...",
      "Что означает препятствие...",
      "Что означает ресурс...",
      "Где находится первый поворот..."
    ],
    "one_step": "одно простое действие на сегодня",
    "journal_question": "Какой момент в этой истории отозвался сильнее всего?"
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
        return res.status(200).json({
          mode: req.body.mode,
          status: "error",
          ui: {
            safe_message: "Сервис временно не смог подготовить текстовую интерпретацию. Расчёт сохранён. Попробуйте повторить позже."
          }
        });
      }

      res.json(resultJson);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes("API key not valid") || errorMessage.includes("API_KEY_INVALID")) {
        console.error("Developer Log: Gemini request failed: invalid API key.");
        return res.status(200).json({ 
          mode: req.body.mode,
          status: "demo",
          ui: { safe_message: "Сейчас доступна демонстрационная версия истории. Полная персональная генерация будет доступна после подключения сервиса." }
        });
      } else {
        console.error("Developer Log: AI Generation Error:", error);
      }
      res.status(200).json({ 
        mode: req.body.mode,
        status: "error",
        ui: { safe_message: "Сервис временно не смог подготовить текстовую интерпретацию. Расчёт сохранён. Попробуйте повторить позже." }
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
