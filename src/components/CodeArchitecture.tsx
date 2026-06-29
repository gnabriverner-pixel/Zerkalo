import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Info, ArrowRight, Loader2, X, Calendar, Sun } from 'lucide-react';
import DatePicker, { registerLocale } from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { ru } from 'date-fns/locale';
import { CalculationResult, ApiResponse, FirstMirror } from '../types';

registerLocale('ru', ru);
import { calculateDigitalCode } from '../services/calculator';
import { generateFirstMirror } from '../services/interpretation';
import { numberKnowledge } from '../data/numberKnowledge';
import { FirstMirrorPanel } from './FirstMirrorPanel';
import { BigResearchTeaser } from './BigResearchTeaser';
import { CompatibilityPanel } from './CompatibilityPanel';
import { LeadModal } from './LeadModal';

const NUM_LINES: Record<string, string[]> = {
  '1': ['r1', 'c1', 'd1'], '4': ['r1', 'c2'], '7': ['r1', 'c3', 'd2'],
  '2': ['r2', 'c1'], '5': ['r2', 'c2', 'd1', 'd2'], '8': ['r2', 'c3'],
  '3': ['r3', 'c1', 'd2'], '6': ['r3', 'c2'], '9': ['r3', 'c3', 'd1']
};

const LINE_STYLES: Record<string, { bg: string, bgEmpty: string, text: string }> = {
  'r': { bg: 'bg-[var(--color-ivory)]', bgEmpty: 'bg-[var(--color-ivory)]', text: 'text-[var(--color-antique-gold)]' },
  'c': { bg: 'bg-[var(--color-ivory)]', bgEmpty: 'bg-[var(--color-ivory)]', text: 'text-[var(--color-antique-gold)]' },
  'd': { bg: 'bg-[var(--color-ivory)]', bgEmpty: 'bg-[var(--color-ivory)]', text: 'text-[var(--color-antique-gold)]' }
};

const MATRIX_CELL_MEANS: Record<string, string> = {
  '1': 'Характер, воля',
  '2': 'Энергия, действия',
  '3': 'Интерес, познание',
  '4': 'Здоровье, тело',
  '5': 'Логика, интуиция',
  '6': 'Труд, мастерство',
  '7': 'Везение, удача',
  '8': 'Долг, терпимость',
  '9': 'Память, ум'
};

const POSITION_EXPLANATIONS: Record<string, { math: string; purpose: string }> = {
  soul: {
    math: "Рассчитывается по дню вашего рождения",
    purpose: "Это ваше истинное Я, ядро характера и глубинная мотивация — то, с чем вы пришли в этот мир."
  },
  path: {
    math: "Складывается из суммы всех цифр вашей даты рождения",
    purpose: "Это ваш жизненный маршрут, дорога опыта, уроки роста и способ проявления талантов в социуме."
  },
  direction: {
    math: "Определяется из промежуточных расчетов даты",
    purpose: "Ваш внутренний компас, вектор максимального раскрытия потенциала и развития способностей."
  },
  expression: {
    math: "Складывается из числового выражения матрицы",
    purpose: "Внешняя маска, социальная роль и то, как вас считывает и воспринимает окружающий мир."
  },
  result: {
    math: "Итоговый синтез всей вашей числовой матрицы",
    purpose: "Главный плод жизни, то качество сознания, к которому вы идете в процессе эволюции души."
  }
};

const VEDIC_PLANET_MYTHS: Record<number, { name: string; myth: string }> = {
  1: {
    name: "Сурья (Солнце)",
    myth: "Источник жизненной силы, дух, воля и царское лидерство. Влияние Сурьи требует от человека проявления авторства, раскрытия внутреннего огня и способности вести за собой, не подавляя других."
  },
  2: {
    name: "Чандра (Луна)",
    myth: "Управитель ума, интуиции и чувств. Энергия Чандры учит искусству гибкости, дипломатии, эмпатии и созданию гармоничной среды вокруг себя."
  },
  3: {
    name: "Гуру (Юпитер)",
    myth: "Учитель богов, мудрость и закон. Требует от человека накопления и передачи знаний, поиска смыслов, духовного наставничества и благородства."
  },
  4: {
    name: "Раху (Северный узел)",
    myth: "Энергия новаторства, прорыва и расширения границ. Раху заставляет человека выходить за рамки привычного, созидать новое и преодолевать любые шаблоны."
  },
  5: {
    name: "Буддха (Меркурий)",
    myth: "Вестник богов, интеллект, речь и коммуникация. Влияние Буддхи наделяет человека гибкостью ума, способностью связывать людей и передавать идеи."
  },
  6: {
    name: "Шукра (Венера)",
    myth: "Учитель красоты, эстетики и гармонии. Шукра требует от человека раскрытия творческого начала, любви, тепла и создания прекрасного."
  },
  7: {
    name: "Кету (Южный узел)",
    myth: "Мистическая глубина, интуиция и освобождение. Кету обращает внимание человека внутрь себя, к тишине, мудрости предков и калибровке духа."
  },
  8: {
    name: "Шани (Сатурн)",
    myth: "Владыка кармы, времени и дисциплины. Шани учит терпению, построению прочных структур, ответственности, труду и смиренному служению."
  },
  9: {
    name: "Мангала (Марс)",
    myth: "Защитник дхармы (порядка) и огненный воин. Мангала дает смелость, силу действия, стремление защищать слабых и преданно служить своему пути."
  }
};

const MATRIX_CELL_DETAILS: Record<string, { title: string; essence: string; meanings: Record<number, string> }> = {
  '1': {
    title: "1: Характер, воля и эго",
    essence: "Сила личности, лидерский потенциал, независимость суждений и способность проявлять личную волю.",
    meanings: {
      0: "Характер ведомый, мягкий. Человеку трудно отстаивать свои границы, склонность соглашаться ради мира в окружении.",
      1: "Эгоцентризм отсутствует, дипломатичность. Комфортно работать в партнерстве, но требуется развивать уверенность.",
      2: "Гармоничный волевой стержень. Способность слушать других и при этом удерживать свои цели.",
      3: "Сильный, целеустремленный лидер. Способность вести за собой, упорство в отстаивании принципов.",
      4: "Жесткий волевой характер. Человек требует подчинения, сложно идет на компромиссы.",
      5: "Максимальная концентрация воли. Властный характер, требующий реализации в крупном бизнесе или масштабных проектах."
    }
  },
  '2': {
    title: "2: Энергия действия и тонус",
    essence: "Количество физической и биоэнергетической силы, работоспособность, тонус тела и готовность действовать.",
    meanings: {
      0: "Дефицит собственной энергии. Быстрая утомляемость, потребность в пассивном отдыхе, прогулках и сне для подзарядки.",
      1: "Дефицитная норма. Силы есть на повседневные дела, но избыточные перегрузки быстро истощают ресурс.",
      2: "Гармоничный тонус. Достаточно сил для работы, хобби и общения без эмоционального выгорания.",
      3: "Экстрасенсорный потенциал, высокая плотность поля. Человек активен, легко восстанавливается.",
      4: "Огромный запас сил. Физическая мощь, потребность в спорте или физическом труде для сброса избытка энергии.",
      5: "Сверхплотное биополе. Способность заряжать других своим присутствием, склонность к суете при застое сил."
    }
  },
  '3': {
    title: "3: Интерес и познание",
    essence: "Интеллектуальная любознательность, аналитический склад ума, тяга к науке, технологиям и деталям.",
    meanings: {
      0: "Творческий, интуитивный склад ума. Интерес к гуманитарным сферам, нелюбовь к техническим инструкциям и деталям.",
      1: "Здоровое любопытство. Быстрая обучаемость, интерес к разным сферам жизни.",
      2: "Аналитические способности. Хорошая логика, интерес к точным наукам и детальному анализу.",
      3: "Глубокий педантизм, исследовательский ум. Любовь к схемам, чертежам, инструкциям и копанию до самой сути.",
      4: "Максимальный аналитический фокус. Энциклопедический ум, склонность систематизировать всё вокруг."
    }
  },
  '4': {
    title: "4: Здоровье, тело и границы",
    essence: "Физическая выносливость, сила иммунитета, плотность тела и умение выстраивать материальные границы.",
    meanings: {
      0: "Здоровье требует бережного внимания. Слабый врожденный иммунитет, необходимость следить за питанием и режимом сна.",
      1: "Нормальное здоровье. Тело отзывчиво к спорту и заботе, выносливость средняя.",
      2: "Крепкий иммунитет. Хорошая физическая сопротивляемость болезням, выносливость выше средней.",
      3: "Выдающееся физическое здоровье. Крепкое телосложение, высокая выносливость к нагрузкам.",
      4: "Богатырская сила. Огромная плотность физического тела, устойчивость к суровым внешним условиям."
    }
  },
  '5': {
    title: "5: Логика и интуиция",
    essence: "Способность планировать, просчитывать варианты, стратегическое мышление и глубинное интуитивное предвидение.",
    meanings: {
      0: "Чувственное восприятие мира. Доверие первому импульсу, логический анализ включается только при необходимости.",
      1: "Развитая логика. Умение планировать шаги, здоровый прагматизм в решениях.",
      2: "Сильная интуиция. Способность видеть скрытые связи, предчувствовать исход событий.",
      3: "Дар визионерства. Глубокое понимание структуры любых процессов, способность делать точные долгосрочные прогнозы.",
      4: "Сверхлогический ум. Способность просчитывать сотни комбинаций, сильная интуитивная связь с инфополем."
    }
  },
  '6': {
    title: "6: Труд, мастерство и заземление",
    essence: "Профессионализм, склонность к ручному или материальному труду, практичность и связь с земными делами.",
    meanings: {
      0: "Творческая или ментальная направленность. Нежелание заниматься монотонной рутиной и физическим трудом.",
      1: "Умение работать руками. Практичность, готовность обустраивать быт собственными силами.",
      2: "Мастер на все руки. Профессионализм в выбранной сфере, глубокое понимание физических процессов.",
      3: "Выдающееся мастерство. Способность создавать материальные шедевры, сильное заземление.",
      4: "Максимальный практицизм. Способность монетизировать любое мастерство, абсолютный контроль над материей."
    }
  },
  '7': {
    title: "7: Удача и интуитивное везение",
    essence: "Степень поддержки пространства, интуитивное везение, контакт с ангелом-хранителем и раскрытие талантов.",
    meanings: {
      0: "Путь самостоятельных усилий. Человек всего добивается сам, без случайных подарков судьбы, что закаляет дух.",
      1: "Интуитивное везение. Поддержка в критические моменты жизни, верные подсказки в трудных ситуациях.",
      2: "Сильное покровительство. Жизнь ведет человека, предоставляя нужные возможности и людей в нужный момент.",
      3: "Особая жизненная миссия. Сильный поток удачи, требующий от человека следования духовному долгу.",
      4: "Абсолютная защита пространства. Человек находится под мощным куполом интуитивного ведения."
    }
  },
  '8': {
    title: "8: Долг, ответственность и карма",
    essence: "Врожденное чувство ответственности, долга перед семьей и социумом, понимание причинно-следственных законов.",
    meanings: {
      0: "Свобода от навязанных обязательств. Легкое отношение к долгу, ориентир на личные интересы.",
      1: "Здоровая ответственность. Забота о близких, честность в делах и обещаниях.",
      2: "Врожденное благородство. Сильное чувство долга, забота о справедливости и порядке в обществе.",
      3: "Гиперответственность. Человек склонен взваливать на себя проблемы всего мира, кармический долг служения.",
      4: "Абсолютное служение. Готовность жертвовать личным ради блага общества, глубочайшее понимание кармы."
    }
  },
  '9': {
    title: "9: Память, интеллект и глубина",
    essence: "Объем интеллектуальной памяти, скорость обработки информации, глубина мышления и способность удерживать знания.",
    meanings: {
      0: "Память требует тренировки. Человек быстро забывает ненужные детали, ориентируясь на ощущения.",
      1: "Хороший умственный потенциал. Быстрое усвоение информации, ясная память.",
      2: "Выдающийся интеллект. Отличная память, способность легко сопоставлять факты и учиться новому.",
      3: "Энциклопедический ум. Глубокое понимание сложных взаимосвязей, способность хранить колоссальные объемы данных.",
      4: "Сверхразум. Уникальные интеллектуальные способности, глубинная связь со знаниями прошлых поколений."
    }
  }
};

const MATRIX_LINE_DETAILS: Record<string, { title: string; essence: string; meanings: Record<string, string> }> = {
  r1: {
    title: "Физический план • Земля (1-4-7)",
    essence: "Отражает уровень заземления, практичности, здоровья и способности удерживать материальные границы. Это связь духа с плотным физическим миром.",
    meanings: {
      low: "Слабая связь с материальным миром, витание в облаках. Сложно удерживать режим, тело и быт требуют сознательного внимания.",
      medium: "Гармоничное заземление. Хорошая выносливость, умение обустраивать пространство и заботиться о физическом здоровье.",
      high: "Сверхплотная материальная опора. Упорство, высокая физическая устойчивость, сильная практичность."
    }
  },
  r2: {
    title: "Душевный/Эмоциональный план • Астрал (2-5-8)",
    essence: "Сфера чувств, интуиции, контактов, выстраивания глубоких партнерских отношений и заботы о людях.",
    meanings: {
      low: "Сдержанность чувств, склонность закрывать эмоции внутри. Трудности в открытом доверии партнеру.",
      medium: "Эмоциональная гармония. Способность любить, сопереживать, чувствовать людей и сохранять баланс в союзах.",
      high: "Эмоциональная гиперопека. Человек склонен растворяться в переживаниях близких, перегружая свое поле."
    }
  },
  r3: {
    title: "Ментальный план • Разум (3-6-9)",
    essence: "Интеллектуальный фундамент матрицы. Способность к накоплению, структурированию и передаче знаний, логике и памяти.",
    meanings: {
      low: "Творческое мышление, свобода от жестких схем. Запоминание строится на чувствах, а не на заучивании.",
      medium: "Здоровый, практичный разум. Отличная обучаемость, умение логически структурировать и применять информацию.",
      high: "Сверханалитический ум. Энциклопедическая память, педантизм, склонность перегружать себя ментальным шумом."
    }
  },
  c1: {
    title: "План Генерации • Мысль (1-2-3)",
    essence: "Показывает способность генерировать идеи, планировать будущее, ставить амбициозные задачи и верить в свои силы.",
    meanings: {
      low: "Трудности в формулировании долгосрочных планов, зависимость от внешнего руководства и одобрения.",
      medium: "Ясность мысли и целей. Способность создавать жизнеспособные идеи и уверенно смотреть вперед.",
      high: "Сверхактивный генератор концепций. Человек постоянно придумывает новое, но может не успевать воплощать."
    }
  },
  c2: {
    title: "План Реализации • Действие (4-5-6)",
    essence: "Способность претворять идеи в плотную материю, дисциплина, воля к победе, практическая работа.",
    meanings: {
      low: "Трудности с рутинной работой, склонность бросать дела на полпути, недостаток практической дисциплины.",
      medium: "Превосходная деловая хватка. Человек последовательно и методично доводит любую идею до физического продукта.",
      high: "Гиперактивность в труде. Склонность загонять себя работой до выгорания, неумение делегировать."
    }
  },
  c3: {
    title: "План Интеграции • Итог (7-8-9)",
    essence: "Умение извлекать опыт, доводить любые процессы до логического завершения и пожинать плоды.",
    meanings: {
      low: "Человек быстро теряет интерес на финише, бросая плоды труда, сложно подводить итоги.",
      medium: "Зрелая стабильность. Умение доводить проекты до завершения и закрепляться на достигнутом уровне.",
      high: "Жесткая фиксация на результатах. Страх потерять накопленное, мешающий переходу к новому циклу."
    }
  },
  d1: {
    title: "Духовный вектор • Компас (1-5-9)",
    essence: "Сила духа, следование своей дхарме (высшему призванию), верность внутренним ориентирам и восхождение сознания.",
    meanings: {
      low: "Потери ориентиров под давлением среды, частые сомнения в своем жизненном предназначении.",
      medium: "Уверенное следование внутреннему вектору. Способность чувствовать свой путь и сохранять принципы.",
      high: "Фанатичное следование идее. Человек не замечает изменений вокруг, слепо следуя своей концепции."
    }
  },
  d2: {
    title: "План Темперамента • Страсть (3-5-7)",
    essence: "Харизма, сексуальная и творческая страстность, уровень вовлеченности в чувственные аспекты жизни.",
    meanings: {
      low: "Сдержанный, холодный темперамент. Контроль чувств разумом, ориентация на покой.",
      medium: "Яркая харизма и естественный магнетизм. Умение радоваться чувствам, творить и любить.",
      high: "Взрывной темперамент. Высокая эмоциональная вовлеченность, склонность к страстным качелям в отношениях."
    }
  }
};

export function getDayEnergy(dateObj = new Date()) {
  const day = dateObj.getDate();
  const month = dateObj.getMonth() + 1;
  const year = dateObj.getFullYear();
  
  const sumDigits = (num) => num.toString().split('').reduce((acc, d) => acc + parseInt(d, 10), 0);
  
  const daySum = sumDigits(day);
  const monthSum = sumDigits(month);
  const yearSum = sumDigits(year);
  
  let total = daySum + monthSum + yearSum;
  while (total > 9) {
    total = sumDigits(total);
  }
  
  const energies = {
    1: {
      title: "Начало и Воля",
      planet: "Сурья (Солнце)",
      essence: "День мощного старта, проявления лидерства и ясности ума. Время заявлять о себе и начинать новые проекты.",
      recommendation: "Сделайте первый шаг в давно откладываемом деле. Позвольте себе быть в центре внимания."
    },
    2: {
      title: "Гармония и Связи",
      planet: "Чандра (Луна)",
      essence: "Время для партнерства, выстраивания глубоких связей, эмпатии и заботы о близких. День мягкой силы.",
      recommendation: "Проведите вечер с близкими, выслушайте друга, уделите время восстановлению душевного равновесия."
    },
    3: {
      title: "Мудрость и Знание",
      planet: "Гуру (Юпитер)",
      essence: "День обучения, поиска смыслов, планирования и принятия важных решений. Энергия Юпитера несет удачу.",
      recommendation: "Почитайте развивающую книгу, составьте план на месяц, обратитесь за советом к наставнику."
    },
    4: {
      title: "Прорыв и Новаторство",
      planet: "Раху",
      essence: "День нестандартных решений, креатива и выхода за рамки привычного. Благоприятно для IT и технологий.",
      recommendation: "Попробуйте сделать привычное дело совершенно новым способом. Доверьтесь смелым идеям."
    },
    5: {
      title: "Движение и Связь",
      planet: "Буддха (Меркурий)",
      essence: "Идеальный день для переговоров, торговли, поездок, учебы и общения. Время быстрых мыслей и гибких решений.",
      recommendation: "Напишите важное письмо, проведите встречу, обменяйтесь идеями с коллегами."
    },
    6: {
      title: "Красота и Тепло",
      planet: "Шукра (Венера)",
      essence: "День любви, эстетики, искусства и заботы о себе. Время наполняться радостью и созерцать прекрасное.",
      recommendation: "Окружите себя красотой, сходите на выставку, побалуйте себя вкусным ужином или покупкой."
    },
    7: {
      title: "Интуиция и Тишина",
      planet: "Кету",
      essence: "Время для духовных практик, самоанализа, уединения и медитации. День тишины и калибровки компаса души.",
      recommendation: "Проведите хотя бы час наедине с собой без гаджетов, побудьте на природе, прислушайтесь к интуиции."
    },
    8: {
      title: "Справедливость и Порядок",
      planet: "Шани (Сатурн)",
      essence: "День дисциплины, завершения старых дел, наведения порядка и выполнения обязательств перед близкими.",
      recommendation: "Уберитесь дома или на рабочем столе, закройте долги, проявите терпение в сложных разговорах."
    },
    9: {
      title: "Действие и Сила",
      planet: "Мангала (Марс)",
      essence: "День решительных действий, спорта, защиты справедливости и преодоления препятствий. Энергия победы.",
      recommendation: "Займитесь спортом, решительно завершите сложную задачу, проявите смелость и твердость характера."
    }
  };
  
  return {
    number: total,
    day,
    month,
    year,
    ...energies[total]
  };
}

const MATRIX_LINE_MEANS: Record<string, string> = {
  'r1': 'Физический план (Земля) (1-4-7)',
  'r2': 'Душевный план (Эмоции) (2-5-8)',
  'r3': 'Ментальный план (Разум) (3-6-9)',
  'c1': 'План Генерации (Мысли) (1-2-3)',
  'c2': 'План Реализации (Действие) (4-5-6)',
  'c3': 'План Интеграции (Итог) (7-8-9)',
  'd1': 'Духовный вектор (Компас) (1-5-9)',
  'd2': 'План Темперамента (Страсть) (3-5-7)'
};

const MeanderDivider = () => (
  <svg width="120" height="12" viewBox="0 0 120 12" fill="none" xmlns="http://www.w3.org/2000/svg" className="mx-auto my-8 opacity-40">
    <path d="M0 6H10V1H20V11H30V6H40V1H50V11H60V6H70V1H80V11H90V6H100V1H110V11H120" stroke="var(--color-antique-gold)" strokeWidth="0.5" strokeMiterlimit="10"/>
  </svg>
);



// Check if all component cells of a matrix line are non-zero (greater than 0)
const checkLineCompletion = (lineId: string, activeMatrix: Record<string, number>): { isCompleted: boolean; missing: string[] } => {
  const lineCells: Record<string, string[]> = {
    r1: ['1', '4', '7'],
    r2: ['2', '5', '8'],
    r3: ['3', '6', '9'],
    c1: ['1', '2', '3'],
    c2: ['4', '5', '6'],
    c3: ['7', '8', '9'],
    d1: ['1', '5', '9'],
    d2: ['3', '5', '7']
  };
  const cells = lineCells[lineId] || [];
  const missing = cells.filter(cell => (activeMatrix[cell] || 0) === 0);
  return {
    isCompleted: missing.length === 0,
    missing
  };
};

export default function CodeArchitecture() {
  const handleDateInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, ''); // strip all non-digits
    if (val.length > 8) val = val.substring(0, 8);
    
    let formatted = '';
    if (val.length > 0) {
      formatted += val.substring(0, 2);
    }
    if (val.length > 2) {
      formatted += '.' + val.substring(2, 4);
    }
    if (val.length > 4) {
      formatted += '.' + val.substring(4, 8);
    }
    
    setDate(formatted);

    // If fully entered, parse to sync calendar
    if (formatted.length === 10) {
      const parts = formatted.split('.');
      const d = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const y = parseInt(parts[2], 10);
      const parsedDate = new Date(y, m, d);
      if (!isNaN(parsedDate.getTime()) && y > 1000 && y < 9999) {
        setSelectedDate(parsedDate);
      }
    } else {
      setSelectedDate(null);
    }
  };

  const [date, setDate] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [result, setResult] = useState<CalculationResult | null>(null);
  const [reading, setReading] = useState<FirstMirror | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorInfo, setErrorInfo] = useState<{ message: string, type: string } | null>(null);
  const [matrixType, setMatrixType] = useState<'base' | 'detailed'>('detailed');
  const [hoveredLines, setHoveredLines] = useState<string[]>([]);
  const [selectedCell, setSelectedCell] = useState<string | null>(null);
  const [selectedLine, setSelectedLine] = useState<string | null>(null);
  const [selectedMainNumber, setSelectedMainNumber] = useState<{title: string, value: number, pos: string} | null>(null);
  
  const [showLeadModal, setShowLeadModal] = useState(false);
  const [demoNotice, setDemoNotice] = useState('');
  const [consentChecked, setConsentChecked] = useState(true);

  const matrixRef = useRef<HTMLDivElement>(null);
  const activeMatrix = result ? (matrixType === 'base' ? result.baseMatrix : result.detailedMatrix) : {};
  const getCount = (digits: string) => digits.split('').reduce((acc, d) => acc + (activeMatrix[d] || 0), 0);
  
  const handleCalculate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consentChecked) return;
    setErrorInfo(null);
    setSelectedCell(null);
    setSelectedLine(null);
    setHoveredLines([]);
    
    const regex = /^(\d{2})\.(\d{2})\.(\d{4})$/;
    const match1 = date.match(regex);
    
    if (match1) {
      const day1 = parseInt(match1[1], 10);
      const month1 = parseInt(match1[2], 10);
      
      if (day1 > 0 && day1 <= 31 && month1 > 0 && month1 <= 12) {
        const calc = calculateDigitalCode(date);
        
        setResult(calc);
        setReading(null);
        setDemoNotice('');
        setIsGenerating(true);

        try {
          const res = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mode: 'code', date, calc })
          });
          
          const data: ApiResponse = await res.json();
          if (data.status === 'ok' && data.code_result?.first_mirror) {
            setReading(data.code_result.first_mirror);
          } else if (data.status === 'error' || data.status === 'demo') {
             if (data.ui?.safe_message && data.status === 'demo') {
               setDemoNotice(data.ui.safe_message);
               setReading(data.code_result?.first_mirror || generateFirstMirror(calc));
             } else if (data.status === 'error' && data.ui?.safe_message) {
               setErrorInfo({ message: data.ui.safe_message, type: "network" });
               setDemoNotice("Показана базовая версия первого слоя.");
               setReading(data.code_result?.first_mirror || generateFirstMirror(calc));
             } else {
               setDemoNotice("Показана базовая версия первого слоя.");
               setReading(data.code_result?.first_mirror || generateFirstMirror(calc));
             }
          } else if (data.code_result?.first_mirror) {
             setReading(data.code_result.first_mirror);
          } else {
             setReading(generateFirstMirror(calc));
          }
        } catch (err) {
          console.error(err);
          setErrorInfo({ message: "Ошибка при получении данных. Пожалуйста, проверьте подключение к интернету.", type: "network" });
          setReading(generateFirstMirror(calc));
        } finally {
          setIsGenerating(false);
          setTimeout(() => {
             matrixRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 100);
        }
      } else {
        setErrorInfo({ message: "Некорректная дата. Проверьте день и месяц.", type: "validation" });
      }
    } else {
      setErrorInfo({ message: "Формат: ДД.ММ.ГГГГ", type: "validation" });
    }
  };

  const handlePdfRequest = () => {
    const cleanDate = date.replace(/\./g, '');
    const dateQuery = cleanDate.length === 8 ? `?start=dob_${cleanDate}` : '';
    window.open(`https://t.me/digitalcodesystem_bot${dateQuery}`, '_blank', 'noopener,noreferrer');
  };

      const NumberCard = ({ title, pos, value, composite, delay }: { title: string, pos: string, value: number, composite: string, delay: number }) => {
    const isSelected = selectedMainNumber?.title === title;
    const numKey = value === 11 ? 11 : (value > 9 ? value % 9 || 9 : value); // handle higher numbers if happen
    const numInfo = numberKnowledge[numKey] || numberKnowledge[1];
    
    const [showTooltip, setShowTooltip] = useState(false);

    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0, scale: isSelected ? 1.02 : 1 }}
        transition={{ duration: 0.8, delay: (isSelected) ? 0 : delay, ease: [0.16, 1, 0.3, 1] }}
        className={`flex flex-col items-center p-8 md:p-10 bg-[var(--color-surface)] bg-marble ${isSelected ? 'bg-gradient-to-br from-[var(--color-ivory)] to-[#f2eee3] z-10 shadow-[0_40px_100px_rgba(30,25,18,0.18)]' : 'hover:bg-[var(--color-ivory)] hover:z-10 hover:shadow-2xl'} relative overflow-visible group transition-all duration-700 w-full outline-none border hover:border-[var(--color-antique-gold)] hover:border-opacity-30 ${isSelected ? 'border-[var(--color-antique-gold)] border-opacity-50' : 'border-transparent'}`}
      >
        <div className={`absolute top-4 left-4 w-4 h-4 border-t border-l border-[var(--color-antique-gold)] transition-opacity duration-700 ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-60'}`}></div>
        <div className={`absolute top-4 right-4 w-4 h-4 border-t border-r border-[var(--color-antique-gold)] transition-opacity duration-700 ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-60'}`}></div>
        <div className={`absolute bottom-4 left-4 w-4 h-4 border-b border-l border-[var(--color-antique-gold)] transition-opacity duration-700 ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-60'}`}></div>
        <div className={`absolute bottom-4 right-4 w-4 h-4 border-b border-r border-[var(--color-antique-gold)] transition-opacity duration-700 ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-60'}`}></div>
        
        {/* Helper Tooltip Icon */}
        <div 
          className="absolute top-5 right-5 z-20"
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
        >
          <Info className="w-4 h-4 text-[var(--color-muted)] opacity-50 relative top-2 right-2 hover:opacity-100 hover:text-[var(--color-antique-gold)] cursor-help transition-colors" />
          <AnimatePresence>
            {showTooltip && (
              <motion.div 
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 5 }}
                className="absolute right-0 top-6 w-56 bg-white/95 backdrop-blur-md text-[var(--color-ink)] p-4 shadow-2xl z-50 pointer-events-none rounded-sm border border-[var(--border-soft)]"
              >
                <p className="font-serif italic text-sm text-[var(--color-antique-gold)] mb-2 tracking-wide">{numInfo?.luxuryName}</p>
                <p className="font-sans text-xs leading-relaxed text-[var(--color-graphite)] shadow-sm">{numInfo?.core}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        
        <span className={`font-serif text-[1.1rem] tracking-[0.15em] mb-6 z-10 transition-colors duration-500 uppercase text-[var(--color-muted)]`}>
          {title}
        </span>
        <button type="button" onClick={() => { setSelectedMainNumber(isSelected ? null : {title, value, pos}); setSelectedCell(null); setSelectedLine(null); }} className="flex flex-col items-center z-10 mb-4 cursor-pointer outline-none">
          <span className={`font-serif text-6xl md:text-7xl leading-none transition-colors duration-700 ${isSelected ? 'text-[var(--color-antique-gold)] drop-shadow-sm' : 'text-[var(--color-ink)]'}`}>
            {value}
          </span>
          {composite !== value.toString() ? (
            <span className={`font-sans text-[0.65rem] mt-4 tracking-[0.25em] uppercase transition-colors duration-500 ${isSelected ? 'text-[var(--color-antique-gold)] opacity-80' : 'text-[var(--color-muted)]'}`}>
              {composite}
            </span>
          ) : (
            <span className="font-sans text-[0.65rem] mt-4 opacity-0 select-none tracking-[0.2em] uppercase">—</span>
          )}
        </button>
        <span className="font-sans text-[10px] tracking-[0.2em] uppercase text-[var(--color-muted)] mb-2 opacity-80">{numInfo?.planet || 'Нет планеты'}</span>
        <span className="font-serif text-sm italic text-[var(--color-graphite)] line-clamp-1">{numInfo?.luxuryName || ''}</span>
      </motion.div>
    );
  };

  return (
    <div className="flex flex-col items-center py-20 px-4 sm:px-6 lg:px-8 w-full text-[var(--color-ink)] font-sans">
      
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
        className="text-center mb-16 pt-10 relative"
      >
        {/* Sacred Geometry Astronomical Dial Backing */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[380px] h-[380px] md:w-[480px] md:h-[480px] pointer-events-none opacity-[0.24] select-none z-0">
          <svg viewBox="0 0 200 200" className="w-full h-full stroke-[var(--color-antique-gold)]/60 fill-none stroke-[0.35] animate-slow-rotate">
            {/* Concentric rings */}
            <circle cx="100" cy="100" r="96" stroke-dasharray="3,1"/>
            <circle cx="100" cy="100" r="88"/>
            <circle cx="100" cy="100" r="68" stroke-dasharray="5,2"/>
            <circle cx="100" cy="100" r="48"/>
            <circle cx="100" cy="100" r="28" stroke-dasharray="2,2"/>
            
            {/* Greek Meander Dotted Compass Lines */}
            <line x1="100" y1="4" x2="100" y2="196" stroke-dasharray="1,4"/>
            <line x1="4" y1="100" x2="196" y2="100" stroke-dasharray="1,4"/>
            <path d="M32,32 L168,168 M32,168 L168,32" stroke-dasharray="2,3"/>

            {/* Surya (Vedic Sun wheel) spokes in the center */}
            {Array.from({ length: 8 }).map((_, idx) => {
              const angle = (idx * 45 * Math.PI) / 180;
              const x1 = 100 + 8 * Math.cos(angle);
              const y1 = 100 + 8 * Math.sin(angle);
              const x2 = 100 + 26 * Math.cos(angle);
              const y2 = 100 + 26 * Math.sin(angle);
              return <line key={idx} x1={x1} y1={y1} x2={x2} y2={y2} />;
            })}
            
            {/* Center Surya Circle */}
            <circle cx="100" cy="100" r="8" fill="rgba(200, 164, 93, 0.05)" />

            {/* Chandra (Vedic Lunar Crescent) */}
            <path d="M 103,94 A 8,8 0 0,0 103,106 A 6,6 0 0,1 103,94" fill="rgba(200, 164, 93, 0.15)" stroke="none" />

            {/* Greek Constellation Stars (Nakshatras) */}
            <circle cx="100" cy="20" r="1.5" fill="var(--color-antique-gold)"/>
            <circle cx="100" cy="180" r="1.5" fill="var(--color-antique-gold)"/>
            <circle cx="20" cy="100" r="1.5" fill="var(--color-antique-gold)"/>
            <circle cx="180" cy="100" r="1.5" fill="var(--color-antique-gold)"/>
            <circle cx="44" cy="44" r="1" fill="var(--color-antique-gold)"/>
            <circle cx="156" cy="156" r="1" fill="var(--color-antique-gold)"/>
            <circle cx="44" cy="156" r="1" fill="var(--color-antique-gold)"/>
            <circle cx="156" cy="44" r="1" fill="var(--color-antique-gold)"/>

            {/* Outer coordinate divisions (Nakshatra zones) */}
            {Array.from({ length: 24 }).map((_, idx) => {
              const angle = (idx * 15 * Math.PI) / 180;
              const x1 = 100 + 88 * Math.cos(angle);
              const y1 = 100 + 88 * Math.sin(angle);
              const x2 = 100 + 96 * Math.cos(angle);
              const y2 = 100 + 96 * Math.sin(angle);
              return <line key={idx} x1={x1} y1={y1} x2={x2} y2={y2} />;
            })}
          </svg>
        </div>
        <h1 className="font-serif text-5xl md:text-7xl tracking-widest uppercase mb-6 text-[var(--color-ink)] drop-shadow-sm">
          Архитектура<br className="md:hidden" /> Кода
        </h1>
        <p className="font-sans text-xs md:text-sm tracking-[0.4em] uppercase text-[var(--color-antique-gold)] opacity-90 mb-4">
          Познай самого себя
        </p>
        <MeanderDivider />
        
        {/* Vedic Day Energy Widget */}
        {(() => {
          const dayEnergy = getDayEnergy();
          return (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1 }}
              className="max-w-md mx-auto mb-10 p-5 bg-white/40 backdrop-blur-md border border-[var(--border-soft)] rounded-2xl shadow-sm relative overflow-hidden flex flex-col items-center text-center"
            >
              <div className="flex items-center gap-2 mb-2 text-[var(--color-antique-gold)]">
                <Sun className="w-4 h-4 animate-spin-slow" />
                <span className="text-[10px] tracking-[0.2em] uppercase font-semibold">Энергия дня • {dayEnergy.day}.{String(dayEnergy.month).padStart(2, '0')}.{dayEnergy.year}</span>
              </div>
              <h4 className="font-serif text-2xl text-[var(--color-ink)] mb-1">
                Число дня: <span className="font-semibold text-[var(--color-antique-gold)]">{dayEnergy.number}</span> — {dayEnergy.title}
              </h4>
              <p className="font-sans text-[10px] tracking-widest uppercase text-[var(--color-muted)] mb-3">{dayEnergy.planet}</p>
              <p className="font-serif text-sm italic text-[var(--color-graphite)] leading-relaxed px-4 mb-4">
                "{dayEnergy.essence}"
              </p>
              <div className="text-left bg-[var(--color-ivory)]/70 p-3 border-l-2 border-[var(--color-antique-gold)] w-full rounded-sm">
                <span className="font-sans text-[8px] tracking-[0.15em] uppercase text-[var(--color-muted)] block mb-1 font-semibold">Рекомендация на сегодня</span>
                <p className="font-serif text-xs text-[var(--color-graphite)]">{dayEnergy.recommendation}</p>
              </div>
            </motion.div>
          );
        })()}

        <div className="relative inline-block mt-4">
          <div className="absolute -left-8 -top-8 w-16 h-16 bg-[var(--color-antique-gold)] opacity-5 blur-2xl rounded-full"></div>
          <p className="font-serif text-[1.1rem] md:text-xl text-[var(--color-muted)] max-w-md mx-auto italic leading-relaxed relative z-10">
            Введите дату рождения — система покажет первый слой вашей внутренней архитектуры.
          </p>
        </div>
      </motion.div>

      {/* Input Form */}
      <motion.form 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 0.3 }}
        onSubmit={handleCalculate} 
        className="w-full max-w-lg flex flex-col items-center mb-16"
      >
        <div className="w-full space-y-4">
          <div className="relative w-full flex items-center group bg-white/40 backdrop-blur-md rounded-lg shadow-sm border border-[var(--border-soft)] hover:shadow-md transition-shadow">
            {/* Calendar popover trigger */}
            <div className="absolute left-3 z-20 flex items-center">
              <DatePicker
                selected={selectedDate}
                onChange={(d: Date | null) => {
                  setSelectedDate(d);
                  if (d) {
                    const dayStr = String(d.getDate()).padStart(2, '0');
                    const monthStr = String(d.getMonth() + 1).padStart(2, '0');
                    const yearStr = String(d.getFullYear());
                    setDate(`${dayStr}.${monthStr}.${yearStr}`);
                  } else {
                    setDate('');
                  }
                }}
                customInput={
                  <button type="button" className="p-2 text-[var(--color-muted)] hover:text-[var(--color-antique-gold)] transition-colors cursor-pointer outline-none">
                    <Calendar className="w-5 h-5" strokeWidth={1.5} />
                  </button>
                }
                dateFormat="dd.MM.yyyy"
                locale="ru"
                showYearDropdown
                showMonthDropdown
                dropdownMode="select"
                popperContainer={({ children }) => createPortal(children, document.body)}
              />
            </div>
            
            {/* Masked Text Input */}
            <input
              type="text"
              value={date}
              onChange={handleDateInputChange}
              placeholder="ДД.ММ.ГГГГ"
              className="w-full bg-transparent text-center font-serif text-2xl md:text-3xl py-6 outline-none transition-colors placeholder:text-[var(--color-muted)]/50 text-[var(--color-ink)] px-16 relative z-10"
            />
            <button 
              type="submit" 
              disabled={isGenerating || date.length !== 10 || !consentChecked}
              className="absolute right-3 p-4 bg-transparent text-[var(--color-ink)]/70 hover:text-[var(--color-antique-gold)] transition-all disabled:opacity-30 disabled:hover:text-[var(--color-ink)]/70 z-20 cursor-pointer"
            >
              {isGenerating ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <ArrowRight className="w-6 h-6" strokeWidth={1.5} />
              )}
            </button>
          </div>
          
          <div className="pt-2 flex items-center justify-center gap-3 w-full">
            <input 
              type="checkbox" 
              id="consent" 
              checked={consentChecked}
              onChange={(e) => setConsentChecked(e.target.checked)}
              className="w-4 h-4 accent-[var(--color-antique-gold)] cursor-pointer"
            />
            <label htmlFor="consent" className="text-xs text-[var(--color-muted)] cursor-pointer select-none">
              Я согласен с <a href="/privacy.html" target="_blank" className="underline hover:text-[var(--color-antique-gold)]">Политикой обработки персональных данных</a>
            </label>
          </div>
        </div>
      </motion.form>

      {/* Error Display */}
      <AnimatePresence mode="wait">
        {errorInfo && (
           <motion.div 
             initial={{ opacity: 0, y: -10 }}
             animate={{ opacity: 1, y: 0 }}
             exit={{ opacity: 0, y: -10 }}
             className="mb-10 max-w-md text-center text-red-900 bg-red-50/50 p-4 font-sans text-sm border border-red-100"
           >
             {errorInfo.message}
           </motion.div>
        )}
      </AnimatePresence>

      {/* Results */}
      <AnimatePresence mode="wait">
        {isGenerating ? (
          <motion.div 
            key="skeleton"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-full max-w-4xl flex flex-col items-center"
          >
            <div className="flex flex-col items-center gap-3 mb-10 w-full text-center">
              <div className="h-10 w-64 bg-[var(--color-marble)] animate-pulse rounded-full mb-1"></div>
              <MeanderDivider />
            </div>

            {/* Skeleton Grid */}
            <div className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-px bg-[var(--border-soft)] border border-[var(--border-soft)] w-full mb-16 shadow-lg`}>
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className={`flex flex-col items-center p-8 bg-[var(--color-surface)] ${i === 5 ? 'sm:col-span-2 md:col-span-1' : ''} bg-marble relative overflow-hidden`}>
                  <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-[var(--color-ivory)] to-transparent opacity-30 animate-pulse"></div>
                  <div className="h-3 w-16 bg-[var(--color-antique-gold)]/20 rounded-full animate-pulse mb-6"></div>
                  <div className="h-14 w-12 bg-[var(--color-ink)]/10 rounded-md animate-pulse mb-4"></div>
                  <div className="h-2 w-10 bg-[var(--color-muted)]/20 rounded-full animate-pulse mb-8"></div>
                  <div className="h-[2px] w-20 bg-[var(--color-border)]/20 animate-pulse"></div>
                </div>
              ))}
            </div>

            {/* Skeleton Matrix */}
            <div className="w-full flex flex-col items-center mb-16">
               <div className="h-6 w-48 bg-[var(--color-marble)] animate-pulse mb-10"></div>
               <div className="grid grid-cols-4 gap-px bg-[var(--border-soft)] border border-[var(--border-soft)] shadow-sm">
                 {Array.from({ length: 16 }).map((_, i) => (
                   <div key={i} className="w-16 h-16 sm:w-20 sm:h-20 bg-[var(--color-surface)] animate-pulse"></div>
                 ))}
               </div>
            </div>

            {/* Skeleton First Mirror Panel */}
            <div className="w-full flex flex-col items-center mb-12">
               <div className="w-full h-96 bg-[var(--color-surface)] border border-[var(--border-soft)] p-8 animate-pulse">
                  <div className="flex justify-between w-full h-12 mb-8">
                     <div className="h-8 w-48 bg-[var(--color-marble)]"></div>
                     <div className="h-6 w-32 bg-[var(--color-marble)]"></div>
                  </div>
                  <div className="h-4 w-full bg-[var(--color-marble)] mb-4"></div>
                  <div className="h-4 w-5/6 bg-[var(--color-marble)] mb-4"></div>
                  <div className="h-4 w-4/6 bg-[var(--color-marble)] mb-8"></div>
                  
                  <div className="grid grid-cols-2 gap-8 pt-8">
                     <div className="h-24 w-full bg-[var(--color-marble)]"></div>
                     <div className="h-24 w-full bg-[var(--color-marble)]"></div>
                  </div>
               </div>
            </div>
          </motion.div>
        ) : result && (
          <motion.div 
            key="results"
            layout
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-full max-w-4xl flex flex-col items-center"
          >
            <div className="flex flex-col items-center gap-3 mb-10 w-full text-center">
              <h2 className="font-serif text-3xl text-[var(--color-ink)] mb-1">Архитектура Кода</h2>
              <MeanderDivider />
            </div>

            {/* 5 Main Numbers Grid */}
            <div className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-px bg-[var(--border-soft)] border border-[var(--border-soft)] w-full ${selectedMainNumber ? 'mb-2' : 'mb-16'} transition-all duration-500`}>
              <NumberCard title="Душа" pos="soul" value={result.soul} composite={result.soulComposite} delay={0.1} />
              <NumberCard title="Путь" pos="path" value={result.path} composite={result.pathComposite} delay={0.2} />
              <NumberCard title="Направление" pos="direction" value={result.direction} composite={result.directionComposite} delay={0.3} />
              <NumberCard title="Выражение" pos="expression" value={result.expression} composite={result.expressionComposite} delay={0.4} />
               <div className="sm:col-span-2 md:col-span-1">
                 <NumberCard title="Результат" pos="result" value={result.result} composite={result.resultComposite} delay={0.5} />
               </div>
            </div>

            {/* Main Number Detail Modal/Section */}
            <AnimatePresence>
              {selectedMainNumber && (() => {
                const numVal = selectedMainNumber.value;
                const numKey = numVal === 11 ? 11 : (numVal > 9 ? numVal % 9 || 9 : numVal);
                const knowledge = numberKnowledge[numKey] || numberKnowledge[1];
                const pt = selectedMainNumber.pos as keyof typeof knowledge.positions;
                const posData = knowledge.positions[pt] || { title: "", essence: "", strength: "", tension: "", recommendation: "" };
                const posExplanation = POSITION_EXPLANATIONS[selectedMainNumber.pos] || { math: "", purpose: "" };
                const vedicMyth = VEDIC_PLANET_MYTHS[numKey];

                return (
                  <motion.div
                    initial={{ opacity: 0, height: 0, y: -10 }}
                    animate={{ opacity: 1, height: 'auto', y: 0 }}
                    exit={{ opacity: 0, height: 0, y: -10 }}
                    className="w-full overflow-hidden mb-16"
                  >
                    <div className="p-8 md:p-12 bg-white/60 backdrop-blur-sm border border-[var(--border-soft)] shadow-[var(--shadow-luxury)] relative overflow-hidden rounded-sm">
                      <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-transparent via-[var(--color-antique-gold)] to-transparent opacity-60"></div>
                      <div className="absolute -left-20 -top-20 w-64 h-64 bg-[var(--color-antique-gold)] opacity-5 blur-[100px] pointer-events-none"></div>
                      
                      {/* Top Header Row */}
                      <div className="flex justify-between items-start mb-10 pb-6 border-b border-[var(--border-soft)]">
                        <div>
                           <div className="flex items-center gap-4">
                             <span className="font-serif text-5xl md:text-6xl text-[var(--color-antique-gold)] font-semibold leading-none">{numVal}</span>
                             <div>
                               <h3 className="font-serif text-3xl md:text-4xl text-[var(--color-ink)] tracking-wide">{posData.title}</h3>
                               <p className="font-sans text-[0.65rem] uppercase tracking-[0.2em] text-[var(--color-muted)] mt-2">{posExplanation.math}</p>
                             </div>
                           </div>
                        </div>
                        <button 
                          onClick={() => setSelectedMainNumber(null)}
                          className="text-[var(--color-muted)] hover:text-[var(--color-ink)] bg-white/50 hover:bg-white rounded-full transition-all p-3 shadow-sm border border-transparent hover:border-[var(--border-soft)] cursor-pointer"
                        >
                          <X className="w-6 h-6" strokeWidth={1} />
                        </button>
                      </div>

                      {/* Position purpose explaining its architectural meaning */}
                      <div className="bg-[var(--color-ivory)]/80 p-5 border-l-2 border-[var(--color-antique-gold)] mb-8">
                        <span className="font-sans text-[0.65rem] tracking-[0.15em] uppercase text-[var(--color-antique-gold)] block mb-1 font-semibold">Роль в архитектуре</span>
                        <p className="font-serif text-[1.1rem] leading-relaxed text-[var(--color-graphite)]">{posExplanation.purpose}</p>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                         <div className="md:col-span-2 space-y-6">
                            <div>
                               <span className="font-sans text-[0.65rem] tracking-[0.15em] uppercase text-[var(--color-muted)] block mb-2 font-medium">Суть проявления</span>
                               <p className="font-serif text-[1.15rem] leading-relaxed text-[var(--color-graphite)] italic">
                                 "{posData.essence}"
                               </p>
                            </div>
                            
                            <div>
                               <h4 className="font-sans text-[0.65rem] tracking-[0.15em] uppercase text-[var(--color-muted)] mb-2">Проявление силы</h4>
                               <p className="font-serif text-lg leading-relaxed text-[var(--color-ink)]">{posData.strength}</p>
                            </div>
                            
                            <div>
                               <h4 className="font-sans text-[0.65rem] tracking-[0.15em] uppercase text-[var(--color-muted)] mb-2">Точка напряжения</h4>
                               <p className="font-serif text-lg leading-relaxed text-[var(--color-ink)]">{posData.tension}</p>
                            </div>
                            
                            {posData.recommendation && (
                              <div className="bg-[var(--color-ivory)] p-4 border border-[var(--border-soft)]">
                                 <h4 className="font-sans text-[0.65rem] tracking-[0.15em] uppercase text-[var(--color-muted)] mb-2 font-semibold">Внутреннее наблюдение</h4>
                                 <p className="font-serif text-[1.05rem] leading-relaxed text-[var(--color-graphite)]">{posData.recommendation}</p>
                              </div>
                            )}
                         </div>

                         {/* Vedic / Cosmological Sidebar */}
                         <div className="bg-[var(--color-marble)] p-6 border border-[var(--border-soft)] flex flex-col gap-6">
                            {vedicMyth && (
                              <div>
                                 <h4 className="font-sans text-[0.65rem] tracking-[0.15em] uppercase text-[var(--color-antique-gold)] mb-3 font-semibold">Ведический управитель</h4>
                                 <span className="font-serif text-xl text-[var(--color-ink)] block mb-2">{vedicMyth.name}</span>
                                 <p className="font-serif text-xs leading-relaxed text-[var(--color-muted)]">{vedicMyth.myth}</p>
                              </div>
                            )}
                            
                            <hr className="border-[var(--border-soft)]" />

                            <div>
                               <h4 className="font-sans text-[0.65rem] tracking-[0.15em] uppercase text-[var(--color-muted)] mb-3">Ядро энергии</h4>
                               <p className="font-serif text-[1.05rem] leading-relaxed text-[var(--color-graphite)]">{knowledge.core}</p>
                            </div>

                            <div>
                               <h4 className="font-sans text-[0.65rem] tracking-[0.15em] uppercase text-[var(--color-muted)] mb-3">Смысловые теги</h4>
                               <div className="flex flex-wrap gap-1.5">
                                 {knowledge.keywords.map(kw => (
                                   <span key={kw} className="font-sans text-[10px] text-[var(--color-ink)] px-2.5 py-1 bg-white border border-[var(--border-soft)] rounded-full">{kw}</span>
                                 ))}
                               </div>
                            </div>
                         </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })()}
            </AnimatePresence>
            {/* Matrix Section */}
            <motion.div 
              layout
              ref={matrixRef}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.7 }}
              className="w-full flex flex-col items-center mb-16"
            >
              <div className="flex flex-col items-center">
                <div className="flex gap-8 mb-10">
                  <button 
                    type="button"
                    onClick={() => setMatrixType('base')}
                    className={`font-sans text-xs tracking-[0.2em] uppercase transition-all duration-300 pb-2 outline-none ${matrixType === 'base' ? 'text-[var(--color-ink)] border-b border-[var(--color-antique-gold)] opacity-100' : 'text-[var(--color-muted)] border-b border-transparent opacity-60 hover:opacity-100'}`}
                  >
                    Базовая
                  </button>
                  <button 
                    type="button"
                    onClick={() => setMatrixType('detailed')}
                    className={`font-sans text-xs tracking-[0.2em] uppercase transition-all duration-300 pb-2 outline-none ${matrixType === 'detailed' ? 'text-[var(--color-ink)] border-b border-[var(--color-antique-gold)] opacity-100' : 'text-[var(--color-muted)] border-b border-transparent opacity-60 hover:opacity-100'}`}
                  >
                    Детальная
                  </button>
                </div>
                
                <div className="grid grid-cols-4 gap-px bg-[var(--border-soft)] border border-[var(--border-soft)] shadow-sm bg-[var(--color-surface)]">
                  {(() => {
                    const isD1Active = hoveredLines.includes('d1') || (!!selectedCell && NUM_LINES[selectedCell]?.includes('d1'));
                    const isD2Active = hoveredLines.includes('d2') || (!!selectedCell && NUM_LINES[selectedCell]?.includes('d2'));
                    const isAnyDActive = isD1Active || isD2Active;

                    const d1Completion = checkLineCompletion('d1', activeMatrix);
                    const d2Completion = checkLineCompletion('d2', activeMatrix);
                    const isD1Completed = d1Completion.isCompleted;
                    const isD2Completed = d2Completion.isCompleted;
                    const isAnyDiagonalCompleted = isD1Completed || isD2Completed;
                    const r1 = getCount('147');
                    const r2 = getCount('258');
                    const r3 = getCount('369');
                    const c1 = getCount('123');
                    const c2 = getCount('456');
                    const c3 = getCount('789');
                    const d1 = getCount('159');
                    const d2 = getCount('357');

                    const MatrixCell = ({ num, index }: { num: string, index: number }) => {
                      const count = activeMatrix[num] || 0;
                      const hoverLine = hoveredLines.find(line => NUM_LINES[num].includes(line));
                      const isHovered = !!hoverLine;
                      const isSelected = selectedCell === num;
                      const cellMeaning = MATRIX_CELL_MEANS[num] || `Качество ${num}`;
                      
                      let bgColor = "bg-[var(--color-surface)] bg-marble";
                      let textColor = "text-[var(--color-ink)]";
                      let content = <span className="font-sans text-sm text-[var(--color-border)] opacity-60">—</span>;

                      if (count > 0) {
                        content = <span className={`font-serif text-2xl sm:text-3xl ${count >= 3 ? 'font-medium' : ''}`}>{num.repeat(count)}</span>;
                      }

                      if (isSelected) {
                        bgColor = "bg-[var(--color-ivory)] bg-marble z-20 relative opacity-100 shadow-[var(--shadow-luxury)] border-none ring-1 ring-[var(--color-antique-gold)]";
                        if (count >= 3) textColor = "text-[var(--color-antique-gold)] drop-shadow-sm";
                      } else if (isHovered && hoverLine) {
                        bgColor = count > 0 ? LINE_STYLES['r'].bg : LINE_STYLES['r'].bgEmpty;
                        textColor = LINE_STYLES['r'].text;
                      } else if (count > 0) {
                        bgColor = count >= 3 ? "bg-[var(--color-ivory)] bg-marble border-none" : "bg-[var(--color-surface)] bg-marble border-none";
                        if (count >= 3) textColor = "text-[var(--color-antique-gold)] drop-shadow-sm";
                      }

                      return (
                        <motion.button
                          key={`${matrixType}-${num}`}
                          title={`${cellMeaning}: ${count} цифр`}
                          onClick={() => { setSelectedCell(selectedCell === num ? null : num); setSelectedLine(null); setSelectedMainNumber(null); }}
                          onMouseEnter={() => setHoveredLines(NUM_LINES[num])}
                          onMouseLeave={() => setHoveredLines([])}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: isSelected ? 1.05 : 1 }}
                          whileHover={{ scale: isSelected ? 1.05 : 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          transition={{ duration: 0.4, delay: (isSelected || isHovered) ? 0 : index * 0.02, ease: [0.16, 1, 0.3, 1] }}
                          className={`w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center outline-none transition-colors duration-500 cursor-pointer ${bgColor} ${textColor} ${isSelected ? 'z-20' : 'hover:z-10 box-border'}`}
                        >
                          {content}
                        </motion.button>
                      );
                    };

                                        const LineSum = ({ label, value, index, lineId }: { label: string, value: number, index: number, lineId: string }) => {
                      const isHovered = hoveredLines.includes(lineId) || (!!selectedCell && NUM_LINES[selectedCell]?.includes(lineId)) || selectedLine === lineId;
                      const isSelected = selectedLine === lineId;
                      const lineMeaning = MATRIX_LINE_MEANS[lineId] || label;
                      
                      // Check if completed line by birthdate
                      const completion = checkLineCompletion(lineId, activeMatrix);
                      const isLineCompleted = completion.isCompleted;
                      
                      return (
                        <motion.button
                          type="button"
                          key={`${matrixType}-${label}`}
                          title={`Линия «${lineMeaning}»: сумма ${value} цифр`}
                          onClick={() => { setSelectedLine(isSelected ? null : lineId); setSelectedCell(null); setSelectedMainNumber(null); }}
                          onMouseEnter={() => setHoveredLines([lineId])}
                          onMouseLeave={() => setHoveredLines([])}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: isSelected ? 1.05 : isHovered ? 1.02 : 1 }}
                          whileHover={{ scale: isSelected ? 1.05 : 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          transition={{ duration: 0.4, delay: isHovered ? 0 : index * 0.02, ease: [0.16, 1, 0.3, 1] }}
                          className={`w-16 h-16 sm:w-20 sm:h-20 flex flex-col items-center justify-center outline-none transition-colors duration-500 cursor-pointer ${isSelected ? 'bg-[var(--color-ivory)] bg-marble z-20 relative opacity-100 shadow-[var(--shadow-luxury)] ring-1 ring-[var(--color-antique-gold)]' : isLineCompleted ? 'bg-[var(--color-ivory)] bg-marble z-10 border border-[var(--color-antique-gold)] border-opacity-40 shadow-sm' : isHovered ? LINE_STYLES['r'].bg + ' z-20 shadow-[var(--shadow-luxury)] ring-1 ring-[var(--color-antique-gold)]/40' : 'bg-[var(--color-surface)] bg-marble border-none shadow-sm'}`}
                        >
                          <span className={`font-serif text-lg transition-colors duration-300 ${isSelected || isHovered ? LINE_STYLES['r'].text : (value >= 5 ? 'text-[var(--color-antique-gold)]' : 'text-[var(--color-muted)]')}`}>{value}</span>
                          <span className={`text-[0.45rem] sm:text-[0.55rem] tracking-widest uppercase mt-1 transition-colors duration-300 ${isSelected || isHovered ? LINE_STYLES['r'].text : 'text-[var(--color-muted)] opacity-60'}`}>{label}</span>
                        </motion.button>
                      );
                    };

                    return (
                      <>
                        {/* ROW 1 */}
                        <MatrixCell num="1" index={0} />
                        <MatrixCell num="4" index={1} />
                        <MatrixCell num="7" index={2} />
                        <LineSum label="Земля" value={r1} index={3} lineId="r1" />

                        {/* ROW 2 */}
                        <MatrixCell num="2" index={4} />
                        <MatrixCell num="5" index={5} />
                        <MatrixCell num="8" index={6} />
                        <LineSum label="Душа" value={r2} index={7} lineId="r2" />

                        {/* ROW 3 */}
                        <MatrixCell num="3" index={8} />
                        <MatrixCell num="6" index={9} />
                        <MatrixCell num="9" index={10} />
                        <LineSum label="Разум" value={r3} index={11} lineId="r3" />

                        {/* ROW 4 */}
                        <LineSum label="Мысль" value={c1} index={12} lineId="c1" />
                        <LineSum label="Действие" value={c2} index={13} lineId="c2" />
                        <LineSum label="Итог" value={c3} index={14} lineId="c3" />
                        
                        {/* DIAGONALS */}
                        <motion.button 
                          type="button"
                          key={`${matrixType}-diagonals`}
                          onClick={() => {
                            // Cycle through diagonals on click or clear
                            if (selectedLine === 'd1') setSelectedLine('d2');
                            else if (selectedLine === 'd2') setSelectedLine(null);
                            else setSelectedLine('d1');
                            setSelectedCell(null);
                            setSelectedMainNumber(null);
                          }}
                          onMouseEnter={() => setHoveredLines(['d1', 'd2'])}
                          onMouseLeave={() => setHoveredLines([])}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: isAnyDActive || selectedLine === 'd1' || selectedLine === 'd2' ? 1.02 : 1 }}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          transition={{ duration: 0.4, delay: isAnyDActive ? 0 : 15 * 0.02, ease: [0.16, 1, 0.3, 1] }}
                          className={`w-16 h-16 sm:w-20 sm:h-20 flex flex-col items-center justify-center outline-none transition-colors duration-500 cursor-pointer ${selectedLine === 'd1' || selectedLine === 'd2' ? 'bg-[var(--color-ivory)] bg-marble z-20 relative opacity-100 shadow-[var(--shadow-luxury)] ring-1 ring-[var(--color-antique-gold)]' : isAnyDiagonalCompleted ? 'bg-[var(--color-ivory)] bg-marble z-10 border border-[var(--color-antique-gold)] border-opacity-40 shadow-sm' : isAnyDActive ? LINE_STYLES['d'].bg + ' z-20 shadow-[var(--shadow-luxury)] ring-1 ring-[var(--color-antique-gold)]/40' : 'bg-[var(--color-surface)] bg-marble border-none shadow-sm'}`}
                        >
                          <div className="flex gap-2 sm:gap-3 mb-1">
                            <span className={`text-xs sm:text-[0.95rem] font-serif transition-colors duration-500 ${isD1Active || selectedLine === 'd1' ? LINE_STYLES['d'].text : 'text-[var(--color-ink)]'}`} title={`Внутренний компас (1-5-9): ${d1}`}>{d1}</span>
                            <span className="text-[var(--border-soft)]">/</span>
                            <span className={`text-xs sm:text-[0.95rem] font-serif transition-colors duration-500 ${isD2Active || selectedLine === 'd2' ? LINE_STYLES['d'].text : 'text-[var(--color-antique-gold)]'}`} title={`Темперамент (3-5-7): ${d2}`}>{d2}</span>
                          </div>
                          <span className={`text-[0.4rem] sm:text-[0.45rem] tracking-widest uppercase mt-1 text-center leading-[1.3] transition-colors duration-500 ${isAnyDActive || selectedLine === 'd1' || selectedLine === 'd2' ? LINE_STYLES['d'].text : 'text-[var(--color-muted)] opacity-50'}`}>ВНУТР.<br/>ТЕМП.</span>
                        </motion.button>
                      </>
                    );
                  })()}
                </div>
              </div>
            </motion.div>

            {/* Matrix Cell / Line Detail Section */}
            <AnimatePresence>
              {selectedCell && (() => {
                const count = activeMatrix[selectedCell] || 0;
                const cellData = MATRIX_CELL_DETAILS[selectedCell];
                if (!cellData) return null;
                const valDesc = cellData.meanings[count] || cellData.meanings[0];

                return (
                  <motion.div
                    initial={{ opacity: 0, height: 0, y: -10 }}
                    animate={{ opacity: 1, height: 'auto', y: 0 }}
                    exit={{ opacity: 0, height: 0, y: -10 }}
                    className="w-full overflow-hidden mb-16"
                  >
                    <div className="p-8 md:p-12 bg-white/60 backdrop-blur-sm border border-[var(--border-soft)] shadow-[var(--shadow-luxury)] relative overflow-hidden rounded-sm">
                      <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-transparent via-[var(--color-antique-gold)] to-transparent opacity-60"></div>
                      <div className="absolute -left-20 -top-20 w-64 h-64 bg-[var(--color-antique-gold)] opacity-5 blur-[100px] pointer-events-none"></div>
                      
                      <div className="flex justify-between items-start mb-6 pb-4 border-b border-[var(--border-soft)]">
                        <div>
                          <h3 className="font-serif text-2xl md:text-3xl text-[var(--color-ink)] tracking-wide">{cellData.title}</h3>
                          <p className="font-sans text-[0.65rem] uppercase tracking-[0.2em] text-[var(--color-antique-gold)] mt-2 font-semibold">Ячейка матрицы • {count} {count === 1 ? 'цифра' : count >= 2 && count <= 4 ? 'цифры' : 'цифр'}</p>
                        </div>
                        <button 
                          onClick={() => setSelectedCell(null)}
                          className="text-[var(--color-muted)] hover:text-[var(--color-ink)] bg-white/50 hover:bg-white rounded-full transition-all p-2 shadow-sm border border-transparent hover:border-[var(--border-soft)] cursor-pointer"
                        >
                          <X className="w-5 h-5" strokeWidth={1} />
                        </button>
                      </div>

                      <div className="space-y-6">
                        <div>
                          <span className="font-sans text-[0.65rem] tracking-[0.15em] uppercase text-[var(--color-muted)] block mb-1 font-medium">Суть качества</span>
                          <p className="font-serif text-lg leading-relaxed text-[var(--color-graphite)]">{cellData.essence}</p>
                        </div>
                        
                        <div className="bg-[var(--color-ivory)] p-5 border-l-2 border-[var(--color-antique-gold)]">
                          <span className="font-sans text-[0.65rem] tracking-[0.15em] uppercase text-[var(--color-antique-gold)] block mb-2 font-semibold">Ваш уровень проявления</span>
                          <p className="font-serif text-xl leading-relaxed text-[var(--color-ink)] font-medium">
                            {count > 0 ? `Ценность ${selectedCell.repeat(count)}: ` : 'Отсутствие цифры: '}
                            <span className="font-normal text-[var(--color-graphite)]">{valDesc}</span>
                          </p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })()}

              {selectedLine && (() => {
                const lineData = MATRIX_LINE_DETAILS[selectedLine];
                if (!lineData) return null;
                
                // Determine strength of the line based on cell counts in that line
                let lineCount = 0;
                if (selectedLine === 'r1') lineCount = getCount('147');
                else if (selectedLine === 'r2') lineCount = getCount('258');
                else if (selectedLine === 'r3') lineCount = getCount('369');
                else if (selectedLine === 'c1') lineCount = getCount('123');
                else if (selectedLine === 'c2') lineCount = getCount('456');
                else if (selectedLine === 'c3') lineCount = getCount('789');
                else if (selectedLine === 'd1') lineCount = getCount('159');
                else if (selectedLine === 'd2') lineCount = getCount('357');

                const strengthKey = lineCount < 3 ? 'low' : lineCount <= 5 ? 'medium' : 'high';
                const strengthDesc = lineData.meanings[strengthKey];
                
                // Fetch live completion of the selected line
                const completionInfo = checkLineCompletion(selectedLine, activeMatrix);
                const isLineActive = completionInfo.isCompleted;

                return (
                  <motion.div
                    initial={{ opacity: 0, height: 0, y: -10 }}
                    animate={{ opacity: 1, height: 'auto', y: 0 }}
                    exit={{ opacity: 0, height: 0, y: -10 }}
                    className="w-full overflow-hidden mb-16"
                  >
                    <div className="p-8 md:p-12 bg-white/60 backdrop-blur-sm border border-[var(--border-soft)] shadow-[var(--shadow-luxury)] relative overflow-hidden rounded-sm">
                      <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-transparent via-[var(--color-antique-gold)] to-transparent opacity-60"></div>
                      <div className="absolute -left-20 -top-20 w-64 h-64 bg-[var(--color-antique-gold)] opacity-5 blur-[100px] pointer-events-none"></div>
                      
                      <div className="flex justify-between items-start mb-6 pb-4 border-b border-[var(--border-soft)]">
                        <div>
                          <h3 className="font-serif text-2xl md:text-3xl text-[var(--color-ink)] tracking-wide">{lineData.title}</h3>
                          <p className="font-sans text-[0.65rem] uppercase tracking-[0.2em] text-[var(--color-antique-gold)] mt-2 font-semibold">Линия узора • Сила {lineCount} {lineCount === 1 ? 'коэффициент' : lineCount >= 2 && lineCount <= 4 ? 'коэффициента' : 'коэффициентов'}</p>
                        </div>
                        <button 
                          onClick={() => setSelectedLine(null)}
                          className="text-[var(--color-muted)] hover:text-[var(--color-ink)] bg-white/50 hover:bg-white rounded-full transition-all p-2 shadow-sm border border-transparent hover:border-[var(--border-soft)] cursor-pointer"
                        >
                          <X className="w-5 h-5" strokeWidth={1} />
                        </button>
                      </div>

                      <div className="space-y-6">
                        <div>
                          <span className="font-sans text-[0.65rem] tracking-[0.15em] uppercase text-[var(--color-muted)] block mb-1 font-medium">Суть линии в коде</span>
                          <p className="font-serif text-lg leading-relaxed text-[var(--color-graphite)]">{lineData.essence}</p>
                        </div>
                        
<div className="bg-[var(--color-ivory)] p-5 border-l-2 border-[var(--color-antique-gold)]">
                          <span className="font-sans text-[0.65rem] tracking-[0.15em] uppercase text-[var(--color-antique-gold)] block mb-2 font-semibold">Влияние на характер</span>
                          <p className="font-serif text-lg leading-relaxed text-[var(--color-graphite)] mb-4">
                            <span className="font-serif text-xl block mb-2 text-[var(--color-ink)] font-medium">
                              Уровень: {strengthKey === 'low' ? 'Требует внимания' : strengthKey === 'medium' ? 'Сбалансированный' : 'Интенсивный'}
                            </span>
                            {strengthDesc}
                          </p>
                          
                          {/* Live Completion Badge */}
                          {isLineActive ? (
                            <div className="bg-[#C8A45D]/10 border border-[#C8A45D]/30 p-4 rounded-sm mt-4">
                              <span className="font-sans text-[9px] tracking-[0.15em] uppercase text-[var(--color-antique-gold)] block mb-1 font-semibold">Линия замкнута в вашей матрице</span>
                              <p className="font-serif text-[0.95rem] text-[var(--color-graphite)]">
                                Все ячейки этой линии («{lineData.title}») заполнены цифрами по дате вашего рождения. Это дает вам врожденную опору и автоматическое раскрытие потенциала этой сферы.
                              </p>
                            </div>
                          ) : (
                            <div className="bg-[var(--color-marble)] border border-[var(--border-soft)] p-4 rounded-sm mt-4">
                              <span className="font-sans text-[9px] tracking-[0.15em] uppercase text-[var(--color-muted)] block mb-1 font-semibold">Линия разомкнута</span>
                              <p className="font-serif text-[0.95rem] text-[var(--color-graphite)]">
                                Для полной активации силы линии требуется уделить внимание проработке качеств: {completionInfo.missing.map(m => MATRIX_CELL_MEANS[m]).join(', ')}.
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })()}
            </AnimatePresence>

                        {/* First Mirror */}
            <div className="w-full flex flex-col items-center mb-12">
              {reading ? (
                <>
                  <FirstMirrorPanel data={reading} onCtaClick={handlePdfRequest} />
                  {demoNotice && (
                    <p className="text-center font-sans text-[0.7rem] tracking-[0.1em] text-[var(--color-muted)] uppercase mb-12 opacity-80">
                      {demoNotice}
                    </p>
                  )}
                  <BigResearchTeaser onCtaClick={handlePdfRequest} />
                </>
              ) : null}
            </div>

            {/* Lead Form Modal */}
            <LeadModal 
              isOpen={showLeadModal} 
              onClose={() => setShowLeadModal(false)} 
              source="code_big_research" 
              defaultBirthDate={date} 
              theme="light" 
            />
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
