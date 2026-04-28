export type CompoundKnowledge = {
  compound: number;
  root: number;
  digits: number[];
  short: string;
  formula: string;
  accent: string;
  risk: string;
  recommendation: string;
};

export const compoundKnowledge: Record<string, CompoundKnowledge> = {
  "35": {
    compound: 35,
    root: 8,
    digits: [3, 5],
    short: "Знание + Коммуникация = Результат",
    formula: "3 + 5 → 8",
    accent: "Знание и коммуникация собираются в результат, управление и материальную силу.",
    risk: "Слишком много анализа и расширения без фокуса на практической отдаче.",
    recommendation: "Выбрать один результат и довести его до измеримого итога."
  },
  "41": {
    compound: 41,
    root: 5,
    digits: [4, 1],
    short: "Креатив + Инициатива = Коммуникация",
    formula: "4 + 1 → 5",
    accent: "Креатив и личная инициатива лежат в основе коммуникации, движения и широких связей.",
    risk: "Спорить с миром, доказывать правоту и давить, а не строить мост.",
    recommendation: "Использовать нестандартность не для разрушения, а для поиска нового способа говорить с людьми."
  },
  "82": {
    compound: 82,
    root: 1,
    digits: [8, 2],
    short: "Контроль + Отношения = Лидерство",
    formula: "8 + 2 → 10 → 1",
    accent: "Контроль, ответственность и тема отношений приходят к лидерству и самостоятельному выбору.",
    risk: "Застревать между жёстким контролем и ожиданием поддержки.",
    recommendation: "Брать лидерство на себя без давления и заранее проговаривать ожидаемые правила взаимодействия."
  }
};

export function getCompoundKnowledge(compoundStr: string): CompoundKnowledge {
  if (compoundKnowledge[compoundStr]) {
    return compoundKnowledge[compoundStr];
  }
  
  // Разбор для фоллбека
  const rootStr = compoundStr.includes('/') ? compoundStr.split('/').pop() : compoundStr;
  const digitsStr = compoundStr.includes('/') ? compoundStr.split('/')[0] : compoundStr;
  
  const root = parseInt(rootStr || '0', 10);
  const digits = digitsStr.split('').map(d => parseInt(d, 10));
  
  return {
    compound: parseInt(digitsStr, 10),
    root: root,
    digits: digits,
    short: `Дополнительный оттенок: ${digits.join(' + ')}`,
    formula: `${digits.join(' + ')} → ${root}`,
    accent: `Это составное число добавляет к основной энергии дополнительные оттенки: ${digits.join(', ')}.`,
    risk: "Полный разбор внутренних конфликтов конфигурации доступен в расширенном исследовании.",
    recommendation: "Опираться на главное число, учитывая фоновое влияние дополнительных оттенков."
  };
}
