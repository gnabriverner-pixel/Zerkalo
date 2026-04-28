import { CalculationResult } from '../types';
import { numberKnowledge } from '../data/numberKnowledge';
import { getCompoundKnowledge } from '../data/compoundKnowledge';

export function generateFirstMirror(calc: CalculationResult): string {
  const soul = numberKnowledge[calc.soul] || numberKnowledge[1];
  const pathNum = calc.path === 11 ? 11 : calc.path;
  const path = numberKnowledge[pathNum] || numberKnowledge[1];
  
  const compoundPath = calc.pathComposite && calc.pathComposite.includes('/') 
    ? getCompoundKnowledge(calc.pathComposite.split('/')[0])
    : null;

  const resultCompoundInfo = calc.resultComposite && calc.resultComposite.includes('/') 
    ? getCompoundKnowledge(calc.resultComposite.split('/')[0])
    : null;

  let text = `### Главный узор\n`;
  text += `В вашей конфигурации ярко проявлено сочетание внутренней потребности в том, чтобы ${soul.positions.soul.short.toLowerCase().replace('внутренняя потребность ', '')} `;
  text += `и поведенческого маршрута, где движение происходит через ${path.positions.path.short.toLowerCase().replace('движение через ', '')}. `;
  if (compoundPath && compoundPath.compound !== 11) {
      text += `Этот путь дополняется оттенком союза энергий: ${compoundPath.digits.join(' и ')}.\n\n`;
  } else {
      text += `\n\n`;
  }

  text += `### Сильная сторона\n`;
  text += `Сильная сторона этого первого слоя может проявляться в следующем: ${soul.positions.soul.strength.toLowerCase()} И кроме того: ${path.positions.path.strength.toLowerCase()}\n\n`;

  text += `### Внутреннее напряжение\n`;
  text += `Базовое напряжение часто возникает там, где ${soul.positions.soul.tension.toLowerCase()} `;
  text += `Часто это сочетается с вызовом на уровне действий: ${path.positions.path.tension.toLowerCase()}\n\n`;

  text += `### Первый практический шаг\n`;
  if (resultCompoundInfo && resultCompoundInfo.compound !== 11) {
    text += `${resultCompoundInfo.recommendation} `;
  } else {
    text += `На ближайший период полезно ${soul.positions.soul.recommendation.toLowerCase()} `;
  }
  text += `Помните: первый слой показывает лишь общие контуры архитектуры. Полная карта требует намного более глубокого структурного разбора напряжений и точек развития.`;

  return text;
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
