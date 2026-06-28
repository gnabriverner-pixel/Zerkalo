import { CalculationResult, FirstMirror } from '../types';
import { numberKnowledge } from '../data/numberKnowledge';
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

export function generateFirstMirror(calc: CalculationResult): FirstMirror {
  const soul = numberKnowledge[calc.soul] || numberKnowledge[1];
  const pathNum = calc.path === 11 ? 11 : calc.path;
  const path = numberKnowledge[pathNum] || numberKnowledge[1];
  const expressionNum = calc.expression === 11 ? 11 : calc.expression;
  const expression = numberKnowledge[expressionNum] || numberKnowledge[1];
  const directionNum = calc.direction === 11 ? 11 : calc.direction;
  const direction = numberKnowledge[directionNum] || numberKnowledge[1];
  const resultNum = calc.result === 11 ? 11 : calc.result;
  const result = numberKnowledge[resultNum] || numberKnowledge[1];
  
  const compoundPath = calc.pathComposite && calc.pathComposite.includes('/') 
    ? getCompoundKnowledge(calc.pathComposite.split('/')[0])
    : null;

  const compoundDir = calc.directionComposite && calc.directionComposite.includes('/')
    ? getCompoundKnowledge(calc.directionComposite.split('/')[0])
    : null;

  const compoundRes = calc.resultComposite && calc.resultComposite.includes('/')
    ? getCompoundKnowledge(calc.resultComposite.split('/')[0])
    : null;

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
        text: `Ядро вашей матрицы опирается на связку амбиции (Душа ${soul.number}), стратегии (Путь ${path.number}) и финальной цели (Результат ${result.number}). Ваша внутренняя суть (Душа) характеризуется качеством: «${soul.positions.soul.essence}». Внешний мир открывается, когда вы реализуете стратегию Пути: «${path.positions.path.essence}». Этот способ движения неизбежно ведёт вас к итоговому смыслу (Результат): «${result.positions.result.essence}».`
      },
      {
        id: "strength",
        title: "Что уже является силой",
        text: `Ваша опора — это резонанс между внутренней потребностью (Душа ${soul.number}) и внешним стилем контакта с миром (Выражение ${expression.number}). С одной стороны, ваша внутренняя сила проявляется так: «${soul.positions.soul.strength}». С другой стороны, этот механизм усиливается, когда во внешнем мире вы транслируете качество Выражения: «${expression.positions.expression.strength}». Сочетание этих двух векторов позволяет вам открывать любые двери.`
      },
      {
        id: "tension",
        title: "Где возникает напряжение",
        text: `Сильная архитектура выявляет зоны трения там, где стратегия Пути сталкивается с фокусом реализации Направления. Зона сопротивления со стороны Направления: «${direction.positions.direction.tension}». При этом ваш привычный метод со стороны Пути требует иного фокуса: «${path.positions.path.tension}».${compoundPath ? ` Дополнительный вызов по числу перехода (${calc.pathComposite}): «${compoundPath.risk}».` : ''}${compoundDir ? ` Уточняющий нюанс по числу Направления (${calc.directionComposite}): «${compoundDir.risk}».` : ''}`
      },
      {
        id: "step",
        title: "Первый практический шаг",
        text: `Чтобы ваш потенциал развивался, начните с точных действий по числу Направления с прицелом на ваш итоговый Результат. Рекомендация для первого шага: «${direction.positions.direction.recommendation}». Это поможет проложить дорогу к вашему итоговому Результату, главная задача которого: «${result.positions.result.recommendation}».${compoundRes ? ` Дополнительный совет по числу Результата: «${compoundRes.recommendation}».` : ''}`
      }
    ],
    strengthTags: [soul.gift.split(',')[0], path.gift.split(',')[0], expression.keywords[0], direction.keywords[1]],
    tensionTags: [soul.shadow.split(',')[0], path.shadow.split(',')[0], direction.shadow.split(',')[0]],
    practicalStep: direction.practicalKey || soul.practicalKey,
    cta: {
      title: "Хотите получить детальный разбор?",
      text: "Более детальный разбор вы можете получить в Telegram. Бот поможет раскрыть скрытый денежный вектор, точки напряжения, рассчитать полную матрицу ресурсов и ваш персональный временной цикл.",
      button: "Получить разбор в Telegram"
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
      soul: numberKnowledge[calc.soul],
      path: numberKnowledge[calc.path === 11 ? 11 : calc.path],
      direction: numberKnowledge[calc.direction === 11 ? 11 : calc.direction],
      expression: numberKnowledge[calc.expression === 11 ? 11 : calc.expression],
      result: numberKnowledge[calc.result === 11 ? 11 : calc.result],
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
