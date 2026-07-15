import {
  createPersonalMythProvider,
  generatePersonalMyth,
  parsePersonalMythRequest,
  type PersonalMythAnswers,
} from "../server/personalMyth";

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
  const provider = createPersonalMythProvider(process.env);
  if (!provider.isReady()) throw new Error("provider_not_ready");

  const reports = [];
  for (const [index, answers] of fixtures.entries()) {
    try {
      const request = parsePersonalMythRequest({
        request_id: `provider_smoke_${Date.now()}_${index}`,
        consent_version: "personal-myth-v1-smoke",
        answers,
      });
      const generated = await generatePersonalMyth(request, provider, 90_000);
      reports.push({
        fixture: index + 1,
        passed: generated.quality.passed,
        blockers: generated.quality.blockers,
        word_count: generated.quality.word_count,
        answer_coverage: generated.quality.answer_coverage,
        repaired: generated.repaired,
        visual_key: generated.result.visual_key,
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : "unknown";
      reports.push({
        fixture: index + 1,
        passed: false,
        blockers: reason.startsWith("personal_myth_quality_failed:")
          ? reason.slice("personal_myth_quality_failed:".length).split(",").filter(Boolean)
          : [reason.split(":", 1)[0]],
        word_count: null,
        answer_coverage: [],
        repaired: true,
        visual_key: null,
      });
    }
  }

  const passed = reports.every((report) => report.passed);
  console.log(JSON.stringify({
    status: passed ? "PASS" : "FAIL",
    provider: provider.name,
    model: provider.model,
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
