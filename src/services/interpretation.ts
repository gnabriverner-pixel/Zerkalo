import { CalculationResult, FirstMirror } from '../types';
import { getNumberKnowledge } from '../data/numberKnowledge';
import { getCompoundKnowledge } from '../data/compoundKnowledge';

export function determineKeyInsight(soul: number, path: number, result: number, expression=soul, direction=path): string {
  const theme=(n:number)=>getNumberKnowledge(n).keywords[0];
  return `В языке метода внутренний мотив «${theme(soul)}» (Душа ${soul}) встречается со способом действия «${theme(path)}» (Путь ${path}). Выражение ${expression} добавляет тему «${theme(expression)}» в контакт с миром; Направление ${direction} — «${theme(direction)}» в выбор среды. Связующий вопрос: как сохранить исходный мотив, двигаясь к теме «${theme(result)}» (Результат ${result}), и где привычный способ действия помогает этому, а где требует изменения?`;
}

/** Attribute the existing authorial corpus instead of asserting a biography. */
export function methodReading(text:string):string {
  const bounded=text.replace(/Психика рассчитана на сверхнагрузки\.?/g,'В методе выделена тема выносливости, а не доказанная способность выдерживать перегрузки.');
  return `В интерпретации метода: «${bounded.replace(/[«»]/g,'').replace(/\.$/,'')}».`;
}

function cleanSentence(text: string): string {
  if (!text) return '';
  const trimmed = text.trim();
  return trimmed.endsWith('.') ? trimmed : `${trimmed}.`;
}

function normalizeTextForComparison(str: string): string {
  return str.toLowerCase().replace(/[^а-яёa-z0-9]/g, '');
}

function appendUniqueParagraph(parts: string[], prefix: string, bodyText?: string) {
  if (!bodyText) return;
  const cleaned = cleanSentence(bodyText);
  if (!cleaned) return;
  const normCleaned = normalizeTextForComparison(cleaned);

  const alreadyExists = parts.some(p => {
    const normP = normalizeTextForComparison(p);
    return normP === normCleaned || (normCleaned.length > 15 && (normP.includes(normCleaned) || normCleaned.includes(normP)));
  });

  if (!alreadyExists) {
    parts.push(`${prefix}: ${cleaned}`);
  }
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

  const soulEssence = methodReading(soul.positions.soul.essence);
  const pathEssence = methodReading(path.positions.path.essence);
  const resultEssence = methodReading(result.positions.result.essence);

  const soulStrength = methodReading(soul.positions.soul.strength);
  const exprStrength = methodReading(expression.positions.expression.strength);

  const dirTension = methodReading(direction.positions.direction.tension);
  const pathTension = methodReading(path.positions.path.tension);

  const tensionParts = [
    `Здесь сопоставляются стратегия (Путь ${path.number}) и среда приложения усилий (Направление ${direction.number}). Разные числа не доказывают конфликт: проверьте на одной ситуации, помогает ли выбранный способ действия в этой среде.`,
    `По линии Направления характерно следующее напряжение: ${dirTension}`
  ];
  appendUniqueParagraph(tensionParts, `По линии Пути может проявляться`, pathTension);
  if (compoundPath && compoundPath.risk) {
    appendUniqueParagraph(tensionParts, `Скрытый сценарий перехода (${calc.pathComposite})`, compoundPath.risk);
  }
  if (compoundDir && compoundDir.risk) {
    appendUniqueParagraph(tensionParts, `Векторный нюанс (${calc.directionComposite})`, compoundDir.risk);
  }

  const dirRec = cleanSentence(direction.positions.direction.recommendation);
  const resultRec = cleanSentence(result.positions.result.recommendation);

  const stepParts = [
    `Возьмите одну текущую задачу и сравните способ действия (Путь ${path.number}), условия работы (Направление ${direction.number}) и нужный итог (Результат ${result.number}). Следующие ориентиры принадлежат методу; выбирайте только применимый к этой задаче.`,
    `Практический ориентир по Направлению: ${dirRec}`
  ];
  appendUniqueParagraph(stepParts, `Ориентир по линии Результата`, resultRec);
  if (compoundRes && compoundRes.recommendation) {
    appendUniqueParagraph(stepParts, `Дополнительный фокус (${calc.resultComposite})`, compoundRes.recommendation);
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
    keyInsight: determineKeyInsight(soul.number, path.number, result.number,expression.number,direction.number),
    blocks: [
      {
        id: "main_pattern",
        title: "Главный узор",
        text: `Сначала отделим мотив (Душа ${soul.number}) от способа действовать (Путь ${path.number}) и образа итога (Результат ${result.number}). Их связь — вопрос к опыту, а не три установленных свойства.\n\nМотив в позиции Души. ${soulEssence}\n\nСпособ действия в позиции Пути. ${pathEssence}\n\nОбраз итога в позиции Результата. ${resultEssence}\n\nПроверьте связь на конкретном решении: какой мотив был вашим, каким способом вы действовали и что получилось? Совпадение или несовпадение важно сохранить, не подгоняя ответ под описание.`
      },
      {
        id: "strength",
        title: "Как соединяются ресурсы",
        text: `Здесь встречаются две разные роли: внутренняя потребность (Душа ${soul.number}) и стиль контакта (Выражение ${expression.number}).\n\nОпора по числу Души. ${soulStrength}\n\nРесурс по числу Выражения. ${exprStrength}\n\n${soul.number===expression.number ? 'Одна тема повторяется в двух позициях метода. Это не означает, что внутреннее и внешнее у человека всегда совпадают.' : 'В методе мотив и его внешняя подача описаны разными темами. Их различие само по себе не является противоречием личности.'} Посмотрите, удаётся ли выразить важное для вас так, чтобы собеседник это понял.`
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
        text: `«${taleTitle}».\n\nЧислу Души ${soul.number} метод сопоставляет архетип «${soul.archetypeName}» и темы: ${soul.core}. Его ресурсный образ — ${soul.gift.toLowerCase()}, контрастная сторона — ${soul.shadow.toLowerCase()}. Планетарный символ этого образа — ${soul.planet}. Это авторская метафора Кода, не воспоминание или факт вашей биографии.`
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
