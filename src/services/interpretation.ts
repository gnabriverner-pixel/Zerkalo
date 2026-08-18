import { CalculationResult, FirstMirror } from '../types';
import { getNumberKnowledge } from '../data/numberKnowledge';
import { getCompoundKnowledge } from '../data/compoundKnowledge';

export function determineKeyInsight(soul: number, path: number, result: number): string {
  if ([1, 4, 8].includes(soul) && [1, 4, 8].includes(result)) {
    return "Ваша формула показывает не просто набор качеств, а бескомпромиссный способ превращать внутренний импульс в материальную форму, которую можно увидеть и применить.";
  }
  if ([2, 6].includes(soul) && [2, 6].includes(result)) {
    return "Главная тема этой архитектуры — не масштаб ради масштаба, а умение дать своей силе человеческий язык, выстраивая глубокие, резонирующие связи.";
  }
  if ([7, 11].includes(soul) || [7, 11].includes(result)) {
    return "Первый слой вашей карты показывает связку тонкого наблюдения и зрелого итога: именно между ними возникает ваш главный маршрут и уникальная экспертиза.";
  }
  if ([3, 5].includes(soul) || [3, 5].includes(path)) {
    return "Эта матрица выстроена вокруг скорости и слова: ваша задача — перевести хаос постоянного поиска в точный, измеримый результат.";
  }
  if (result === 9 || soul === 9) {
    return "Архитектура вашего кода заряжена на длинные дистанции: это потенциал завершать то, что другие только начинают, и мыслить категориями мирового масштаба.";
  }
  if (path === 8 || path === 4) {
    return "Ваша связка чисел указывает на мощную несущую конструкцию: вы не адаптируетесь под систему, вы способны её создавать и удерживать.";
  }
  return "Первый слой показывает плотную связку внутреннего желания, способа действия и зрелого результата: именно между ними возникает ваш главный жизненный алгоритм.";
}

function cleanSentence(text: string): string {
  if (!text) return '';
  const trimmed = text.trim();
  return trimmed.endsWith('.') ? trimmed : `${trimmed}.`;
}

export function generateFirstMirror(calc: CalculationResult): FirstMirror {
  const soul = getNumberKnowledge(calc.soul);
  const path = getNumberKnowledge(calc.path);
  const expression = getNumberKnowledge(calc.expression);
  const direction = getNumberKnowledge(calc.direction);
  const result = getNumberKnowledge(calc.result);
  
  const compoundPath = calc.pathComposite && calc.pathComposite.includes('/') 
    ? getCompoundKnowledge(calc.pathComposite.split('/')[0])
    : null;

  const compoundDir = calc.directionComposite && calc.directionComposite.includes('/')
    ? getCompoundKnowledge(calc.directionComposite.split('/')[0])
    : null;

  const compoundRes = calc.resultComposite && calc.resultComposite.includes('/')
    ? getCompoundKnowledge(calc.resultComposite.split('/')[0])
    : null;

  const soulEssence = cleanSentence(soul.positions.soul.essence);
  const pathEssence = cleanSentence(path.positions.path.essence);
  const resultEssence = cleanSentence(result.positions.result.essence);

  const soulStrength = cleanSentence(soul.positions.soul.strength);
  const exprStrength = cleanSentence(expression.positions.expression.strength);

  const dirTension = cleanSentence(direction.positions.direction.tension);
  const pathTension = cleanSentence(path.positions.path.tension);

  const tensionParts = [
    `Зоны трения проявляются там, где выбранная стратегия (Путь ${path.number}) сталкивается с фокусом приложения практических усилий (Направление ${direction.number}).`,
    `По линии Направления характерно следующее напряжение: ${dirTension}`,
    `По линии Пути может проявляться: ${pathTension}`
  ];
  if (compoundPath && compoundPath.risk) {
    tensionParts.push(`Скрытый сценарий перехода (${calc.pathComposite}): ${cleanSentence(compoundPath.risk)}`);
  }
  if (compoundDir && compoundDir.risk) {
    tensionParts.push(`Векторный нюанс (${calc.directionComposite}): ${cleanSentence(compoundDir.risk)}`);
  }

  const dirRec = cleanSentence(direction.positions.direction.recommendation);
  const resultRec = cleanSentence(result.positions.result.recommendation);

  const stepParts = [
    `Чтобы потенциал раскрывался без застревания, начните с точного применения энергии Направления (${direction.number}) с прицелом на смысловой Результат (${result.number}).`,
    `Практический ориентир по Направлению: ${dirRec}`,
    `Ориентир по линии Результата: ${resultRec}`
  ];
  if (compoundRes && compoundRes.recommendation) {
    stepParts.push(`Дополнительный фокус (${calc.resultComposite}): ${cleanSentence(compoundRes.recommendation)}`);
  }

  const taleTitle = soul.tale ? soul.tale.title : 'Легенда начального порядка';

  return {
    title: "Ваш цифровой код собран",
    subtitle: "Архитектура Силы: короткий срез",
    formula: {
      numbers: `${calc.soul} · ${calc.path} · ${calc.expression} · ${calc.direction} · ${calc.result}`,
      planets: `${soul.planet} · ${path.planet} · ${expression.planet} · ${direction.planet} · ${result.planet}`,
      positions: "Душа · Путь · Выражение · Направление · Результат"
    },
    keyInsight: determineKeyInsight(soul.number, path.number, result.number),
    blocks: [
      {
        id: "main_pattern",
        title: "Главный узор",
        text: `Ядро вашей матрицы опирается на связку внутреннего импульса (Душа ${soul.number}), жизненной стратегии (Путь ${path.number}) и итоговой реализации (Результат ${result.number}).\n\nПозиция Души определяет внутреннюю мотивацию: ${soulEssence}\n\nТраектория Пути задаёт способ движения во внешнем мире: ${pathEssence}\n\nЭтот вектор ведёт к финальной сборке опыта: ${resultEssence}`
      },
      {
        id: "strength",
        title: "Что уже является силой",
        text: `Ваша опора — это резонанс между внутренней потребностью (Душа ${soul.number}) и внешним стилем контакта с миром (Выражение ${expression.number}).\n\nВнутренняя опора по числу Души: ${soulStrength}\n\nВнешний ресурс по числу Выражения: ${exprStrength}\n\nЭто сочетание позволяет открывать возможности, сохраняя верность своей природе.`
      },
      {
        id: "tension",
        title: "Где возникает напряжение",
        text: tensionParts.join('\n\n')
      },
      {
        id: "step",
        title: "Первый практический шаг",
        text: stepParts.join('\n\n')
      },
      {
        id: "resonance",
        title: "Метафорический резонанс",
        text: `«${taleTitle}».\n\nВаше глубинное ядро (Душа ${soul.number}) соотносится с архетипом «${soul.archetypeName}». Внутренняя основа характера: ${soul.core}. В созидательном проявлении этот потенциал раскрывается как ${soul.gift.toLowerCase()}. В теневом выражении он может проявляться как ${soul.shadow.toLowerCase()}. Планетарный ориентир архетипа — ${soul.planet}.`
      }
    ],
    strengthTags: [soul.gift.split(',')[0], path.gift.split(',')[0], expression.keywords[0], direction.keywords[1]],
    tensionTags: [soul.shadow.split(',')[0], path.shadow.split(',')[0], direction.shadow.split(',')[0]],
    practicalStep: direction.practicalKey || soul.practicalKey,
    cta: {
      title: "Хотите увидеть полную карту?",
      text: "Большое исследование раскрывает не только эти пять чисел, но и матрицу, точки напряжения, денежный вектор и ваш персональный временной цикл.",
      button: "Получить Большое исследование"
    },
    disclaimer: "Информационно-аналитический формат. Не является вердиктом или гаданием. Цифровой Код — это инструмент самопознания и рефлексии."
  };
}

export function generateBigResearchOutline(calc: CalculationResult): object {
  return {
    sections: [
      "Введение и правила чтения",
      "Пять главных чисел",
      `Число Души: Архитектура внутренних желаний (${calc.soul})`,
      `Число Пути: Стратегия движения (${calc.pathComposite || calc.path})`,
      `Число Направления: Формат реализации силы (${calc.directionComposite || calc.direction})`,
      `Число Выражения: Внешний образ и контакт с миром (${calc.expressionComposite || calc.expression})`,
      `Число Результата: Ключевая сборка опыта (${calc.resultComposite || calc.result})`,
      "Составные числа: дополнительные оттенки формулы",
      "Главные внутренние напряжения и точки выбора",
      "Природные сильные стороны и компенсаторы",
      "Практический маршрут и точки опоры",
      "Итоговое Большое Зеркало (Резюме)"
    ]
  };
}

export function generateFullInterpretationPayload(calc: CalculationResult): object {
  const getCompSafe = (str?: string) => str && str.includes('/') ? getCompoundKnowledge(str.split('/')[0]) : null;

  return {
    calc,
    positionMeanings: {
      soul: getNumberKnowledge(calc.soul),
      path: getNumberKnowledge(calc.path),
      direction: getNumberKnowledge(calc.direction),
      expression: getNumberKnowledge(calc.expression),
      result: getNumberKnowledge(calc.result),
    },
    compoundMeanings: {
      path: getCompSafe(calc.pathComposite),
      direction: getCompSafe(calc.directionComposite),
      expression: getCompSafe(calc.expressionComposite),
      result: getCompSafe(calc.resultComposite)
    },
    styleRules: [
      "писать в языке проекта «Цифровой Код»",
      "не использовать старые термины из исходников",
      "не копировать дословно источники",
      "не писать мистически",
      "не обещать результата",
      "не использовать медицинскую, эзотерическую или терапевтическую терминологию",
      "не давать советов",
      "никакой фатальности",
      "не утверждать 'вы точно такой-то'"
    ],
    safetyRules: [
      "при признаках острого небезопасного состояния, угроз себе или другим, либо потери контроля вернуть status: 'crisis'"
    ]
  };
}
