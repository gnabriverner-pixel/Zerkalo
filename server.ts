import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs/promises";
import { GoogleGenAI } from "@google/genai";
import "dotenv/config";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", message: "Digital Code Mirror is active." });
  });

  app.post("/api/generate-reading", async (req, res) => {
    try {
      const { date, calc } = req.body;
      const rawApiKey = process.env.GEMINI_API_KEY;
      const apiKey = rawApiKey ? rawApiKey.replace(/['"]/g, '').trim() : undefined;
      
      console.log("SERVER LOG:", apiKey ? `Key exists: ${apiKey.substring(0, 10)}...` : "Key is undefined!");

      if (!apiKey) {
        return res.status(500).json({ error: "Ключ GEMINI_API_KEY не найден. Пожалуйста, зайдите в настройки 'Settings -> Secrets' и добавьте ваш рабочий ключ Google AI Studio." });
      }

      const ai = new GoogleGenAI({ apiKey });
      
      // Read AGENTS.md
      const agentsPrompt = await fs.readFile(path.join(process.cwd(), 'AGENTS.md'), 'utf-8').catch(() => '');
      
      // Read all skills
      const skillsDir = path.join(process.cwd(), 'skills');
      let skillsContent = '';
      try {
        const skillFiles = await fs.readdir(skillsDir);
        for (const file of skillFiles) {
          if (file.endsWith('.md')) {
            const content = await fs.readFile(path.join(skillsDir, file), 'utf-8');
            skillsContent += `\n\n--- SKILL: ${file} ---\n${content}`;
          }
        }
      } catch (e) {
        console.warn("Skills folder not found or empty");
      }

      const systemInstruction = `${agentsPrompt}\n\nKNOWLEDGE BASE:\n${skillsContent}`;
      
      const prompt = `Пользователь запросил PREMIUM_FILE для даты рождения: ${date}.
      
Рассчитанные данные (используй их строго, не пересчитывай):
- Число Души (ЧДш): ${calc.soul} (составное: ${calc.soulComposite})
- Число Пути (ЧП): ${calc.path} (составное: ${calc.pathComposite})
- Число Направления (ЧН): ${calc.direction} (составное: ${calc.directionComposite})
- Число Выражения (ЧВ): ${calc.expression} (составное: ${calc.expressionComposite})
- Число Результата (ЧРз): ${calc.result} (составное: ${calc.resultComposite})
- Детальная Матрица: ${JSON.stringify(calc.detailedMatrix)}

Сгенерируй полный разбор в режиме PREMIUM_FILE, следуя всем правилам AGENTS.md и скиллов.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.7,
        }
      });

      res.json({ reading: response.text });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Неизвестная ошибка";
      
      console.error("AI Generation Error:", errorMessage);

      if (errorMessage.includes("API key not valid")) {
        const rawApiKey = process.env.GEMINI_API_KEY || "";
        const apiKey = rawApiKey.replace(/['"]/g, '').trim();
        return res.status(500).json({ error: `Debug: API KEY INVALID. Key starts with ${apiKey.substring(0, 10)}, length is ${apiKey.length}. Original length was ${rawApiKey.length}. Exact error: ${errorMessage}` });
      }

      if (errorMessage.includes("403") || errorMessage.includes("insufficient authentication")) {
         return res.status(500).json({ error: "Ключ GEMINI_API_KEY не найден или недоступен. Пожалуйста, добавьте его в настройках (Settings -> Secrets)." });
      }
      
      if (errorMessage.includes("429") || errorMessage.includes("quota")) {
        return res.status(500).json({ error: "Превышен лимит запросов к API (Quota Exceeded). Пожалуйста, проверьте биллинг вашего ключа или попробуйте позже." });
      }

      if (errorMessage.includes("503") || errorMessage.includes("high demand")) {
        return res.status(500).json({ error: "Серверы Google сейчас перегружены (High Demand). Пожалуйста, попробуйте через несколько минут." });
      }
      
      res.status(500).json({ error: `Ошибка создания зеркала: ${errorMessage}` });
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
