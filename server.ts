import express from "express";
import {AIBudget,registerAIBudget,financialGuardRequired} from './server/aiBudget';
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";
import nodeFs from "fs";
import "dotenv/config";
import { generateFullInterpretationPayload, generateFirstMirror } from "./src/services/interpretation";
import { buildPersonalMythPrompt } from "./src/services/mythPrompts";
import { AB_FIXTURES } from "./src/data/abFixtures";
import { StoryInputs } from "./src/types";
import { RouterAIClient, PRIMARY_MODEL, MEETING_FALLBACK_MODEL } from "./server/routerai";
import { isWriterV41Enabled, WRITER_V41_MODEL } from "./server/mythWriterV41";
import { resolvePersonalMythWriter } from "./server/mythWriterV2A";
import {
  createRouterAIMythProvider,
  PERSONAL_MYTH_WRITER_VERSION,
  PersonalMythProvider,
  SAFE_CRISIS_MESSAGE,
  containsCrisisLanguage,
  generatePersonalMyth,
  parsePersonalMythRequest,
} from "./server/myth";
import { containsMeetingCrisisInput, generateMeetingOfMirrors } from "./server/meeting";
import { AlbertCanonicalError, checkSafety, generateAlbertDialogue, parseAlbertMessage } from "./server/albert";
import { installChapterOfferRoutes } from "./server/chapterOffer";
import crypto from "crypto";
import { calculateCanonicalDigitalCode, calculateCanonicalCodeV2, probeDcsBridge, purgeCanonicalCaches, deriveCacheKey, bindCanonicalCacheOwner } from "./server/dcsBridge";
import { createContinuationClaim, LOCAL_CANDIDATE_TELEGRAM_UNAVAILABLE_MESSAGE, sweepExpiredClaims } from "./server/handoff";
import { registerDeletionScope, executeDataDeletion, registerCachePurger, registerCacheOwnerBinder, bindSessionCalculationsToToken } from "./server/deletion";
import { personalMythHealthInfo } from './server/mythHealth';
import { recordPathEvent, isPathEvent, prunePathCounters, CLIENT_PATH_EVENTS } from './server/pathCounters';
import { installConsentRoutes, verifyConsent, consentReceiptFromRequest } from './server/consent';
import { installStoryCommerce, type StoryCommerceOptions } from './server/storyCommerce';
import { installLocalStorySetup } from './server/localStorySetup';
import {
  checkAndIncrementRate,
  consumeDailyBudget,
  createRateGuard,
  DAILY_BUDGET_MESSAGE,
  purgeExpiredRateLimits,
  rateBuckets,
  resolveRateMax,
  resolveRateWindowMs,
} from './server/rateLimit';

const PERSONAL_MYTH_MODEL = PRIMARY_MODEL;
const MEETING_MODEL = PRIMARY_MODEL;
const ALBERT_MODEL = PRIMARY_MODEL;
const meetingSynthesisCache = new Map<string, { expiresAt: number; payload: any }>();

export function deriveMeetingCacheKey(codeData: any, storyData: any, userQuestion?: string): string {
  const normalizedQuestion = String(userQuestion ?? storyData?.userQuestion ?? "").trim();
  return crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        calc: codeData?.calc,
        firstMirrorVersion: codeData?.firstMirror?.interpretationVersion || "",
        codeV2Motif: codeData?.codeV2Payload?.central_motif || "",
        storyInputs: storyData?.storyInputs,
        storyTitle: storyData?.storyResult?.title || "",
        storyMirror: storyData?.storyResult?.mirror || {},
        storyMadeOf: storyData?.storyResult?.made_of || [],
        userQuestion: normalizedQuestion,
      }),
    )
    .digest("hex");
}

function isCrisisInput(inputs: StoryInputs): boolean {
  return containsCrisisLanguage(inputs);
}

export interface CreateAppOptions {
  mythProvider?: PersonalMythProvider;
  skipVite?: boolean;
  isProviderReady?: () => boolean;
  storyCommerce?: Partial<StoryCommerceOptions>;
}

export async function createApp(options: CreateAppOptions = {}) {
  registerCachePurger(purgeCanonicalCaches);
  registerCacheOwnerBinder(bindCanonicalCacheOwner);
  const app = express();
  // Trust exactly one hop: the loopback nginx proxy (verified topology — the app binds
  // 127.0.0.1, external access to its port is DROPped by iptables, nginx forwards
  // X-Forwarded-For with $proxy_add_x_forwarded_for). Never `true`/`*`: trusting
  // client-supplied headers would let anyone forge req.ip and defeat per-client quotas.
  // Moving nginx/CDN off this host requires revisiting this line deliberately.
  app.set('trust proxy', 'loopback');
  const deepseekClient = new RouterAIClient(process.env);
  const meetingClient = deepseekClient.withFallback(MEETING_FALLBACK_MODEL);
  // Writers: v2a (default) always uses Opus via RouterAI (DeepSeek fallback is built from the same client); the v4.1 rollback
  // may name its own model (must be one RouterAIClient already allows); legacy keeps the shared client.
  const personalMythWriter = resolvePersonalMythWriter();
  const writerV41Model = personalMythWriter === 'v2a' ? WRITER_V41_MODEL
    : isWriterV41Enabled() ? String(process.env.PERSONAL_MYTH_V41_MODEL ?? '').trim() || WRITER_V41_MODEL : '';
  const mythProvider = options.mythProvider
    || createRouterAIMythProvider(writerV41Model ? new RouterAIClient(process.env, writerV41Model) : deepseekClient);
  const isProviderConfigured = () =>
    options.isProviderReady
      ? options.isProviderReady()
      : options.mythProvider
      ? true
      : deepseekClient.isReady();
  // Legacy path: unchanged 90 s ceiling. Writers: per-call default 180 s for v2a (primary + fallback fit the client's 6 min wait), 240 s for v4.1; ceiling 300 s
  // (PERSONAL_MYTH_V2A_TIMEOUT_MS for v2a, PERSONAL_MYTH_V41_TIMEOUT_MS for the rollback).
  const personalMythTimeoutMs = personalMythWriter !== 'legacy'
    ? Math.min(300_000, Math.max(10_000, Number((personalMythWriter === 'v2a' ? process.env.PERSONAL_MYTH_V2A_TIMEOUT_MS : process.env.PERSONAL_MYTH_V41_TIMEOUT_MS)) || (personalMythWriter === 'v2a' ? 180_000 : 240_000)))
    : Math.min(90_000, Math.max(10_000, Number(process.env.PERSONAL_MYTH_TIMEOUT_MS) || 75_000));
  const mythCache = new Map<string, { expiresAt: number; payload: unknown }>();

  // Operational abuse/cost guards (see server/rateLimit.ts for the topology note).
  // Environment-configurable, no product tiers: defaults leave ordinary use untouched.
  const rateWindowMs = resolveRateWindowMs();
  const personalMythRateMax = resolveRateMax('PERSONAL_MYTH_RATE_MAX', 5);
  const meetingGuard = createRateGuard({
    name: 'meeting',
    maxRequests: resolveRateMax('MEETING_RATE_MAX', 12),
    windowMs: rateWindowMs,
    message: 'Сейчас слишком много запросов к Встрече зеркал. Ваши результаты сохранены — попробуйте через несколько минут.',
  });
  const albertGuard = createRateGuard({
    name: 'albert',
    maxRequests: resolveRateMax('ALBERT_RATE_MAX', 30),
    windowMs: rateWindowMs,
    message: 'Сейчас слишком много запросов к диалогу. Ваши результаты сохранены — попробуйте через несколько минут.',
  });
  // Keeps the client maps bounded on a long-running process.
  prunePathCounters();
  setInterval(() => prunePathCounters(), 24 * 60 * 60_000).unref();
  const ratePurgeTimer = setInterval(() => purgeExpiredRateLimits(Date.now(), rateWindowMs), 60 * 60_000);
  ratePurgeTimer.unref?.();

  // Schema reference: "status": "crisis", "story_result": { "mirror": { "mainImage": "", "innerTension": "" } }
  app.use(express.json({ limit: "5mb" }));
  app.use(express.urlencoded({extended:false,limit:'8kb'}));
  app.get('/privacy', (_req,res)=>res.sendFile(path.resolve('public/privacy.html')));
  app.get('/terms', (_req,res)=>res.sendFile(path.resolve('public/terms.html')));
  installConsentRoutes(app);
  installLocalStorySetup(app);
  const commerce=installStoryCommerce(app,{
    ...options.storyCommerce,
    ready:options.storyCommerce?.ready||isProviderConfigured,
    myth:options.storyCommerce?.myth|| (async body=>{
      const generated=await generatePersonalMyth(body,mythProvider,personalMythTimeoutMs);
      liveGeneration.personal_myth=true;
      return {mode:'story',status:'ok',provider:generated.provider,model:generated.model,
        writer_version:generated.writerVersion??PERSONAL_MYTH_WRITER_VERSION,story_result:generated.result,
        qa:{passed:generated.quality.passed,word_count:generated.quality.word_count,repaired:generated.repaired}};
    }),
    albert:options.storyCommerce?.albert||(async(body,receipt)=>{
      const result=await generateAlbertDialogue(body,deepseekClient,ALBERT_MODEL,45000,receipt);
      if(result.status==='ok')liveGeneration.albert=true;
      return result;
    }),
  });
  registerAIBudget(financialGuardRequired()?new AIBudget(commerce.store,process.env):undefined);
  app.get('/health/commerce',(_req,res)=>res.json({...commerce.readiness(),live_generation_verified_since_start:{...liveGeneration},note:'Configuration and capacity are separate from provider live proof and merchant verification.'}));
  const sweepClaims = () => sweepExpiredClaims().catch(()=>console.warn('claim_retention_sweep_failed'));
  void sweepClaims();
  setInterval(sweepClaims,60_000).unref();

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

  app.get("/health", async (_req, res) => {
    const releaseInfo = getPackageReleaseInfo();
    const candidateSha =
      process.env.RELEASE_SHA ||
      process.env.APP_GIT_SHA ||
      releaseInfo?.release_sha ||
      releaseInfo?.releaseSha ||
      "u1-candidate-dev";
    const isDirty = releaseInfo?.dirty ?? false;
    const dcs = await probeDcsBridge();
    // Probe failures must not fail the whole health endpoint; availability is
    // reported honestly per component instead of as a constant.
    res.json({
      status: "ok",
      service: "zerkalo",
      version: releaseInfo?.target_version || releaseInfo?.version || "1.0.0-u1",
      release_sha: candidateSha,
      releaseSha: candidateSha,
      dirty: isDirty,
      components: {
        web: { state: "active" },
        dcs_bridge: { state: dcs.state, sha: dcs.sha },
        albert: "digital-code-system/telegram_v2.albert.orchestrator",
        telegram_v2_continuity: "SharedContextEnvelopeV1",
      },
      google_production_dependency: "none",
    });
  });

  const liveGeneration = {
    personal_myth: false,
    meeting: false,
    albert: false,
  };

  async function probeCanonicalBridgeHealth() {
    const bridgeUrl = (process.env.DCS_BRIDGE_URL || "http://127.0.0.1:39500").replace(/\/+$/, "");
    const expectedSha = (process.env.DCS_EXPECTED_SHA || "").trim();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);
    try {
      const response = await fetch(`${bridgeUrl}/health`, { signal: controller.signal });
      const data: any = await response.json().catch(() => ({}));
      const actualSha = typeof data?.sha === "string" ? data.sha : null;
      const shaMatches = !expectedSha || actualSha === expectedSha;
      const ok = response.ok && data?.status === "ok" && Boolean(actualSha) && shaMatches;
      return {
        reachable: response.ok,
        expected_sha: expectedSha || null,
        actual_sha: actualSha,
        verified: ok,
      };
    } catch {
      return {
        reachable: false,
        expected_sha: expectedSha || null,
        actual_sha: null,
        verified: false,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  app.get("/health/ready", async (_req, res) => {
    const providerConfigured = isProviderConfigured();
    const releaseInfo = getPackageReleaseInfo();
    const releaseSha =
      process.env.RELEASE_SHA ||
      process.env.APP_GIT_SHA ||
      releaseInfo?.release_sha ||
      releaseInfo?.releaseSha ||
      "u1-candidate-dev";
    const dcs = await probeDcsBridge();
    const bridge = await probeCanonicalBridgeHealth();
    const expectedSha = (process.env.DCS_EXPECTED_SHA || "").trim();
    const bridgeVerified = bridge.verified || (!expectedSha && dcs.state === "ready");
    const canonicalBridge = {
      reachable: bridge.reachable || dcs.state === "ready",
      expected_sha: bridge.expected_sha,
      actual_sha: bridge.actual_sha || (dcs.sha !== "unknown" ? dcs.sha : null),
      verified: bridgeVerified,
    };
    const liveGenerationReady =
      liveGeneration.personal_myth &&
      liveGeneration.meeting &&
      liveGeneration.albert;
    const preflightReady = providerConfigured && canonicalBridge.verified;
    const ready = preflightReady && liveGenerationReady;
    // Operational detail (models, fallback configuration) stays here; the
    // public /health response carries only availability and versions.
    res.status(ready ? 200 : 503).json({
      status: ready ? "ready" : "not_ready",
      ready,
      transport_ready: canonicalBridge.verified,
      provider_configured: providerConfigured,
      preflight_ready: preflightReady,
      service: "zerkalo",
      release_sha: releaseSha,
      canonical_bridge: canonicalBridge,
      live_generation_verified_since_start: liveGenerationReady,
      live_generation: { ...liveGeneration },
      checks: {
        llm_provider: { configured: providerConfigured, ready: providerConfigured && liveGenerationReady, provider: "routerai" },
        dcs_bridge: { ready: canonicalBridge.verified, state: canonicalBridge.verified ? "ready" : "unavailable", sha: canonicalBridge.actual_sha || dcs.sha },
      },
      providers: {
        personal_myth: {
          configured: providerConfigured,
          live_verified: liveGeneration.personal_myth,
          ready: providerConfigured && liveGeneration.personal_myth,
          provider: "routerai",
          ...personalMythHealthInfo(process.env, PERSONAL_MYTH_MODEL),
        },
        meeting: {
          configured: providerConfigured,
          live_verified: liveGeneration.meeting,
          ready: providerConfigured && liveGeneration.meeting,
          provider: "routerai",
          model: MEETING_MODEL,
          fallback_model: "openai/gpt-5.4-mini",
        },
        albert: {
          configured: providerConfigured,
          canonical_bridge_verified: canonicalBridge.verified,
          live_verified: liveGeneration.albert,
          ready: providerConfigured && canonicalBridge.verified && liveGeneration.albert,
          provider: "routerai",
          model: ALBERT_MODEL,
          fallback_model: "anthropic/claude-sonnet-5",
        },
      },
      single_gateway_dependency: "routerai",
      google_production_dependency: "none",
    });
  });

  // Fixtures for A/B testing (internal / development only)
  app.get("/api/ab-fixtures", (_req, res) => {
    if (process.env.NODE_ENV === "production") {
      return res.status(404).json({ status: "error", code: "not_found", message: "Not found" });
    }
    return res.json({
      status: "ok",
      fixtures: AB_FIXTURES
    });
  });

  // Anonymous path counters: name, time and test flag only. No consent needed - no personal data is involved.
  const pathEventBuckets = new Map<string, any>();
  app.post("/api/path-event", (req, res) => {
    const name = req.body?.name;
    if (!isPathEvent(name) || !CLIENT_PATH_EVENTS.includes(name)) {
      return res.status(400).json({ status: "error", code: "path_event_rejected" });
    }
    if (!checkAndIncrementRate(req.ip || "unknown", 120, Date.now(), 10 * 60_000, pathEventBuckets).allowed) {
      return res.status(429).json({ status: "error", code: "rate_limit_exceeded" });
    }
    recordPathEvent(name, process.env.NODE_ENV !== "production" || req.body?.test === true);
    return res.status(204).end();
  });

  // Tester Feedback submission
  // Disabled unless TESTER_FEEDBACK_ENABLED=true: the files are plain text without a retention limit.
  app.post("/api/feedback", async (req, res) => {
    if (process.env.TESTER_FEEDBACK_ENABLED !== "true") {
      return res.status(404).json({ status: "error", code: "feedback_disabled" });
    }
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

  // Tells the client which question set to ask: the opt-in writer v4.1 asks the control-check questions.
  app.get("/api/personal-myth/config", (_req, res) => {
    // example_url: a public example to read, shown on the site only when configured (PERSONAL_MYTH_EXAMPLE_URL: https URL or /path).
    const example = String(process.env.PERSONAL_MYTH_EXAMPLE_URL ?? "").trim();
    res.set("Cache-Control", "no-store").json({
      writer: ({ v2a: "v2a", v41: "v41", legacy: "default" } as const)[resolvePersonalMythWriter()],
      generation_available: isProviderConfigured(),
      example_url: /^(https:\/\/|\/(?!\/))[^\s"'<>]{1,300}$/.test(example) ? example : null,
    });
  });

  // Static page for the Personal Myth example: «Велосипед в сером коридоре»
  app.get(["/primer-lichnogo-mifa", "/primer-lichnogo-mifa/"], (_req, res) => {
    const staticFile = path.join(process.cwd(), "public", "primer-lichnogo-mifa", "index.html");
    const distFile = path.join(process.cwd(), "dist", "primer-lichnogo-mifa", "index.html");
    if (nodeFs.existsSync(staticFile)) {
      return res.sendFile(staticFile);
    }
    if (nodeFs.existsSync(distFile)) {
      return res.sendFile(distFile);
    }
    res.status(404).send("Not found");
  });

  // Dedicated Production Endpoint for Personal Myth
  app.post("/api/personal-myth", async (req, res) => {
    try {
      if (req.body?.answers && typeof req.body.answers === "object" && containsCrisisLanguage(req.body.answers as any)) {
        return res.status(200).json({
          mode: "story",
          status: "crisis",
          ui: {
            safe_message: SAFE_CRISIS_MESSAGE,
          },
        });
      }

      const now = Date.now();
      const clientKey = req.ip || "unknown";
      const rate = checkAndIncrementRate(clientKey, personalMythRateMax, now, rateWindowMs, rateBuckets.myth);
      if (!rate.allowed) {
        res.set("Retry-After", String(rate.retryAfterSec));
        return res.status(429).json({
          mode: "story",
          status: "error",
          code: "rate_limit_exceeded",
          ui: { safe_message: "Превышен лимит запросов. Попробуйте через 10 минут." },
        });
      }

      const reqBody = parsePersonalMythRequest(req.body);
      if (containsCrisisLanguage(reqBody.answers)) {
        return res.status(200).json({
          mode: "story",
          status: "crisis",
          ui: {
            safe_message: SAFE_CRISIS_MESSAGE,
          },
        });
      }

      const cacheKey = JSON.stringify(reqBody.answers);
      const cached = mythCache.get(cacheKey);
      if (cached && cached.expiresAt > now) {
        return res.status(200).json(cached.payload);
      }

      if (!isProviderConfigured()) {
        return res.status(503).json({
          mode: "story",
          status: "error",
          code: "personal_myth_provider_not_ready",
          ui: {
            safe_message: "Личный миф временно недоступен (провайдер генерации не настроен). Ваши ответы сохранены.",
          },
        });
      }

      // Cost circuit-breaker: consumed here — after validation, after the cache lookup
      // and after provider readiness — so cached answers and rejected requests never
      // spend the global generation ceiling.
      const budget = consumeDailyBudget();
      if (!budget.allowed) {
        return res.status(429).json({
          mode: "story",
          status: "error",
          code: "daily_budget_reached",
          ui: { safe_message: DAILY_BUDGET_MESSAGE },
        });
      }

      recordPathEvent("myth_started", process.env.NODE_ENV !== "production");
      const generated = await generatePersonalMyth(reqBody, mythProvider, personalMythTimeoutMs);
      recordPathEvent("myth_ready", process.env.NODE_ENV !== "production");
      const payload = {
        mode: "story",
        status: "ok",
        provider: generated.provider,
        model: generated.model,
        writer_version: generated.writerVersion ?? PERSONAL_MYTH_WRITER_VERSION,
        story_result: generated.result,
        qa: {
          passed: generated.quality.passed,
          word_count: generated.quality.word_count,
          repaired: generated.repaired,
        },
      };

      mythCache.set(cacheKey, { expiresAt: now + 5 * 60_000, payload });
      liveGeneration.personal_myth = true;
      return res.status(200).json(payload);
    } catch (error) {
      const code = error instanceof Error ? error.message.split(":", 1)[0] : "personal_myth_failed";
      const inputError = code.startsWith("invalid_");
      const notReady = code === "personal_myth_provider_not_ready";
      const qualityFailed = code === "personal_myth_quality_failed";
      if (!inputError && !qualityFailed) {
        liveGeneration.personal_myth = false;
      }
      console.error("Personal Myth generation failed:", code);
      return res.status(inputError ? 400 : notReady ? 503 : 502).json({
        mode: "story",
        status: "error",
        code,
        ui: {
          safe_message: inputError
            ? (resolvePersonalMythWriter() === "v2a" ? "Проверьте, что на все три вопроса дан короткий ответ." : "Проверь, что на все четыре вопроса дан короткий ответ.")
            : notReady
            ? "Личный миф временно недоступен (провайдер генерации не настроен). Твои ответы сохранены."
            : "Историю не удалось сложить достаточно точно. Ответы сохранены — можно повторить попытку.",
        },
      });
    }
  });

  // Crisis pre-guard for /api/meeting-of-mirrors: executes strictly BEFORE rate-limit, cache, budget, and LLM.
  const meetingCrisisPreGuard: express.RequestHandler = (req, res, next) => {
    const storyData = req.body?.storyData;
    const explicitUserQuestion = String(storyData?.userQuestion ?? req.body?.userQuestion ?? "").trim();
    if (containsMeetingCrisisInput(storyData, explicitUserQuestion)) {
      return res.status(200).json({
        status: "crisis",
        ui: {
          safe_message: SAFE_CRISIS_MESSAGE,
        },
      });
    }
    next();
  };

  // Dedicated Meeting of Mirrors Endpoint (Independent synthesis via DeepSeek)
  const meetingHandler = async (req: express.Request, res: express.Response) => {
    try {
      const { codeData, storyData } = req.body;
      const explicitUserQuestion = String(storyData?.userQuestion ?? req.body?.userQuestion ?? "").trim();

      if (containsMeetingCrisisInput(storyData, explicitUserQuestion)) {
        return res.status(200).json({
          status: "crisis",
          ui: {
            safe_message: SAFE_CRISIS_MESSAGE,
          },
        });
      }

      if (!codeData || !codeData.calc || !storyData || !storyData.storyInputs || !storyData.storyResult) {
        return res.status(200).json({
          status: "error",
          ui: { safe_message: "Для встречи зеркал необходимы готовые результаты обеих линз (Цифрового Кода и Личного Мифа)." }
        });
      }

      const meetingCacheKey = deriveMeetingCacheKey(codeData, storyData, explicitUserQuestion);
      const cachedMeeting = meetingSynthesisCache.get(meetingCacheKey);
      if (cachedMeeting && cachedMeeting.expiresAt > Date.now() && !req.body?.bypassCache) {
        liveGeneration.meeting = true;
        return res.status(200).json(cachedMeeting.payload);
      }

      if (!deepseekClient.isReady()) {
        liveGeneration.meeting = false;
        return res.status(503).json({
          status: "error",
          code: "meeting_provider_not_ready",
          ui: { safe_message: "Встреча зеркал сейчас недоступна (провайдер генерации не настроен). Ваши результаты сохранены — попробуйте снова позже." }
        });
      }

      // Cost circuit-breaker: consumed only when a real synthesis is about to run.
      const budget = consumeDailyBudget();
      if (!budget.allowed) {
        return res.status(429).json({
          status: "error",
          code: "daily_budget_reached",
          ui: { safe_message: DAILY_BUDGET_MESSAGE },
        });
      }

      const result = await generateMeetingOfMirrors({
        codeData,
        storyData: {
          ...storyData,
          ...(explicitUserQuestion ? { userQuestion: explicitUserQuestion } : {}),
        },
        client: meetingClient,
        model: MEETING_MODEL,
        totalBudgetMs: 48_000,
      });

      if (result?.status === "ok") {
        meetingSynthesisCache.set(meetingCacheKey, {
          expiresAt: Date.now() + 15 * 60_000,
          payload: result,
        });
      }
      liveGeneration.meeting = result?.status === "ok";
      return res.status(200).json(result);
    } catch (error) {
      liveGeneration.meeting = false;
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

  app.post("/api/meeting-of-mirrors", meetingCrisisPreGuard, meetingGuard, meetingHandler);

  // Canonical Calculation Endpoint (digital-code-system authority)
  app.post("/api/calculate", async (req, res) => {
    try {
      const dob = String(req.body?.dob || "").trim();
      const deletionToken = String(req.headers["x-deletion-token"] || req.body?.token || "").trim();
      const consentReceipt = res.locals.consent;
      const ownerToken = deletionToken || consentReceipt?.eventId;

      const result = await calculateCanonicalDigitalCode(dob, ownerToken);

      // Server-trusted cache binding:
      // Cache key is bound to deletion scope only when the calculation actually runs on the server.
      const cacheKey = deriveCacheKey(dob);
      if (deletionToken) {
        registerDeletionScope(deletionToken, { cacheKey });
      }
      if (consentReceipt?.eventId) {
        registerDeletionScope(consentReceipt.eventId, { cacheKey });
      }

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

  // Dedicated Owner-Only / Preview Endpoint for Code V2
  app.post(["/api/code-v2", "/api/preview/code-v2"], async (req, res) => {
    try {
      const dob = String(req.body?.dob || "").trim();
      const deletionToken = String(req.headers["x-deletion-token"] || req.body?.token || "").trim();
      const consentReceipt = res.locals.consent;
      const ownerToken = deletionToken || consentReceipt?.eventId;

      const payload = await calculateCanonicalCodeV2(dob, ownerToken);

      // Server-trusted cache binding:
      const cacheKey = deriveCacheKey(dob);
      if (deletionToken) {
        registerDeletionScope(deletionToken, { cacheKey });
      }
      if (consentReceipt?.eventId) {
        registerDeletionScope(consentReceipt.eventId, { cacheKey });
      }

      return res.status(200).json({ status: "ok", payload });
    } catch (err: any) {
      const isUnavailable = err?.message?.includes("dcs_canonical_code_v2_unavailable");
      return res.status(isUnavailable ? 503 : 400).json({
        status: "error",
        code: isUnavailable ? "dcs_canonical_code_v2_unavailable" : "invalid_input",
        message: isUnavailable ? "Канонический сервис Interpretation V2 временно недоступен" : err.message,
      });
    }
  });

  // Continuation Claim Handoff Endpoint (Web -> Telegram V2)
  app.post("/api/handoff/create-claim", async (req, res) => {
    try {
      if (
        process.env.STAGE1_LOCAL_CANDIDATE_MODE === "true" ||
        process.env.TELEGRAM_HANDOFF_DISABLED === "true" ||
        (process.env.HOST === "127.0.0.1" && process.env.TELEGRAM_LOCAL_CANDIDATE_CONNECTED !== "true")
      ) {
        return res.status(503).json({
          status: "error",
          code: "telegram_destination_unavailable",
          message: LOCAL_CANDIDATE_TELEGRAM_UNAVAILABLE_MESSAGE,
          ui: { safe_message: LOCAL_CANDIDATE_TELEGRAM_UNAVAILABLE_MESSAGE },
        });
      }
      const { codeResult, storyResult, meetingResult, consent, ageVerified, truthState } = req.body || {};
      const claim = await createContinuationClaim({
        codeResult,
        storyResult,
        meetingResult,
        consent: res.locals.consent?.scopes.includes('telegram_transfer') === true,
        ageVerified: res.locals.consent?.adult === true,
        truthState,
        consentReceipt:res.locals.consent,
      });
      return res.status(200).json({ status: "ok", ...claim });
    } catch (err: any) {
      const msg = err?.message || "claim_creation_failed";
      if (msg === 'telegram_destination_unavailable') {
        return res.status(503).json({
          status: 'error',
          code: msg,
          message: LOCAL_CANDIDATE_TELEGRAM_UNAVAILABLE_MESSAGE,
          ui: { safe_message: LOCAL_CANDIDATE_TELEGRAM_UNAVAILABLE_MESSAGE },
        });
      }
      const isInput = msg.includes("consent_required") || msg.includes("age_requirement") || msg.includes("journey_incomplete");
      return res.status(isInput ? 400 : 500).json({ status: "error", code: msg.split(":", 1)[0], message: msg });
    }
  });

  // Privacy: Session Registration Endpoint
  app.post("/api/privacy/register-session", (req, res) => {
    try {
      const token = req.body?.token || crypto.randomBytes(24).toString("hex");
      const { anonymousId, sessionToken } = req.body || {};
      // Strict trust boundary: client cannot dictate arbitrary cache keys.
      // Cache keys are bound ONLY through server-trusted calculation flows.
      registerDeletionScope(token, { anonymousId, sessionToken });

      // If client presents a valid server-signed consent cookie, inherit calculations from that session
      const cookieHeader = req.headers.cookie || "";
      const consentCookie = cookieHeader.split(";").map(v => v.trim()).find(v => v.startsWith("zerkalo_consent="))?.slice("zerkalo_consent=".length);
      const consentReceipt = consentCookie ? verifyConsent(consentCookie) : null;
      if (consentReceipt?.eventId) {
        bindSessionCalculationsToToken(token, consentReceipt.eventId);
      }

      return res.status(200).json({ status: "ok", token });
    } catch (err: any) {
      return res.status(500).json({ status: "error", message: err.message });
    }
  });

  // Privacy: Fail-closed Deletion Endpoint
  app.post("/api/delete-data", async (req, res) => {
    try {
      // The consent cookie is httpOnly, so the interface cannot send its event id: when no token is given,
      // the server takes the deletion scope from the caller's own consent receipt (same-origin only).
      let token = String(req.body?.token || "").trim();
      if (!token) {
        const origin = req.get("origin");
        let sameOrigin = false;
        try { sameOrigin = Boolean(origin) && new URL(origin as string).host === req.get("host"); } catch { sameOrigin = false; }
        if (!sameOrigin) return res.status(403).json({ status: "error", code: "deletion_origin_rejected" });
        token = consentReceiptFromRequest(req)?.eventId || "";
      }
      const result = await executeDataDeletion(token);
      if (result.status === "error") {
        const isInput = result.code === "invalid_token" || result.code === "deletion_scope_not_found";
        return res.status(isInput ? 400 : 503).json(result);
      }
      commerce.deleteOwned(req,res);
      return res.status(200).json(result);
    } catch (err: any) {
      return res.status(503).json({ status: "error", code: "deletion_incomplete", retryable: true, message: err.message });
    }
  });

  // Dedicated Albert Dialogue Endpoint (RP-1 DeepSeek conversation & Stage A short juxtaposition)
  const albertHandler = async (req: express.Request, res: express.Response) => {
    try {
      // Full message validation (non-empty AND within the generator's 2000-char contract)
      // before anything else — a rejected message must never reach the daily budget.
      try {
        parseAlbertMessage(req.body);
      } catch {
        return res.status(400).json({
          status: "error",
          code: "invalid_message",
          ui: { safe_message: "Пожалуйста, введите текст вопроса для Альберта." }
        });
      }

      // Crisis pre-check strictly BEFORE provider readiness and daily budget consumption (A2)
      const safetyCheck = checkSafety(req.body);
      if (safetyCheck.isCrisis) {
        return res.status(200).json({
          status: "crisis",
          isCrisis: true,
          suppressCommercialOffer: true,
          safetyState: "crisis",
          message: safetyCheck.safeMessage,
          response: safetyCheck.safeMessage,
          provider: "safety_intercept",
          model: null,
          authority: "digital-code-system/telegram_v2.albert.orchestrator",
          actionType: req.body?.actionType === "short_juxtaposition_opener" ? "short_juxtaposition_opener" : "user_message",
          sourceStateVersion: typeof req.body?.sourceStateVersion === "string" ? req.body.sourceStateVersion : undefined,
        });
      }

      if (!deepseekClient.isReady()) {
        liveGeneration.albert = false;
        return res.status(503).json({
          status: "error",
          code: "albert_provider_not_ready",
          ui: { safe_message: "Собеседник Альберт сейчас недоступен (провайдер генерации не настроен). Ваши результаты сохранены." }
        });
      }

      // Cost circuit-breaker: consumed only when a real dialogue generation is about to run.
      const budget = consumeDailyBudget();
      if (!budget.allowed) {
        return res.status(429).json({
          status: "error",
          code: "daily_budget_reached",
          ui: { safe_message: DAILY_BUDGET_MESSAGE },
        });
      }

      const dialogueRes = await generateAlbertDialogue(
        req.body,
        deepseekClient,
        ALBERT_MODEL,
        45_000,
        res.locals.consent
      );

      liveGeneration.albert = dialogueRes.status === "ok" || dialogueRes.status === "crisis";
      return res.status(200).json(dialogueRes);
    } catch (error) {
      const code = error instanceof Error ? error.message.split(":", 1)[0] : "albert_failed";
      const inputError = code === "invalid_message";
      const notReady = code === "albert_provider_not_ready";
      if (!inputError) {
        liveGeneration.albert = false;
      }
      if (error instanceof AlbertCanonicalError) {
        console.error("Developer Log: Albert canonical error:", {
          code: "albert_canonical_failed",
          canonical_status: error.canonical_status,
          canonical_error: error.canonical_error,
          provider_outcome: error.provider_outcome,
          request_id: error.requestId,
        });
        return res.status(502).json({
          status: "error",
          code: "albert_canonical_failed",
          error_code: "albert_canonical_failed",
          canonical_status: error.canonical_status,
          canonical_error: error.canonical_error,
          provider_outcome: error.provider_outcome,
          downstream_status: error.downstreamStatus,
          downstream_code: error.downstreamCode,
          request_id: error.requestId,
          diagnostic: {
            downstream_status: error.downstreamStatus,
            downstream_error: error.downstreamCode,
            provider_outcome: error.provider_outcome,
          },
          ui: {
            safe_message: "Не удалось получить ответ от собеседника. Ваши результаты сохранены — попробуйте повторить вопрос.",
          },
        });
      }
      console.error("Developer Log: Albert dialogue error:", code, error);
      return res.status(inputError ? 400 : notReady ? 503 : 502).json({
        status: "error",
        code,
        error_code: code,
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

  app.post(["/api/albert/dialogue", "/api/albert"], albertGuard, albertHandler);
  installChapterOfferRoutes(app);

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
  if (!options.skipVite) {
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
  }

  return {
    app,
    liveGeneration,
    mythCache,
    deepseekClient,
    meetingClient,
    mythProvider,
  };
}

async function startServer() {
  const { app } = await createApp();
  const PORT = Number(process.env.PORT) || 3000;
  app.listen(PORT, process.env.HOST || "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

const currentFile = fileURLToPath(import.meta.url);
const isDirectRun =
  Boolean(process.argv[1]) &&
  (path.resolve(process.argv[1]) === currentFile ||
    process.argv[1].endsWith("/server.ts") ||
    process.argv[1].endsWith("\\server.ts") ||
    process.argv[1] === "server.ts");

if (isDirectRun && !process.env.NO_AUTO_START_SERVER) {
  startServer();
}
