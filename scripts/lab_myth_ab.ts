// Лаборатория Gate 1: слепой A/B — deepseek-v4-flash vs deepseek-v4-pro.
// Одинаковые prompt, одинаковые параметры (non-thinking по умолчанию, LAB_MYTH_THINKING).
// Имена моделей не показываются в blind-файле; mapping — только в reveal-файле.
// Каждая фикстура сохраняется инкрементально (partial-файлы), чтобы прогресс
// был виден и частичный результат не терялся. Требует DEEPSEEK_API_KEY.
import fs from "fs/promises";
import path from "path";
import {
  createMythProvider,
  buildPersonalMythPrompt,
  parsePersonalMythRequest,
  type PersonalMythProvider,
} from "../server/myth";
import { AB_FIXTURES } from "../src/data/abFixtures";

function tolerantParse(raw: string) {
  try {
    const cleaned = raw.replace(/```json/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    return parsed.story_result || parsed;
  } catch {
    return {
      title: "Ошибка парсинга",
      story: raw,
      mirror: { mainImage: "-", innerTension: "-", hiddenResource: "-", newView: "-" },
      one_step: "-",
      journal_question: "-",
    };
  }
}

async function runProvider(provider: PersonalMythProvider, prompt: string, timeoutMs: number) {
  const startedAt = Date.now();
  try {
    const text = await provider.generate(prompt, timeoutMs);
    return { text, latencyMs: Date.now() - startedAt, failed: false };
  } catch (error) {
    return {
      text: JSON.stringify({ error: error instanceof Error ? error.message : "unknown" }),
      latencyMs: Date.now() - startedAt,
      failed: true,
    };
  }
}

async function main() {
  const modelA = process.env.LAB_MYTH_MODEL_A || "deepseek-v4-flash";
  const modelB = process.env.LAB_MYTH_MODEL_B || "deepseek-v4-pro";
  const providerA = createMythProvider(process.env, { model: modelA });
  const providerB = createMythProvider(process.env, { model: modelB });

  if (!providerA.isReady() || !providerB.isReady()) {
    throw new Error("provider_not_ready: требуется DEEPSEEK_API_KEY");
  }

  const timeoutMs = Math.min(
    90_000,
    Math.max(10_000, Number(process.env.PERSONAL_MYTH_TIMEOUT_MS) || 45_000),
  );

  const ts = new Date().toISOString().replace(/[:.]/gu, "-");
  const outDir = process.env.LAB_AB_OUT_DIR || path.join(process.cwd(), "lab_ab_runs");
  await fs.mkdir(outDir, { recursive: true });
  const partialBlindPath = path.join(outDir, `${ts}-partial-blind.jsonl`);
  const partialRevealPath = path.join(outDir, `${ts}-partial-reveal.jsonl`);

  const runs: Array<Record<string, unknown>> = [];
  const swapMap: boolean[] = [];

  for (let index = 0; index < AB_FIXTURES.length; index += 1) {
    const fixture = AB_FIXTURES[index];
    const request = parsePersonalMythRequest({
      request_id: `lab_ab_${Date.now()}_${index}`,
      consent_version: "personal-myth-v1-ab",
      answers: fixture.inputs,
    });
    const prompt = buildPersonalMythPrompt(request);

    console.error(`[ab] fixture ${index + 1}/${AB_FIXTURES.length}: ${fixture.title} ...`);
    const [resA, resB] = await Promise.all([
      runProvider(providerA, prompt, timeoutMs),
      runProvider(providerB, prompt, timeoutMs),
    ]);

    const outA = tolerantParse(resA.text);
    const outB = tolerantParse(resB.text);

    // Случайный своп, чтобы ревьюер не привязывал «Вариант А» к модели А.
    const swap = Math.random() > 0.5;
    swapMap.push(swap);

    const wordsOf = (story: string) => story.split(/\s+/u).filter(Boolean).length;

    const blindA = {
      id: "A",
      title: (swap ? outB : outA).title || "Без названия",
      story: (swap ? outB : outA).story || "",
      mirror: (swap ? outB : outA).mirror || {},
      one_step: (swap ? outB : outA).one_step || "",
      journal_question: (swap ? outB : outA).journal_question || "",
      latencyMs: (swap ? resB : resA).latencyMs,
      failed: (swap ? resB : resA).failed,
    };
    const blindB = {
      id: "B",
      title: (swap ? outA : outB).title || "Без названия",
      story: (swap ? outA : outB).story || "",
      mirror: (swap ? outA : outB).mirror || {},
      one_step: (swap ? outA : outB).one_step || "",
      journal_question: (swap ? outA : outB).journal_question || "",
      latencyMs: (swap ? resA : resB).latencyMs,
      failed: (swap ? resA : resB).failed,
    };

    const runEntry = {
      fixtureId: fixture.id,
      fixtureTitle: fixture.title,
      inputs: fixture.inputs,
      variantA: blindA,
      variantB: blindB,
    };
    runs.push(runEntry);

    const revealEntry = {
      fixtureId: fixture.id,
      fixtureTitle: fixture.title,
      variantA: { model: swap ? modelB : modelA },
      variantB: { model: swap ? modelA : modelB },
    };

    await fs.appendFile(partialBlindPath, `${JSON.stringify(runEntry)}\n`, "utf-8");
    await fs.appendFile(partialRevealPath, `${JSON.stringify(revealEntry)}\n`, "utf-8");

    console.log(`\n=== Фикстура ${index + 1}: ${fixture.title} ===`);
    console.log(`Вариант А: «${blindA.title}» (${wordsOf(blindA.story)} слов, ${blindA.latencyMs} мс${blindA.failed ? ", FAILED" : ""})`);
    console.log(`Вариант Б: «${blindB.title}» (${wordsOf(blindB.story)} слов, ${blindB.latencyMs} мс${blindB.failed ? ", FAILED" : ""})`);
    console.error(`[ab] fixture ${index + 1} done (${wordsOf(blindA.story)}/${wordsOf(blindB.story)} words)`);
  }

  const blindPath = path.join(outDir, `${ts}-blind.json`);
  const revealPath = path.join(outDir, `${ts}-reveal.json`);

  const meta = {
    generatedAt: new Date().toISOString(),
    models: { modelA, modelB },
    settings: {
      thinking: process.env.LAB_MYTH_THINKING || "off",
      reasoningEffort: process.env.LAB_MYTH_REASONING_EFFORT || "high",
      temperature: Number(process.env.LAB_MYTH_TEMPERATURE || 0.72),
      maxTokens: 5000,
      responseFormat: "json_object",
    },
    note: "blind-файл не содержит имён моделей. Mapping свопов — в reveal-файле.",
  };

  await fs.writeFile(blindPath, JSON.stringify({ meta, runs }, null, 2), "utf-8");

  const reveal = AB_FIXTURES.map((fixture, index) => {
    const swap = swapMap[index];
    return {
      fixtureId: fixture.id,
      fixtureTitle: fixture.title,
      variantA: { model: swap ? modelB : modelA },
      variantB: { model: swap ? modelA : modelB },
    };
  });
  await fs.writeFile(revealPath, JSON.stringify({ meta, reveal }, null, 2), "utf-8");

  console.log(`\nBlind-файл:  ${blindPath}`);
  console.log(`Reveal-файл: ${revealPath}`);
  console.log("\nСначала прочитайте blind-файл и выберите лучшие тексты. Имена моделей — только после выбора.");
}

main().catch((error) => {
  console.error(JSON.stringify({
    status: "ERROR",
    reason: error instanceof Error ? error.message : "unknown",
  }));
  process.exitCode = 1;
});
