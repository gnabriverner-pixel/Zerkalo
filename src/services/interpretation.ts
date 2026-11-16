import { CalculationResult, FirstMirror } from '../types';
import { numberKnowledge } from '../data/numberKnowledge';
import { getCompoundKnowledge } from '../data/compoundKnowledge';

export function determineKeyInsight(soul: number, path: number, result: number): string {
  if ([1, 4, 8].includes(soul) && [1, 4, 8].includes(result)) {
    return "В вас живёт редкая космическая сила зодчего: способность превращать самую смелую внутреннюю мечту в осязаемый, живой мир, который дарит опору и свободу.";
  }
  if ([2, 6].includes(soul) && [2, 6].includes(result)) {
    return "Главное чудо вашей природы — умение согревать космос человеческим теплом, создавая вокруг себя пространство красоты, доверия и глубокого созвучия.";
  }
  if ([7, 11].includes(soul) || [7, 11].includes(result)) {
    return "Ваше созвездие соединяет звёздную глубину прозрений и зрелое мастерство: вы способны видеть за горизонт привычного и открывать людям новые смыслы.";
  }
  if ([3, 5].includes(soul) || [3, 5].includes(path)) {
    return "Ваша карта соткана из солнечного ветра свободы, живого слова и радости открытий: там, где вы расправляете крылья, появляются новые дороги.";
  }
  if (result === 9 || soul === 9) {
    return "В вашем коде звучит масштаб открытого космоса: это дар мечтать по-крупному, зажигать сердца отвагой и долетать до самых высоких вершин.";
  }
  if (path === 8 || path === 4) {
    return "Ваша формула несёт в себе мощь большой орбиты: вы созданы не для того, чтобы помещаться в чужие рамки, а чтобы строить собственные светлые миры.";
  }
  return "Ваше созвездие чисел показывает удивительное единство сердечного желания, крылатого движения и большого результата: в вас заложено гораздо больше красоты и силы, чем кажется в буднях.";
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
    title: "Созвездие вашей свободы",
    subtitle: "Живой космос ваших пяти ключей",
    formula: {
      numbers: `${calc.soul} · ${calc.path} · ${calc.expression} · ${calc.direction} · ${calc.result}`,
      planets: `${soul.planet} · ${path.planet} · ${expression.planet} · ${direction.planet} · ${result.planet}`,
      positions: "Душа · Путь · Выражение · Направление · Результат"
    },
    keyInsight: determineKeyInsight(soul.number, path.number, result.number),
    blocks: [
      {
        id: "main_pattern",
        title: "Музыка вашего созвездия",
        text: `Посмотрите, какой красивый и свободный рисунок складывается из ваших чисел: внутреннее солнце желания (Душа ${soul.number}), большая орбита жизни (Путь ${path.number}) и высокая звезда назначения (Результат ${result.number}). В глубине сердца для вас естественно, что ${soul.positions.soul.essence.toLowerCase()} А пространство вокруг начинает радостно раскрываться, когда вы позволяете себе идти по линии своего Пути: ${path.positions.path.essence.toLowerCase()} Именно это движение шаг за шагом выводит вас на высоту вашего главного открытия: ${result.positions.result.essence.toLowerCase()}`
      },
      {
        id: "strength",
        title: "Крылья, которые уже с вами",
        text: `Ваша природная лёгкость и мощь рождаются из созвучия внутреннего ядра (Душа ${soul.number}) и вашего неповторимого почерка в мире (Выражение ${expression.number}). В вас изначально заложен светлый дар: ${soul.positions.soul.strength.toLowerCase()} И этот свет становится видимым для всех, когда через Выражение вы свободно проявляете ${expression.positions.expression.strength.toLowerCase()} Вам не нужно играть чужие роли — мир откликается на вашу подлинность.`
      },
      {
        id: "tension",
        title: "Спящая сверхсила и простор для роста",
        text: `Там, где вы иногда ощущаете внутренний спор между широкой дорогой (Путь ${path.number}) и вектором мечты (Направление ${direction.number}), на самом деле спрятан ваш главный запас энергии полёта. Иногда кажется непривычным место, где ${direction.positions.direction.tension.toLowerCase()}, особенно когда привычный шаг подсказывает ${path.positions.path.tension.toLowerCase()}${compoundPath ? ` Оттенок вашего маршрута (${calc.pathComposite}) бережно напоминает о масштабе: ${compoundPath.accent.toLowerCase()} ` : ''}${compoundDir ? ` А код вектора (${calc.directionComposite}) добавляет новую грань свободы: ${compoundDir.accent.toLowerCase()}` : ''}`
      },
      {
        id: "step",
        title: "Вдохновение для полёта",
        text: `Чтобы почувствовать прилив радости и простора уже сегодня, соедините крылья вашего Направления (${direction.number}) со светом вашего Результата (${result.number}). Попробуйте с лёгким сердцем и любопытством сделать то, что созвучно вашей природе: ${direction.positions.direction.recommendation.toLowerCase()} Это откроет прямой горизонт туда, где вы сможете ${result.positions.result.recommendation.toLowerCase()}${compoundRes ? ` И пусть вас окрыляет ваш итоговый код: ${compoundRes.recommendation.toLowerCase()}` : ''}`
      },
      {
        id: "resonance",
        title: "Звёздная легенда вашей природы",
        text: `"${soul.tale ? soul.tale.title : 'Созвездие Первого Света'}". Ваше внутреннее ядро (${soul.number}) звучит во Вселенной как ${soul.archetypeName.toLowerCase()}. Внутри вас дышит ${soul.core.toLowerCase()}. Когда вы доверяете своему дару (${soul.gift.toLowerCase()}) и согреваете теплом даже минуты усталости (${soul.shadow.toLowerCase()}), ваша планета-покровитель (${soul.planet}) разворачивает перед вами открытое небо возможностей.`
      }
    ],
    strengthTags: [soul.gift.split(',')[0], path.gift.split(',')[0], expression.keywords[0], direction.keywords[1]],
    tensionTags: [soul.shadow.split(',')[0], path.shadow.split(',')[0], direction.shadow.split(',')[0]],
    practicalStep: direction.practicalKey || soul.practicalKey,
    cta: {
      title: "Готовы заглянуть за горизонт своего созвездия?",
      text: "Полный звёздный атлас соединяет все пять ключей, живую матрицу талантов и попутные ветра времени в единую картину вашей свободы.",
      button: "Открыть Большое исследование"
    },
    disclaimer: "Культурно-философский и вдохновляющий формат самопознания. Не является вердиктом или гаданием. Вы — свободный автор своей жизни."
  };
}

export function generateBigResearchOutline(calc: CalculationResult): object {
  return {
    sections: [
      "Введение в Космос вашей даты",
      "Пять звёздных ключей свободы",
      `Число Души: От чего поёт сердце (${calc.soul})`,
      `Число Пути: Большая орбита движения (${calc.pathComposite || calc.path})`,
      `Число Направления: Крылья реализации (${calc.directionComposite || calc.direction})`,
      `Число Выражения: Красота проявления в мире (${calc.expressionComposite || calc.expression})`,
      `Число Результата: Звезда высокого мастерства (${calc.resultComposite || calc.result})`,
      "Составные числа: неповторимые оттенки вашей галактики",
      "Где спрятана ваша спящая сверхсила",
      "Природные таланты и точки полёта",
      "Попутный ветер и горизонт мечты",
      "Итоговое Большое Зеркало Свободы"
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
      soul: getCompSafe(calc.soulComposite),
      path: getCompSafe(calc.pathComposite),
      direction: getCompSafe(calc.directionComposite),
      expression: getCompSafe(calc.expressionComposite),
      result: getCompSafe(calc.resultComposite)
    },
    matrixAnatomy: calc.matrixAnalysis,
    personalYear: calc.personalYear,
    styleRules: [
      "писать вдохновляюще, поэтично, пробуждая в человеке радость жизни, надежду, ощущение свободы и космоса",
      "НИКАКИХ нотаций, поучений, упрёков или мрачных предупреждений",
      "показывать человеку, что он гораздо больше, талантливее и свободнее, чем привык о себе думать",
      "раскрывать индивидуальность через сочетание всех 5 ключей, составных чисел и матрицы",
      "не использовать медицинскую, эзотерическую или терапевтическую терминологию",
      "никакой фатальности — только пространство возможностей и мечты"
    ],
    safetyRules: [
      "при признаках острого небезопасного состояния, угроз себе или другим, либо потери контроля вернуть status: 'crisis'"
    ]
  };
}
