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
    keyInsight: `Основа вашей архитектуры: ${soul.core.toLowerCase()}.`,
    blocks: [
      {
        id: "main_pattern",
        title: "Главный узор",
        text: `Ядро вашей матрицы опирается на энергию ${soul.number} (${soul.planet}). ${soul.positions.soul.essence} Внешний мир при этом открывается через ваши стратегические действия по линии Пути (${path.number}): ${path.positions.path.essence.toLowerCase()} Этот способ двигаться неизбежно ведёт вас к финальной сборке — энергии ${result.number}. Ваша главная задача — прийти к состоянию, в котором ${result.positions.result.essence.toLowerCase()}`
      },
      {
        id: "strength",
        title: "Что уже является силой",
        text: `Ваша главная опора кроется в вашей сути: ${soul.positions.soul.strength.toLowerCase()} Этот глубокий внутренний ресурс транслируется вовне через ваш образ и манеру контакта с миром — энергию Выражения (${expression.number}). Окружающие считывают вас как человека, чья сила в том, чтобы ${expression.positions.expression.strength.toLowerCase()} Это сочетание позволяет вам открывать нужные двери, просто оставаясь собой.`
      },
      {
        id: "tension",
        title: "Где возникает напряжение",
        text: `Сильная архитектура выявляет зоны трения при столкновении с реальностью. Ваш Путь (${path.number}) сталкивается с Направлением (${direction.number}). Вы можете чувствовать сопротивление, когда вам нужно ${direction.positions.direction.tension.toLowerCase()}, в то время как ваш привычный метод требует ${path.positions.path.tension.toLowerCase()} ${compoundPath ? `Сценарий перехода ${calc.pathComposite} добавляет скрытый риск: ${compoundPath.risk.toLowerCase()} ` : ''} ${compoundDir ? `А вектор ${calc.directionComposite} предупреждает: ${compoundDir.risk.toLowerCase()}` : ''}`
      },
      {
        id: "step",
        title: "Первый практический шаг",
        text: `Чтобы вектор развития не замирал, начните с осознанного применения вашей энергии Направления (${direction.number}): ${direction.positions.direction.recommendation.toLowerCase()} Это не просто действие, это способ проложить дорогу к вашему итоговому смыслу — Результату (${result.number}). Зрелость вашей матрицы наступит тогда, когда вы сможете ${result.positions.result.recommendation.toLowerCase()} ${compoundRes ? compoundRes.recommendation : ''}`
      }
    ],
    strengthTags: [soul.gift.split(',')[0], path.gift.split(',')[0], expression.keywords[0], direction.keywords[1]],
    tensionTags: [soul.shadow.split(',')[0], path.shadow.split(',')[0], direction.shadow.split(',')[0]],
    practicalStep: direction.practicalKey || soul.practicalKey,
    cta: {
      title: "Хотите увидеть полную карту?",
      text: "Большое исследование раскрывает не только эти пять чисел, но и матрицу, скрытые конфликты, денежный вектор и ваш персональный временной цикл.",
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
