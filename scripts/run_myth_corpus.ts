import fs from "fs/promises";
import path from "path";
import "dotenv/config";
import {
  generatePersonalMyth,
  parsePersonalMythRequest,
  DeepSeekMythProvider,
  validatePersonalMythResult,
  PersonalMythResult,
  PersonalMythQualityReport,
  PERSONAL_MYTH_WRITER_VERSION,
} from "../server/myth";
import { DeepSeekClient } from "../server/deepseek";

interface CorpusInputItem {
  id: string;
  category?: string;
  inputs: {
    q1: string;
    q2: string;
    q3: string;
    q4: string;
  };
}

interface CaseResult {
  id: string;
  category: string;
  inputs: { q1: string; q2: string; q3: string; q4: string };
  latencyMs: number;
  repairsUsed: number;
  initialValidationPassed: boolean;
  initialBlockers: string[];
  finalValidationPassed: boolean;
  finalBlockers: string[];
  wordCount: number;
  paragraphCount: number;
  hasRegisterDefect: boolean;
  hasBiographyDefect: boolean;
  hasParagraphDefect: boolean;
  hasUnicodeDefect: boolean;
  result: PersonalMythResult | null;
  error?: string;
}

const MOTIF_PATTERNS = {
  window: /окн[оауе]|подоконник/iu,
  light: /свет|луч|солнц/iu,
  silence: /тишин|молчан/iu,
  breath: /дыхан|вдох|выдох/iu,
  water: /вод[аыеу]|рек[аеу]|озер[оа]|мор[ея]/iu,
  tea: /чай|кофе|кружк|чашк/iu,
  rain: /дожд|капл|ливн/iu,
  road: /дорог|троп|путь|шаг/iu,
  pause: /пауз|замира|останов/iu,
  you_are_here: /ты\s+всё\s+ещё\s+здесь|ты\s+здесь/iu,
};

async function run() {
  console.log("=== STARTING 42-CASE REAL PERSONAL MYTH V1.1 CORPUS EVALUATION ===");
  const auditFixturesPath = path.join(process.cwd(), "docs/evidence/v1_1-audit/myth_real_corpus_42_results.json");
  const rawFixtures = await fs.readFile(auditFixturesPath, "utf-8");
  const parsedFixtures = JSON.parse(rawFixtures);
  const items: CorpusInputItem[] = parsedFixtures.results.map((r: any, idx: number) => ({
    id: r.id || `case_${String(idx + 1).padStart(2, "0")}`,
    category: r.category || "general",
    inputs: r.inputs,
  }));

  console.log(`Loaded ${items.length} corpus cases to execute against DeepSeek deepseek-v4-pro...`);

  const client = new DeepSeekClient(process.env);
  const provider = new DeepSeekMythProvider(process.env, client);

  if (!provider.isReady()) {
    console.error("ERROR: DeepSeekMythProvider is not ready! Check DEEPSEEK_API_KEY.");
    process.exit(1);
  }

  const results: CaseResult[] = [];
  let transportFailures = 0;
  let rateLimitFailures = 0;
  let initialValidationFailures = 0;
  let repairsUsed = 0;
  let finalUnrecoveredDefects = 0;
  let registerDefects = 0;
  let paragraphDefects = 0;
  let unicodeDefects = 0;
  let biographyDefects = 0;

  const motifCounts: Record<string, number> = {
    window: 0,
    light: 0,
    silence: 0,
    breath: 0,
    water: 0,
    tea: 0,
    rain: 0,
    road: 0,
    pause: 0,
    you_are_here: 0,
  };

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    console.log(`\n[Case ${i + 1}/${items.length}] Running ${item.id} (${item.category})...`);
    const req = parsePersonalMythRequest({
      request_id: `corpus_${item.id}_${Date.now()}`,
      consent_version: PERSONAL_MYTH_WRITER_VERSION,
      answers: item.inputs,
    });

    const start = Date.now();
    try {
      const generated = await generatePersonalMyth(req, provider, 90000);
      const latencyMs = Date.now() - start;
      const res = generated.result;
      const quality = generated.quality;

      if (generated.repaired) {
        repairsUsed += 1;
        initialValidationFailures += 1;
      }

      const words = res.story.split(/\s+/u).filter(Boolean);
      const wordCount = words.length;
      const paragraphs = res.story.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
      const paragraphCount = paragraphs.length;

      // Deep scan for metrics
      const storyAndMirror = [res.title, res.story, ...Object.values(res.mirror)].join(" ");
      
      const hasFormalYou = /(?:^|[\s.,!?;:«»"—()\[\]])(?:вы|вас|вам|вами|ваш|ваша|ваше|ваши|вашего|вашей|вашему|вашим|ваших)(?:$|[\s.,!?;:«»"—()\[\]])/iu.test(storyAndMirror);
      const hasSecondPerson = /(?:^|[\s.,!?;:«»"—()\[\]])(?:ты|тебя|тебе|тобой|тобою|твой|твоя|твоё|твое|твои|твоих|твоим|твоей|твоего|твоему)(?:$|[\s.,!?;:«»"—()\[\]])/iu.test(res.story);
      const hasRegisterDefect = hasFormalYou || !hasSecondPerson;
      if (hasRegisterDefect) registerDefects += 1;

      const hasParagraphDefect = paragraphCount < 3 || paragraphCount > 6;
      if (hasParagraphDefect) paragraphDefects += 1;

      const hasBiographyDefect = /(?:^|[\s.,!?;:«»"—()\[\]])(?:в\s+детстве\s+ты|ты\s+в\s+детстве|когда\s+ты\s+был\s+маленьк\w*|ты\s+(?:однажды\s+купил|всегда\s+боялся\s+потому\s+что|вырос\s+в|учился\s+на|работал\s+в)|когда\s+ты\s+работал|твой\s+(?:брак|развод|начальник|врач|психолог))/iu.test(res.story);
      if (hasBiographyDefect) biographyDefects += 1;

      const hasUnicodeDefect = /[\uFFFD\x00-\x08\x0B\x0C\x0E-\x1F]/.test(storyAndMirror);
      if (hasUnicodeDefect) unicodeDefects += 1;

      // Motif tracking
      for (const [key, pattern] of Object.entries(MOTIF_PATTERNS)) {
        if (pattern.test(res.story)) {
          motifCounts[key] += 1;
        }
      }

      console.log(`  ✓ Success in ${latencyMs}ms | Words: ${wordCount} | Paragraphs: ${paragraphCount} | Repaired: ${generated.repaired}`);
      console.log(`    Title: «${res.title}»`);

      results.push({
        id: item.id,
        category: item.category || "general",
        inputs: item.inputs,
        latencyMs,
        repairsUsed: generated.repaired ? 1 : 0,
        initialValidationPassed: !generated.repaired,
        initialBlockers: generated.repaired ? ["repaired_in_editorial_step"] : [],
        finalValidationPassed: quality.passed,
        finalBlockers: quality.blockers,
        wordCount,
        paragraphCount,
        hasRegisterDefect,
        hasBiographyDefect,
        hasParagraphDefect,
        hasUnicodeDefect,
        result: res,
      });

    } catch (err: any) {
      const latencyMs = Date.now() - start;
      const errMsg = err?.message || String(err);
      console.error(`  ✗ Failed in ${latencyMs}ms: ${errMsg}`);
      if (errMsg.includes("503") || errMsg.includes("500") || errMsg.includes("502") || errMsg.includes("fetch")) {
        transportFailures += 1;
      } else if (errMsg.includes("429")) {
        rateLimitFailures += 1;
      } else {
        finalUnrecoveredDefects += 1;
      }

      results.push({
        id: item.id,
        category: item.category || "general",
        inputs: item.inputs,
        latencyMs,
        repairsUsed: 1,
        initialValidationPassed: false,
        initialBlockers: ["generation_failed"],
        finalValidationPassed: false,
        finalBlockers: [errMsg],
        wordCount: 0,
        paragraphCount: 0,
        hasRegisterDefect: false,
        hasBiographyDefect: false,
        hasParagraphDefect: false,
        hasUnicodeDefect: false,
        result: null,
        error: errMsg,
      });
    }

    // Delay 1.5s between calls to prevent rate limiting
    await new Promise((r) => setTimeout(r, 1500));
  }

  const successfulOutputs = results.filter((r) => r.result !== null && r.finalValidationPassed).length;

  const corpusSummary = {
    evaluatedAt: new Date().toISOString(),
    provider: "deepseek",
    model: "deepseek-v4-pro",
    writerVersion: PERSONAL_MYTH_WRITER_VERSION,
    totalCases: items.length,
    successfulOutputs,
    transportFailures,
    rateLimitFailures,
    initialValidationFailures,
    repairsUsed,
    finalUnrecoveredDefects,
    registerDefects,
    paragraphDefects,
    unicodeDefects,
    biographyDefects,
    motifCounts,
    results,
  };

  const outputPath = path.join(process.cwd(), "docs/evidence/v1_1-final/myth_real_corpus_42_results.json");
  await fs.writeFile(outputPath, JSON.stringify(corpusSummary, null, 2), "utf-8");
  console.log(`\nSaved corpus results to ${outputPath}`);

  console.log("\n=======================================================");
  console.log("             CORPUS METRICS SUMMARY                   ");
  console.log("=======================================================");
  console.log(`TOTAL_CASES:                      ${items.length}`);
  console.log(`SUCCESSFUL_OUTPUTS:               ${successfulOutputs}`);
  console.log(`TRANSPORT_FAILURES:               ${transportFailures}`);
  console.log(`RATE_LIMIT_FAILURES:              ${rateLimitFailures}`);
  console.log(`INITIAL_VALIDATION_FAILURES:      ${initialValidationFailures}`);
  console.log(`REPAIRS_USED:                     ${repairsUsed}`);
  console.log(`FINAL_UNRECOVERED_DEFECTS:        ${finalUnrecoveredDefects}`);
  console.log(`REGISTER_DEFECTS (ты/вы):         ${registerDefects}`);
  console.log(`PARAGRAPH_DEFECTS (3..6):         ${paragraphDefects}`);
  console.log(`UNICODE_DEFECTS:                  ${unicodeDefects}`);
  console.log(`BIOGRAPHY_DEFECTS:                ${biographyDefects}`);
  console.log("-------------------------------------------------------");
  console.log("CROSS-CORPUS MOTIF FREQUENCIES:");
  for (const [key, count] of Object.entries(motifCounts)) {
    console.log(`  - ${key.padEnd(16)}: ${count} / ${successfulOutputs} (${((count / (successfulOutputs || 1)) * 100).toFixed(1)}%)`);
  }
  console.log("=======================================================\n");
}

run().catch((e) => {
  console.error("Corpus execution fatal error:", e);
  process.exit(1);
});
