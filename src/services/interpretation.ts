import { CalculationResult, FirstMirror } from '../types';
import { numberKnowledge } from '../data/numberKnowledge';
import { getCompoundKnowledge } from '../data/compoundKnowledge';

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

  const resultCompoundInfo = calc.resultComposite && calc.resultComposite.includes('/') 
    ? getCompoundKnowledge(calc.resultComposite.split('/')[0])
    : null;

  return {
    title: "Ваш цифровой код собран",
    subtitle: "Это первое зеркало: короткий разбор формулы, сильных сторон, напряжений и направления развития.",
    formula: {
      numbers: `${calc.soul} · ${calc.path} · ${calc.expression} · ${calc.direction} · ${calc.result}`,
      planets: `${soul.planet} · ${path.planet} · ${expression.planet} · ${direction.planet} · ${result.planet}`,
      positions: "Душа · Путь · Выражение · Направление · Результат"
    },
    keyInsight: `Основа вашей архитектуры: ${soul.core.toLowerCase()}.`,
    blocks: [
      {
        id: "main_pattern",
        title: "Главный узор",
        text: `В этой формуле первым виден не столько характер, сколько способ сборки внутренней силы. Ядро вашей матрицы опирается на энергию ${soul.number} (${soul.planet}). ${soul.positions.soul.essence} Внешний мир при этом открывает для вас двери через ваши стратегические действия по вектору ${path.number}: ${path.positions.path.essence}`
      },
      {
        id: "strength",
        title: "Что уже является силой",
        text: `Ваша главная опора кроется в вашей сути: ${soul.positions.soul.strength.toLowerCase()} Эта базовая сборка усиливается способностью действовать в своей среде: ${path.positions.path.strength.toLowerCase()}`
      },
      {
        id: "tension",
        title: "Где возникает напряжение",
        text: `Однако сильная архитектура всегда требует выдерживания точек давления. Вы можете сталкиваться с тем, что ${soul.positions.soul.tension.toLowerCase()} Это сопротивление часто усугубляется вызовом на уровне пути: ${path.positions.path.tension.toLowerCase()}`
      },
      {
        id: "step",
        title: "Первый практический шаг",
        text: `В качестве первого практического шага на ближайший период вам может быть полезно ${soul.positions.soul.recommendation.toLowerCase()} Энергия вашего числа пути дополняет это правило: ${path.positions.path.recommendation.toLowerCase()} ${compoundPath ? `Дополнительно стоит отметить сценарий ${compoundPath.value}: ${compoundPath.recommendation}` : ''}`
      }
    ],
    strengthTags: [soul.gift.split(',')[0], path.gift.split(',')[0], soul.keywords[0], path.keywords[1]],
    tensionTags: [soul.shadow.split(',')[0], path.shadow.split(',')[0]],
    practicalStep: soul.practicalKey,
    cta: {
      title: "Хотите увидеть полную карту?",
      text: "Большое исследование раскрывает не только числа, но и связи между ними: внутренние опоры, напряжения, сценарии выбора, матрицу, отношения, деньги и личный маршрут.",
      button: "Получить Большое исследование"
    },
    disclaimer: "Информационно-аналитический формат. Не диагноз и не предсказание. Цифровой Код — это инструмент самопознания и рефлексии."
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
      "Скрытые энергии: Составные числа",
      "Главные внутренние напряжения и конфликты",
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
      "не ставить диагнозов",
      "не давать советов",
      "никакой фатальности",
      "не утверждать 'вы точно такой-то'"
    ],
    safetyRules: [
      "при признаках кризиса вернуть status: 'crisis'"
    ]
  };
}
