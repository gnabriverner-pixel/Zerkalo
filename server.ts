import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs/promises";
import nodeFs from "fs";
import "dotenv/config";
import { generateFullInterpretationPayload, generateFirstMirror } from "./src/services/interpretation";
import { buildPersonalMythPrompt } from "./src/services/mythPrompts";
import { AB_FIXTURES } from "./src/data/abFixtures";
import { StoryInputs } from "./src/types";
import { DeepSeekClient } from "./server/deepseek";
import {
  DeepSeekMythProvider,
  PERSONAL_MYTH_WRITER_VERSION,
  containsCrisisLanguage,
  generatePersonalMyth,
  parsePersonalMythRequest,
} from "./server/myth";
import { generateMeetingOfMirrors } from "./server/meeting";
import { generateAlbertDialogue } from "./server/albert";
import crypto from "crypto";
import { calculateCanonicalDigitalCode } from "./server/dcsBridge";
import { createContinuationClaim } from "./server/handoff";
import { registerDeletionScope, executeDataDeletion } from "./server/deletion";

const PERSONAL_MYTH_MODEL = process.env.PERSONAL_MYTH_MODEL || "deepseek-v4-pro";
const MEETING_MODEL = process.env.MEETING_MODEL || "deepseek-v4-pro";
const ALBERT_MODEL = process.env.ALBERT_MODEL || "deepseek-v4-pro";

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
  const deepseekClient = new DeepSeekClient(process.env);
  const mythProvider = new DeepSeekMythProvider(process.env, deepseekClient);
  const personalMythTimeoutMs = Math.min(90_000, Math.max(10_000, Number(process.env.PERSONAL_MYTH_TIMEOUT_MS) || 45_000));
  const mythCache = new Map<string, { expiresAt: number; payload: unknown }>();
  const mythRate = new Map<string, { windowStartedAt: number; count: number }>();

  // Schema reference: "status": "crisis", "story_result": { "mirror": { "mainImage": "", "innerTension": "" } }
  app.use(express.json({ limit: "5mb" }));

  function getPackageReleaseInfo(): Record<string, any> | null {
    const cwd = process.cwd();
    const candidates = [
      path.resolve(cwd, "dist", "release.json"),
      path.resolve(cwd, "release.json"),
      path.resolve(cwd, "dist", "package_manifest.json"),
      path.resolve(cwd, "package_manifest.json"),
    ];
    for (const p of candidates) {
      if (nodeFs.existsSync(p)) {
        try {
          const data = JSON.parse(nodeFs.readFileSync(p, "utf-8"));
          if (data && (data.release_sha || data.releaseSha)) {
            return data;
          }
        } catch {}
      }
    }
    return null;
  }

  app.get("/health", (req, res) => {
    const releaseInfo = getPackageReleaseInfo();
    const candidateSha =
      process.env.RELEASE_SHA ||
      process.env.APP_GIT_SHA ||
      releaseInfo?.release_sha ||
      releaseInfo?.releaseSha ||
      "u1-candidate-dev";
    const isDirty = releaseInfo?.dirty ?? false;

    res.json({
      status: "ok",
      service: "zerkalo",
      version: releaseInfo?.target_version || releaseInfo?.version || "1.0.0-u1",
      release_sha: candidateSha,
      releaseSha: candidateSha,
      dirty: isDirty,
      components: {
        web: "active",
        dcs_bridge: "active",
        albert: "digital-code-system/telegram_v2.albert.orchestrator",
        telegram_v2_continuity: "SharedContextEnvelopeV1",
      },
      models: {
        personalMyth: PERSONAL_MYTH_MODEL,
        meeting: MEETING_MODEL,
        synthesis: MEETING_MODEL,
        albert: ALBERT_MODEL,
      },
      google_production_dependency: "none",
    });
  });

  app.get("/health/ready", (req, res) => {
    const ready = deepseekClient.isReady();
    res.status(ready ? 200 : 503).json({
      status: ready ? "ready" : "not_ready",
      service: "zerkalo",
      release_sha: process.env.RELEASE_SHA || process.env.APP_GIT_SHA || "u1-candidate-dev",
      providers: {
        personal_myth: {
          ready,
          provider: "deepseek",
          model: PERSONAL_MYTH_MODEL,
          writer: PERSONAL_MYTH_WRITER_VERSION,
        },
        meeting: {
          ready,
          provider: "deepseek",
          model: MEETING_MODEL,
        },
        albert: {
          ready,
          provider: "deepseek",
          model: ALBERT_MODEL,
        },
      },
      google_production_dependency: "none",
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
        resonatedMost: bounded(req.body?.resonatedMost, 1000),
        feltForeign: bounded(req.body?.feltForeign, 1000),
        userNote: bounded(req.body?.userNote, 2000),
        provenance: {
          hasCodeResult: Boolean(req.body?.hasCodeResult),
          hasStoryResult: Boolean(req.body?.hasStoryResult),
          hasSynthesisResult: Boolean(req.body?.hasSynthesisResult),
        },
      };

      const feedbackDir = path.join(process.cwd(), "data", "feedback");
      await fs.mkdir(feedbackDir, { recursive: true });
      await fs.writeFile(
        path.join(feedbackDir, `${feedback.id}.json`),
        JSON.stringify(feedback, null, 2),
        "utf-8"
      );

      return res.status(200).json({ status: "ok", feedbackId: feedback.id });
    } catch (error) {
      console.error("Developer Log: Feedback submission error:", error);
      return res.status(500).json({
        status: "error",
        ui: { safe_message: "Не удалось сохранить отзыв. Ваши результаты сессии остаются доступны." }
      });
    }
  });

  // Dedicated Production Endpoint for Personal Myth
  app.post("/api/personal-myth", async (req, res) => {
    try {
      const now = Date.now();
      const clientKey = req.ip || "unknown";
      const currentRate = mythRate.get(clientKey);
      const maxRequests = process.env.NODE_ENV === "production" ? 5 : 100;
      if (!currentRate || now - currentRate.windowStartedAt > 10 * 60_000) {
        mythRate.set(clientKey, { windowStartedAt: now, count: 1 });
      } else if (currentRate.count >= maxRequests) {
        return res.status(429).json({
          mode: "story",
          status: "error",
          code: "rate_limit_exceeded",
          ui: { safe_message: "Превышен лимит запросов. Попробуйте через 10 минут." },
        });
      } else {
        currentRate.count += 1;
      }

      const reqBody = parsePersonalMythRequest(req.body);
      if (containsCrisisLanguage(reqBody.answers)) {
        return res.status(200).json({
          mode: "story",
          status: "crisis",
          ui: {
            safe_message:
              "Похоже, сейчас важнее не образная история, а живая поддержка. Обратитесь к близкому человеку рядом или к профильному специалисту в вашем регионе. Если есть непосредственная опасность — свяжитесь с экстренной службой.",
          },
        });
      }

      const cacheKey = JSON.stringify(reqBody.answers);
      const cached = mythCache.get(cacheKey);
      if (cached && cached.expiresAt > now) {
        return res.status(200).json(cached.payload);
      }

      if (!deepseekClient.isReady()) {
        return res.status(503).json({
          mode: "story",
          status: "error",
          code: "personal_myth_provider_not_ready",
          ui: {
            safe_message: "Личный миф временно недоступен (провайдер генерации не настроен). Ваши ответы сохранены.",
          },
        });
      }

      const generated = await generatePersonalMyth(reqBody, mythProvider, personalMythTimeoutMs);
      const payload = {
        mode: "story",
        status: "ok",
        provider: "deepseek",
        model: PERSONAL_MYTH_MODEL,
        writer_version: PERSONAL_MYTH_WRITER_VERSION,
        story_result: generated.result,
        qa: {
          passed: generated.quality.passed,
          word_count: generated.quality.word_count,
          repaired: generated.repaired,
        },
      };

      mythCache.set(cacheKey, { expiresAt: now + 5 * 60_000, payload });
      return res.status(200).json(payload);
    } catch (error) {
      const code = error instanceof Error ? error.message.split(":", 1)[0] : "personal_myth_failed";
      const inputError = code.startsWith("invalid_");
      const notReady = code === "personal_myth_provider_not_ready";
      console.error("Personal Myth generation failed:", code);
      return res.status(inputError ? 400 : notReady ? 503 : 502).json({
        mode: "story",
        status: "error",
        code,
        ui: {
          safe_message: inputError
            ? "Проверь, что на все четыре вопроса дан короткий ответ."
            : notReady
            ? "Личный миф временно недоступен (провайдер генерации не настроен). Твои ответы сохранены."
            : "Историю не удалось сложить достаточно точно. Ответы сохранены — можно повторить попытку.",
        },
      });
    }
  });

  // Dedicated Meeting of Mirrors Endpoint (Independent synthesis via DeepSeek)
  const meetingHandler = async (req: express.Request, res: express.Response) => {
    try {
      const { codeData, storyData } = req.body;

      if (!codeData || !codeData.calc || !storyData || !storyData.storyInputs || !storyData.storyResult) {
        return res.status(200).json({
          status: "error",
          ui: { safe_message: "Для встречи зеркал необходимы готовые результаты обеих линз (Цифрового Кода и Личного Мифа)." }
        });
      }

      if (!deepseekClient.isReady()) {
        return res.status(503).json({
          status: "error",
          code: "meeting_provider_not_ready",
          ui: { safe_message: "Встреча зеркал сейчас недоступна (провайдер генерации не настроен). Ваши результаты сохранены — попробуйте снова позже." }
        });
      }

      const result = await generateMeetingOfMirrors({
        codeData,
        storyData,
        client: deepseekClient,
        model: MEETING_MODEL,
        totalBudgetMs: 48_000,
      });

      return res.status(200).json(result);
    } catch (error) {
      const code = error instanceof Error ? error.message.split(":", 1)[0] : "meeting_failed";
      const notReady = code === "meeting_provider_not_ready";
      console.error("Developer Log: Meeting of Mirrors error:", code, error);
      return res.status(notReady ? 503 : 502).json({
        status: "error",
        code,
        ui: {
          safe_message: notReady
            ? "Встреча зеркал сейчас недоступна (провайдер генерации не настроен). Ваши результаты сохранены — попробуйте снова позже."
            : "Не удалось провести надёжное сопоставление зеркал. Ваши результаты сохранены — попробуйте снова позже.",
        }
      });
    }
  };

  app.post("/api/meeting-of-mirrors", meetingHandler);
  app.post("/api/lab/meeting/generate", meetingHandler);

  // Canonical Calculation Endpoint (digital-code-system authority)
  app.post("/api/calculate", async (req, res) => {
    try {
      const dob = String(req.body?.dob || "").trim();
      const result = await calculateCanonicalDigitalCode(dob);
      return res.status(200).json({ status: "ok", result });
    } catch (err: any) {
      const isUnavailable = err?.message?.includes("dcs_canonical_engine_unavailable");
      return res.status(isUnavailable ? 503 : 400).json({
        status: "error",
        code: isUnavailable ? "dcs_canonical_engine_unavailable" : "invalid_input",
        message: isUnavailable ? "Канонический сервис расчёта временно недоступен" : err.message,
      });
    }
  });

  // Continuation Claim Handoff Endpoint (Web -> Telegram V2)
  app.post("/api/handoff/create-claim", async (req, res) => {
    try {
      const { codeResult, storyResult, meetingResult, consent, ageVerified } = req.body || {};
      const claim = await createContinuationClaim({
        codeResult,
        storyResult,
        meetingResult,
        consent: Boolean(consent),
        ageVerified: Boolean(ageVerified),
      });
      return res.status(200).json({ status: "ok", ...claim });
    } catch (err: any) {
      const msg = err?.message || "claim_creation_failed";
      const isInput = msg.includes("consent_required") || msg.includes("age_requirement") || msg.includes("journey_incomplete");
      return res.status(isInput ? 400 : 500).json({ status: "error", code: msg.split(":", 1)[0], message: msg });
    }
  });

  // Privacy: Session Registration Endpoint
  app.post("/api/privacy/register-session", (req, res) => {
    try {
      const token = req.body?.token || crypto.randomBytes(24).toString("hex");
      const { anonymousId, sessionToken } = req.body || {};
      registerDeletionScope(token, { anonymousId, sessionToken });
      return res.status(200).json({ status: "ok", token });
    } catch (err: any) {
      return res.status(500).json({ status: "error", message: err.message });
    }
  });

  // Privacy: Fail-closed Deletion Endpoint
  app.post("/api/delete-data", async (req, res) => {
    try {
      const token = String(req.body?.token || "").trim();
      const result = await executeDataDeletion(token);
      if (result.status === "error") {
        const isInput = result.code === "invalid_token" || result.code === "deletion_scope_not_found";
        return res.status(isInput ? 400 : 503).json(result);
      }
      return res.status(200).json(result);
    } catch (err: any) {
      return res.status(503).json({ status: "error", code: "deletion_incomplete", retryable: true, message: err.message });
    }
  });

  // Dedicated Albert Dialogue Endpoint (RP-1 DeepSeek conversation)
  const albertHandler = async (req: express.Request, res: express.Response) => {
    try {
      const message = String(req.body?.message || "").trim();
      if (!message) {
        return res.status(400).json({
          status: "error",
          code: "invalid_message",
          ui: { safe_message: "Пожалуйста, введите текст вопроса для Альберта." }
        });
      }

      if (!deepseekClient.isReady()) {
        return res.status(503).json({
          status: "error",
          code: "albert_provider_not_ready",
          ui: { safe_message: "Собеседник Альберт сейчас недоступен (провайдер генерации не настроен). Ваши результаты сохранены." }
        });
      }

      const dialogueRes = await generateAlbertDialogue(
        req.body,
        deepseekClient,
        ALBERT_MODEL,
        30_000
      );

      return res.status(200).json(dialogueRes);
    } catch (error) {
      const code = error instanceof Error ? error.message.split(":", 1)[0] : "albert_failed";
      const inputError = code === "invalid_message";
      const notReady = code === "albert_provider_not_ready";
      console.error("Developer Log: Albert dialogue error:", code, error);
      return res.status(inputError ? 400 : notReady ? 503 : 502).json({
        status: "error",
        code,
        ui: {
          safe_message: inputError
            ? "Пожалуйста, сформулируйте вопрос для продолжения беседы."
            : notReady
            ? "Собеседник Альберт сейчас недоступен (провайдер генерации не настроен). Ваши результаты сохранены."
            : "Не удалось получить ответ от собеседника. Ваши результаты сохранены — попробуйте повторить вопрос.",
        }
      });
    }
  };

  app.post("/api/albert/dialogue", albertHandler);
  app.post("/api/lab/albert/dialogue", albertHandler);

  // Backward-compatible endpoint for deterministic code calculation
  app.post("/api/generate", async (req, res) => {
    try {
      const { mode, calc, storyInputs } = req.body;
      if (mode === "code" && calc) {
        const deterministicMirror = generateFirstMirror(calc);
        return res.status(200).json({
          mode: "code",
          status: "ok",
          code_result: { first_mirror: deterministicMirror }
        });
      }

      if (mode === "story" && storyInputs && isCrisisInput(storyInputs)) {
        return res.status(200).json({
          mode: "story",
          status: "crisis",
          ui: {
            safe_message: "Похоже, сейчас важнее не образная история, а живая поддержка. Обратитесь к близкому человеку рядом или к профильному специалисту в вашем регионе. Если есть непосредственная опасность — свяжитесь с экстренной службой."
          }
        });
      }

      return res.status(200).json({
        mode,
        status: "ok",
        ui: { safe_message: "Запрос обработан в рамках рабочей сессии." }
      });
    } catch (error) {
      console.error("Developer Log: /api/generate error:", error);
      return res.status(500).json({ status: "error" });
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
