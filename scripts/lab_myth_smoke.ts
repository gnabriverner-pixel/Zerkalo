// Лаборатория Gate 1: smoke-проверка генерации Личного мифа (3 фикстуры).
// Требует DEEPSEEK_API_KEY в окружении. Не является quality-гейтом:
// транспорт и schema, главный гейт — человеческое чтение текстов.
import {
  createMythProvider,
  generatePersonalMyth,
  parsePersonalMythRequest,
  type PersonalMythAnswers,
} from "../server/myth";

const fixtures: PersonalMythAnswers[] = [
  {
    q1: "Неясность перед важным выбором и ощущение остановки",
    q2: "Мост, дальний конец которого скрыт утренним туманом",
    q3: "Прогулка у воды без телефона и срочных разговоров",
    q4: "Спокойной смелости сделать первый небольшой шаг",
  },
  {
    q1: "Слишком много незавершённых дел и постоянный внутренний шум",
    q2: "Комната, где на столе горят сразу шесть настольных ламп",
    q3: "Работа руками, когда виден законченный предмет",
    q4: "Границы и способности оставить только одно важное дело",
  },
  {
    q1: "Ожидание перемен, для которых пока не находится подходящей формы",
    q2: "Ночное окно, за которым медленно начинается рассвет",
    q3: "Разговор, в котором удалось сказать простую правду без спешки",
    q4: "Тепла и ясности, чтобы не торопить решение",
  },
];

async function main() {
  const provider = createMythProvider(process.env);
  if (!provider.isReady()) throw new Error("provider_not_ready: требуется DEEPSEEK_API_KEY");

  const timeoutMs = Math.min(
    90_000,
    Math.max(10_000, Number(process.env.PERSONAL_MYTH_TIMEOUT_MS) || 45_000),
  );

  const reports = [];
  for (const [index, answers] of fixtures.entries()) {
    try {
      const request = parsePersonalMythRequest({
        request_id: `lab_smoke_${Date.now()}_${index}`,
        consent_version: "personal-myth-v1-smoke",
        answers,
      });
      const generated = await generatePersonalMyth(request, provider, timeoutMs);
      reports.push({
        fixture: index + 1,
        passed: generated.quality.passed,
        blockers: generated.quality.blockers,
        word_count: generated.quality.word_count,
        repaired: generated.repaired,
        title: generated.result.title,
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : "unknown";
      const wordCountMatch = reason.match(/word_count=(\d+)/u);
      reports.push({
        fixture: index + 1,
        passed: false,
        blockers: reason.startsWith("personal_myth_quality_failed:")
          ? reason.slice("personal_myth_quality_failed:".length).split(";", 1)[0].split("|").filter(Boolean)
          : [reason.split(":", 1)[0]],
        word_count: wordCountMatch ? Number(wordCountMatch[1]) : null,
        repaired: true,
        title: null,
      });
    }
  }

  const passed = reports.every((report) => report.passed);
  console.log(JSON.stringify({
    status: passed ? "PASS" : "FAIL",
    provider: provider.name,
    model: provider.model,
    thinking: process.env.LAB_MYTH_THINKING || "off",
    reports,
  }, null, 2));
  if (!passed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(JSON.stringify({
    status: "ERROR",
    reason: error instanceof Error ? error.message : "unknown",
  }));
  process.exitCode = 1;
});
