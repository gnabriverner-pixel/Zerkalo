import { CalculationResult, FirstMirror } from '../types';
import { numberKnowledge } from '../data/numberKnowledge';
import { getCompoundKnowledge } from '../data/compoundKnowledge';

export function determineKeyInsight(soul: number, path: number, result: number): string {
  if ([1, 4, 8].includes(soul) && [1, 4, 8].includes(result)) {
    return "В основе кода — прямая связь: внутренний импульс сразу переходит в материальную форму. Без долгих сомнений и адаптации.";
  }
  if ([2, 6].includes(soul) && [2, 6].includes(result)) {
    return "Сила этой структуры — в способности говорить на простом человеческом языке и выстраивать связи без давления.";
  }
  if ([7, 11].includes(soul) || [7, 11].includes(result)) {
    return "Опора кода — связка тонкого наблюдения и зрелого итога. Именно здесь рождается ваша главная экспертиза.";
  }
  if ([3, 5].includes(soul) || [3, 5].includes(path)) {
    return "Структура держится на скорости и точном слове. Важно переводить хаос поиска в конкретный результат.";
  }
  if (result === 9 || soul === 9) {
    return "Этот код рассчитан на длинные дистанции. Сила завершать начатое и строить устойчивые системы.";
  }
  if (path === 8 || path === 4) {
    return "Опора кода — устойчивость. Вы не подстраиваетесь под готовую систему, а создаете и удерживаете свою.";
  }
  return "Связка желания, действия и итога. На стыке этих трех точек строится ваша личная эффективность.";
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
        text: `Матрица строится на связке Души (${soul.number}), Пути (${path.number}) и Результата (${result.number}). Внутренний импульс: «${soul.positions.soul.essence}». Метод движения: «${path.positions.path.essence}». Итоговый ориентир: «${result.positions.result.essence}».`
      },
      {
        id: "strength",
        title: "Точки опоры",
        text: `Внутренняя потребность (Душа ${soul.number}) согласована с внешним стилем контакта (Выражение ${expression.number}). Изнутри это проявляется так: «${soul.positions.soul.strength}». Вовне поддерживается качеством: «${expression.positions.expression.strength}». Это сочетание дает вам устойчивость.`
      },
      {
        id: "tension",
        title: "Зоны трения",
        text: `Напряжение возникает там, где привычный метод по Пути (${path.number}) расходится с вектором Направления (${direction.number}). Зона сопротивления: «${direction.positions.direction.tension}». Стиль движения: «${path.positions.path.tension}».${compoundPath ? ` Число перехода (${calc.pathComposite}): «${compoundPath.risk}».` : ''}${compoundDir ? ` Число Направления (${calc.directionComposite}): «${compoundDir.risk}».` : ''}`
      },
      {
        id: "step",
        title: "Маленький практический шаг",
        text: `Начните с действий по Направлению с ориентиром на Результат. Фокус по Направлению: «${direction.positions.direction.recommendation}». Цель по Результату: «${result.positions.result.recommendation}».${compoundRes ? ` Рекомендация по Результату: «${compoundRes.recommendation}».` : ''}`
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
