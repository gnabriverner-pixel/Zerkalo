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

  let text = `Вы обладаете уникальной архитектурой личности, в которой заложены как мощные точки опоры, так и зоны глубокого внутреннего напряжения. Формируясь на пересечении ${soul.number} и ${path.number}, ваш код требует особого пути.\n\n`;

  text += `### Внутренний стержень и сила\n`;
  text += `Ваша главная опора кроется в вашей сути: ${soul.positions.soul.strength.toLowerCase()} Внешний мир при этом открывает для вас двери через ваши стратегические действия: ${path.positions.path.strength.toLowerCase()} Эта комбинация позволяет вам двигаться вперед даже тогда, когда другие теряют почву под ногами.\n\n`;

  text += `### Скрытые напряжения\n`;
  text += `Однако ни одна сильная архитектура не обходится без точек давления. Чаще всего вы можете сталкиваться с тем, что ${soul.positions.soul.tension.toLowerCase()} Это базовое сопротивление усиливается вызовом на уровне пути: ${path.positions.path.tension.toLowerCase()} Именно здесь вам предстоит проделать главную внутреннюю работу.\n\n`;

  text += `### Архитектура действий\n`;
  if (resultCompoundInfo && resultCompoundInfo.compound !== 11) {
    text += `${resultCompoundInfo.recommendation} `;
  } else {
    text += `В качестве первого практического шага на ближайший период вам будет полезно ${soul.positions.soul.recommendation.toLowerCase()} `;
  }
  text += `Энергия вашего числа пути дополняет это правило: ${path.positions.path.recommendation.toLowerCase()}\n\n`;

  if (compoundPath) {
    text += `*Дополнительный оттенок вашего маршрута (${compoundPath.compound}):* ${compoundPath.accent} Однако остерегайтесь того, чтобы ${compoundPath.risk.toLowerCase()}\n\n`;
  }

  text += `_Обратите внимание: этот краткий срез показывает лишь несущие конструкции. Полная гармонизация кода требует детального разбора каждого сектора вашей матрицы в Большом исследовании._`;

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
