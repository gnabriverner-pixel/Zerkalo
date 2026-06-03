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
        text: `Ядро вашей матрицы опирается на связку амбиции (Душа ${soul.number}), стратегии (Путь ${path.number}) и финальной цели (Результат ${result.number}). Изнутри вы чувствуете, что ${soul.positions.soul.essence.toLowerCase()} Внешний мир открывается, когда вы действуете по линии Пути: ${path.positions.path.essence.toLowerCase()} Этот способ двигаться неизбежно ведёт вас к финальной сборке: ${result.positions.result.essence.toLowerCase()}`
      },
      {
        id: "strength",
        title: "Что уже является силой",
        text: `Ваша опора — это резонанс между внутренней потребностью (Душа ${soul.number}) и внешним стилем контакта с миром (Выражение ${expression.number}). У вас есть врожденная способность: ${soul.positions.soul.strength.toLowerCase()} И этот механизм усиливается в тот момент, когда через Выражение вы транслируете ${expression.positions.expression.strength.toLowerCase()} Это сочетание позволяет открывать двери, просто оставаясь собой.`
      },
      {
        id: "tension",
        title: "Где возникает напряжение",
        text: `Сильная архитектура выявляет зоны трения там, где стратегия (Путь ${path.number}) сталкивается с фокусом приложения усилий (Направление ${direction.number}). Вы можете чувствовать сопротивление, когда вам нужно ${direction.positions.direction.tension.toLowerCase()}, в то время как ваш привычный метод требует ${path.positions.path.tension.toLowerCase()}${compoundPath ? ` Скрытый сценарий перехода (${calc.pathComposite}) добавляет нюанс: ${compoundPath.risk.toLowerCase()} ` : ''}${compoundDir ? ` А вектор (${calc.directionComposite}) уточняет: ${compoundDir.risk.toLowerCase()}` : ''}`
      },
      {
        id: "step",
        title: "Первый практический шаг",
        text: `Чтобы ваш потенциал не замирал, начните с точного применения энергии Направления (${direction.number}) с прицелом на ваш смысловой Результат (${result.number}). Ваш шаг: ${direction.positions.direction.recommendation.toLowerCase()} Это не просто действие, это способ проложить дорогу к вашему итоговому смыслу, где вы сможете ${result.positions.result.recommendation.toLowerCase()}${compoundRes ? ` Дополнительно: ${compoundRes.recommendation.toLowerCase()}` : ''}`
      },
      {
        id: "resonance",
        title: "Метафорический резонанс",
        text: `"${soul.tale ? soul.tale.title : 'Легенда начального порядка'}". Ваше глубинное ядро (${soul.number}) требует реализации как ${soul.archetypeName.toLowerCase()}. Внутри вас живёт ${soul.core.toLowerCase()}. Если вы не используете этот дар (${soul.gift.toLowerCase()}), он превращается в тень (${soul.shadow.toLowerCase()}). Опирайтесь на планетарную энергию (${soul.planet}), чтобы выстроить свой маршрут.`
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
