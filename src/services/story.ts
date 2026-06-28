import { CalculationResult, StoryInputs } from '../types';
import { numberKnowledge } from '../data/numberKnowledge';
import { determineKeyInsight } from './interpretation';

export interface MythBrief {
  core_gift: string;
  shadow: string;
  resource: string;
  motif: string;
  main_axis: string;
}

export function getMotifByNumber(num: number): string {
  const reduced = num === 11 ? 2 : num;
  const motifs: Record<number, string> = {
    1: "центр, свет, воля, пробуждение, очаг утренней зари",
    2: "ритм, зеркало, отражение, течение, глубина, прилив серебряного света",
    3: "смысл, книга, знание, ориентир, маяк, путеводный знак",
    4: "творение, огонь, прорыв, искры, архитектор пространства",
    5: "речь, связь, нить, мост, вестник, созвучие слов и ветра",
    6: "тепло, сад, красота, эликсир, созвучие чувств, цветущая лоза",
    7: "тишина, настройка, дух, камертон, эхо, шепот под звездами",
    8: "форма, время, часы, плотина, кристалл, порядок, вековые камни",
    9: "защита, служение, путь, щит, очаг, доспех, тропа даймона"
  };
  return motifs[reduced] || "свет, путь";
}

export function buildMythBrief(calc?: CalculationResult): MythBrief {
  if (!calc) {
    return {
      core_gift: "Дар глубокой чувствительности, интуиции и внутреннего компаса",
      shadow: "Трудность удерживать внутреннее равновесие под давлением внешних обстоятельств",
      resource: "Способность находить тишину внутри себя и доверять своим ощущениям",
      motif: "тишина, тепло, направление, путеводный свет, опора",
      main_axis: "Путь интеграции внутренней чувствительности в устойчивую жизненную силу."
    };
  }

  const soulInfo = numberKnowledge[calc.soul] || numberKnowledge[1];
  const pathInfo = numberKnowledge[calc.path] || numberKnowledge[1];
  const resultInfo = numberKnowledge[calc.result] || numberKnowledge[1];

  return {
    core_gift: `Дар Души ${calc.soul} (${soulInfo.planet} — ${soulInfo.archetypeName}): ${soulInfo.gift}`,
    shadow: `Тень Результата ${calc.result} (${resultInfo.planet}): ${resultInfo.shadow}`,
    resource: `Ресурс Пути ${calc.path} (${pathInfo.planet}): ${pathInfo.positions.path.strength}`,
    motif: getMotifByNumber(calc.soul),
    main_axis: determineKeyInsight(calc.soul, calc.path, calc.result)
  };
}

export function safetyGate(inputs: StoryInputs): { isCrisis: boolean; safe_message?: string } {
  const crisisRegex = /(суицид|самоубийств|покончить с собой|убить себя|не хочу жить|хочу умереть|порезать себя|резать вены|избивают|насилие|насилуют|желаю смерти|смерти хочу)/i;
  
  const allTexts = [inputs.q1, inputs.q2, inputs.q3, inputs.q4].join(" ");
  if (crisisRegex.test(allTexts)) {
    return {
      isCrisis: true,
      safe_message: "Похоже, сейчас важнее не образная история, а живая поддержка. Обратитесь к человеку рядом или к специалисту в вашем регионе. Если есть непосредственная опасность — обратитесь в экстренную службу."
    };
  }
  return { isCrisis: false };
}

export function qualityGate(storyText: string): { isValid: boolean; errors?: string[] } {
  const errors: string[] = [];

  // 1. Check length (min 400 words)
  const wordsCount = storyText.split(/\s+/).filter(Boolean).length;
  if (wordsCount < 400) {
    errors.push(`Сказка слишком короткая: ${wordsCount} слов (ожидается минимум 400 слов)`);
  }

  // 2. Check forbidden words in story text (safely matched as whole words or specific forms to prevent false positives like "увлечение", "развлечение", "облегчение")
  const forbiddenInStory = /(?:\s|^|[,.!?—])(терапи[яиею]|психотерапи[яиею]|гипноз[а-я]*|нлп|лечени[яеию]|травм[аыеуои]|исцелени[яеию]|диагноз[а-я]*|предсказани[а-я]*|маги[яиею]|архетип[а-я]*|кету|раху|сурья|чандра|накшатр[а-я]*|планет[а-я]*|числа?|энерги[яиею])(?:\s|$|[,.!?—])/i;
  if (forbiddenInStory.test(storyText)) {
    errors.push("Сказка содержит запрещенные термины из бан-листа (психотерапия, Кету, планета, число, и т.д.)");
  }

  // 3. Check presence of tact markers (at least 5 of 8 must match)
  let foundTactCount = 0;
  for (let i = 1; i <= 8; i++) {
    if (storyText.includes(`<!-- такт ${i} -->`) || storyText.includes(`такт ${i}`)) {
      foundTactCount++;
    }
  }

  if (foundTactCount < 5) {
    errors.push(`Не найдена структура тактов (найдено только ${foundTactCount} из 8 тактов)`);
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}
