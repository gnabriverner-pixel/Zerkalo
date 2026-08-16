// scripts/lab_myth_g1c_synth.ts
// G1C Synthetic Pre-Flight batch runner.
// HARNESS ONLY: reuses the FROZEN lab contract from server/myth.ts verbatim
// (buildPersonalMythPrompt, parsePersonalMythRequest, containsCrisisLanguage,
// generatePersonalMyth — which includes the bounded retry and honest-failure
// contract). No writer/prompt/safety/schema/generation-logic changes.
//
// Retry policy: no retries for literary preference. The only retries that can
// happen are the frozen ones inside generatePersonalMyth (2 transport attempts,
// 1 repair pass triggered by MECHANICAL schema/lexicon/word-count blockers).
//
// Usage:
//   G1C_MANIFEST=/abs/path/G1C_CASE_MANIFEST.json \
//   G1C_OUT=/abs/path/G1C_ALL_MYTHS.jsonl \
//   G1C_MODEL=deepseek-v4-pro \
//   npx tsx scripts/lab_myth_g1c_synth.ts
//
// Resumable: cases already present in the output file are skipped.
import fs from "fs/promises";
import { readFileSync } from "fs";
import path from "path";
import { execSync } from "child_process";
import crypto from "crypto";
import {
  createMythProvider,
  parsePersonalMythRequest,
  containsCrisisLanguage,
  generatePersonalMyth,
  type PersonalMythProvider,
} from "../server/myth";

const CRISIS_SAFE_MESSAGE =
  "Похоже, сейчас важнее не образная история, а живая поддержка. Обратитесь к близкому человеку рядом или к профильному специалисту в вашем регионе. Если есть непосредственная опасность — свяжитесь с экстренной службой.";

// --- provider revision capture (instrumentation only, generation logic untouched) ---
const seenModelIds: Record<string, number> = {};
const originalFetch = globalThis.fetch.bind(globalThis);
(globalThis as unknown as { fetch: typeof fetch }).fetch = async (input, init) => {
  const response = await originalFetch(input, init);
  try {
    const clone = response.clone();
    const payload = (await clone.json()) as { model?: string };
    if (typeof payload?.model === "string") {
      seenModelIds[payload.model] = (seenModelIds[payload.model] || 0) + 1;
    }
  } catch {
    // non-JSON body (e.g. HTML error) — ignore
  }
  return response;
};

function repoSha(): string {
  try {
    return execSync("git rev-parse HEAD", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "unknown";
  }
}

function fileSha256(filePath: string): string {
  return crypto.createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

const timeoutMs = Math.min(90_000, Math.max(10_000, Number(process.env.PERSONAL_MYTH_TIMEOUT_MS) || 45_000));

async function main() {
  const manifestPath = process.env.G1C_MANIFEST || process.argv[2];
  const outPath = process.env.G1C_OUT || process.argv[3];
  const model = process.env.G1C_MODEL || process.argv[4] || "deepseek-v4-pro";
  if (!manifestPath || !outPath) {
    throw new Error("usage: G1C_MANIFEST=... G1C_OUT=... [G1C_MODEL=deepseek-v4-pro]");
  }

  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8")) as {
    cases: Array<{
      case_id: string;
      hidden_context: Record<string, unknown>;
      answers: { q1: string; q2: string; q3: string; q4: string };
    }>;
  };

  const provider = createMythProvider(process.env, { model });
  if (!provider.isReady()) throw new Error("provider_not_ready: требуется DEEPSEEK_API_KEY");

  const sha = repoSha();
  const mythTsPath = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../server/myth.ts");

  await fs.mkdir(path.dirname(outPath), { recursive: true });
  const done = new Set<string>();
  try {
    const existing = await fs.readFile(outPath, "utf8");
    for (const line of existing.split("\n").filter(Boolean)) {
      try {
        const parsed = JSON.parse(line) as { case_id?: string };
        if (parsed.case_id) done.add(parsed.case_id);
      } catch {
        // skip malformed line
      }
    }
  } catch {
    // file does not exist yet
  }

  console.error(`[g1c] manifest=${manifestPath}`);
  console.error(`[g1c] out=${outPath}`);
  console.error(`[g1c] model=${model} repo_sha=${sha} timeout_ms=${timeoutMs}`);
  console.error(`[g1c] cases=${manifest.cases.length} already_done=${done.size}`);

  // Instrumented provider: counts real transport attempts without touching logic.
  const countedProvider: PersonalMythProvider = {
    name: provider.name,
    model: provider.model,
    isReady: () => provider.isReady(),
    generate: async (prompt, ms) => {
      const attemptStarted = Date.now();
      try {
        return await provider.generate(prompt, ms);
      } finally {
        attemptLatencies.push(Date.now() - attemptStarted);
      }
    },
  };
  const attemptLatencies: number[] = [];

  for (const [index, caseItem] of manifest.cases.entries()) {
    if (done.has(caseItem.case_id)) {
      console.error(`[g1c] ${index + 1}/${manifest.cases.length} ${caseItem.case_id}: skip (already done)`);
      continue;
    }
    attemptLatencies.length = 0;
    const startedAt = new Date().toISOString();
    const requestId = `g1c-synth-${caseItem.case_id}-${Date.now()}`;
    const record: Record<string, unknown> = {
      case_id: caseItem.case_id,
      run_id: `g1c-synth-${caseItem.case_id}-${startedAt.replace(/[:.]/gu, "-")}`,
      request_id: requestId,
      started_at: startedAt,
      model_requested: model,
      settings: {
        temperature: 0.72,
        max_tokens: 5000,
        response_format: "json_object",
        thinking: "off",
        reasoning_effort: "high",
      },
      writer: {
        module: "server/myth.ts",
        function: "buildPersonalMythPrompt (inside generatePersonalMyth)",
        repo_sha: sha,
        file_sha256: fileSha256(mythTsPath),
        note: "frozen G1C writer; lab branch lab/myth-recovery-v1",
      },
      safety: {
        version: "server/myth.ts (frozen)",
        crisis_precheck: "ok",
        schema_validation: "pending",
        lexicon_scan: "pending",
      },
      answers: caseItem.answers,
      hidden_context: caseItem.hidden_context,
    };

    try {
      const request = parsePersonalMythRequest({
        request_id: requestId,
        consent_version: "personal-myth-v1-g1c-synth",
        answers: caseItem.answers,
      });

      // Guard: hidden context must never reach the writer prompt.
      const { buildPersonalMythPrompt } = await import("../server/myth");
      const probePrompt = buildPersonalMythPrompt(request);
      const leak = Object.values(caseItem.hidden_context)
        .flatMap((value) => (typeof value === "string" ? [value] : []))
        .filter((value) => value.length > 8 && probePrompt.includes(value));
      if (leak.length > 0) {
        throw new Error(`hidden_context_leak: ${leak.length} string(s) found in writer prompt`);
      }

      if (containsCrisisLanguage(request.answers)) {
        record.status = "crisis";
        record.safety.crisis_precheck = "triggered";
        record.output = {
          mode: "crisis",
          status: "crisis",
          ui: { safe_message: CRISIS_SAFE_MESSAGE },
        };
        record.finished_at = new Date().toISOString();
        record.latency_ms = 0;
        record.notes = ["frozen crisis pre-check intercepted; writer never invoked (contract-compliant)"];
      } else {
        const generated = await generatePersonalMyth(request, countedProvider, timeoutMs);
        record.status = "ok";
        record.repaired = generated.repaired;
        record.quality = generated.quality;
        record.safety.schema_validation = generated.quality.passed ? "ok" : "failed";
        record.safety.lexicon_scan = generated.quality.blockers.includes("forbidden_public_language") ? "failed" : "ok";
        record.output = { mode: "story", status: "ok", story_result: generated.result };
        record.finished_at = new Date().toISOString();
        record.latency_ms = attemptLatencies.reduce((sum, value) => sum + value, 0);
        record.provider_attempts = attemptLatencies.length;
        record.notes = [
          generated.repaired ? "bounded repair retry happened (mechanical blockers only)" : "no repair retry",
          `latencies_ms=${JSON.stringify(attemptLatencies)}`,
        ];
      }
    } catch (error) {
      record.status = "failed";
      record.failed_reason = error instanceof Error ? error.message : "unknown";
      record.finished_at = new Date().toISOString();
      record.latency_ms = attemptLatencies.reduce((sum, value) => sum + value, 0);
      record.provider_attempts = attemptLatencies.length;
      record.safety.schema_validation = "n/a";
      record.safety.lexicon_scan = "n/a";
      record.notes = ["honest failure recorded; no fake success; no retry for literary preference"];
    }

    if (Object.keys(seenModelIds).length > 0) {
      record.model_seen = seenModelIds;
    }
    await fs.appendFile(outPath, `${JSON.stringify(record)}\n`, "utf8");
    console.error(
      `[g1c] ${index + 1}/${manifest.cases.length} ${caseItem.case_id}: ${String(record.status)} ` +
        `(latency=${String(record.latency_ms)}ms attempts=${String(record.provider_attempts ?? 0)})`,
    );
  }

  console.error(`[g1c] done. model_ids_seen=${JSON.stringify(seenModelIds)}`);
}

main().catch((error) => {
  console.error(JSON.stringify({ status: "ERROR", reason: error instanceof Error ? error.message : "unknown" }));
  process.exitCode = 1;
});
